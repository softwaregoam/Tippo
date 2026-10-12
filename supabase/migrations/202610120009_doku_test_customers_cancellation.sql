-- Test-only customer snapshot, history and provider-confirmed cancellation.
begin;
alter table public.tippo_production_test_invoices drop constraint if exists tippo_production_test_invoices_status_check;
alter table public.tippo_production_test_invoices add constraint tippo_production_test_invoices_status_check check(status in ('creating','pending','paid','expired','error','cancelled'));
alter table public.tippo_production_test_invoices add column if not exists cancellation_request_id uuid not null default gen_random_uuid();
alter table public.tippo_production_test_invoices add column if not exists cancelled_at timestamptz;

create or replace function public.tippo_begin_production_test_checkout(p_owner uuid,p_client_id text,p_callback text,p_notification text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.tippo_production_test_invoices%rowtype; code text; body text; request uuid:=gen_random_uuid(); customer jsonb;
begin
 if p_owner is null or length(p_client_id) not between 1 and 128 or p_callback is null or p_notification is null then raise exception 'INVALID_CONFIG'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,812));
 update public.tippo_production_test_invoices set status='expired' where owner_id=p_owner and status in ('creating','pending') and (expires_at<=now() or amount<>10000 or length(invoice_number)>30);
 select * into row from public.tippo_production_test_invoices where owner_id=p_owner and status in ('creating','pending');
 if found then
  if row.client_id<>p_client_id then raise exception 'MERCHANT_CHANGED'; end if;
  return to_jsonb(row);
 end if;
 select jsonb_strip_nulls(jsonb_build_object('id',id::text,'name',left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),nullif(trim(raw_user_meta_data->>'business_name'),''),split_part(email,'@',1),'Pengguna Tippo'),100),'email',email)) into customer from auth.users where id=p_owner;
 if customer is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
 code:='TPT'||substr(upper(replace(gen_random_uuid()::text,'-','')),1,24);
 body:=jsonb_build_object('order',jsonb_build_object('invoice_number',code,'amount',10000,'currency','IDR','callback_url',p_callback,'callback_url_cancel',p_callback,'language','ID','auto_redirect',true),
  'payment',jsonb_build_object('payment_due_date',60),'customer',customer,
  'additional_info',jsonb_build_object('override_notification_url',p_notification))::text;
 insert into public.tippo_production_test_invoices(owner_id,invoice_number,client_id,request_id,request_body) values(p_owner,code,p_client_id,request,body) returning * into row;
 return to_jsonb(row);
end; $$;

create or replace function public.tippo_get_production_test_billing(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with recent as (
 select jsonb_build_object('id',id,'number',invoice_number,'amount',amount,'currency',currency,'status',case when status in ('creating','pending') and expires_at<=now() then 'expired' else status end,
 'checkoutUrl',case when status='cancelled' then null else checkout_url end,'createdAt',created_at,'expiresAt',expires_at,'paidAt',paid_at,
 'recoveryRequired',recovery_required and status='creating' and expires_at>now(),
 'customerName',request_body::jsonb->'customer'->>'name','customerEmail',request_body::jsonb->'customer'->>'email') as value,created_at,id
 from public.tippo_production_test_invoices where owner_id=p_owner order by created_at desc,id desc limit 20)
 select jsonb_build_object('environment','production-test','proUntil',null,'invoice',(select value from recent order by created_at desc,id desc limit 1),'invoices',coalesce((select jsonb_agg(value order by created_at desc,id desc) from recent),'[]'::jsonb));
$$;

create or replace function public.tippo_claim_production_test_cancellation(p_id uuid,p_owner uuid,p_client_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.tippo_production_test_invoices%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,812));
 update public.tippo_production_test_invoices set send_locked_until=now()+interval '60 seconds'
 where id=p_id and owner_id=p_owner and client_id=p_client_id and status in ('creating','pending') and expires_at>now()
 and (send_locked_until is null or send_locked_until<=now()) returning * into row;
 if not found then return null; end if;
 return to_jsonb(row);
end;$$;
create or replace function public.tippo_attach_production_test_checkout(p_id uuid,p_owner uuid,p_url text,p_expires timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_url is null or p_expires is null then raise exception 'INVALID_CHECKOUT'; end if;
 update public.tippo_production_test_invoices set checkout_url=p_url,expires_at=p_expires,send_locked_until=null,
 status=case when status='paid' then 'paid' else 'pending' end
 where id=p_id and owner_id=p_owner and status in ('creating','pending','paid');
 if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
end;$$;
create or replace function public.tippo_finish_production_test_cancellation(p_id uuid,p_owner uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,812));
 update public.tippo_production_test_invoices set status=case when p_success then 'cancelled' else status end,
 cancelled_at=case when p_success then now() else cancelled_at end,send_locked_until=null
 where id=p_id and owner_id=p_owner and status in ('creating','pending');
end;$$;
revoke all on function public.tippo_claim_production_test_cancellation(uuid,uuid,text),public.tippo_finish_production_test_cancellation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.tippo_claim_production_test_cancellation(uuid,uuid,text),public.tippo_finish_production_test_cancellation(uuid,uuid,boolean) to service_role;
create or replace function public.tippo_accept_production_test_notification(p_invoice text,p_client_id text,p_amount numeric,p_request_id text,p_digest text,p_status text,p_original_request text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare row public.tippo_production_test_invoices%rowtype; previous public.tippo_production_test_notifications%rowtype;
begin
 select * into row from public.tippo_production_test_invoices where invoice_number=p_invoice;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(row.owner_id::text,812));
 select * into row from public.tippo_production_test_invoices where invoice_number=p_invoice for update;
 if p_client_id is distinct from row.client_id or p_amount is distinct from row.amount::numeric or (p_original_request is not null and p_original_request<>row.request_id::text) then raise exception 'PAYMENT_MISMATCH'; end if;
 if p_request_id is null or length(p_request_id) not between 1 and 128 or p_digest is null or length(p_digest)>128 or p_status not in ('SUCCESS','FAILED','PENDING','EXPIRED') then raise exception 'INVALID_NOTIFICATION'; end if;
 select * into previous from public.tippo_production_test_notifications where request_id=p_request_id;
 if found then
  if previous.digest<>p_digest or previous.invoice_number<>p_invoice then raise exception 'REPLAY_MISMATCH'; end if;
  return true;
 end if;
 insert into public.tippo_production_test_notifications(request_id,invoice_number,digest,status) values(p_request_id,p_invoice,p_digest,p_status);
 -- Checkout FAILED is an unsuccessful attempt, not a final invoice failure.
 if p_status='SUCCESS' and row.status<>'paid' then
  update public.tippo_production_test_invoices set status='paid',paid_at=now() where id=row.id;
 elsif p_status='EXPIRED' and row.status not in ('paid','cancelled') then
  update public.tippo_production_test_invoices set status='expired' where id=row.id;
 end if;
 return true;
end; $$;
commit;
