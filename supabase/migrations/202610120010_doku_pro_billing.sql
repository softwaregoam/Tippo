-- Real Tippo Pro billing, Rp25.000/month. Separate from test ledgers.
begin;
create table if not exists public.tippo_pro_invoices (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 invoice_number text not null unique,
 client_id text not null,
 request_id uuid not null unique,
 request_body text not null,
 amount integer not null default 25000 check(amount=25000),
 currency text not null default 'IDR' check(currency='IDR'),
 status text not null default 'creating' check(status in ('creating','pending','paid','expired','error')),
 checkout_url text,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '60 minutes',
 paid_at timestamptz
);
create unique index if not exists tippo_pro_active_invoice on public.tippo_pro_invoices(owner_id) where status in ('creating','pending');
create table if not exists public.tippo_pro_notifications (
 request_id text primary key,
 invoice_number text not null references public.tippo_pro_invoices(invoice_number),
 digest text not null,
 status text not null,
 received_at timestamptz not null default now()
);
alter table public.tippo_pro_invoices enable row level security;
alter table public.tippo_pro_notifications enable row level security;
drop policy if exists own_pro_invoices on public.tippo_pro_invoices;
create policy own_pro_invoices on public.tippo_pro_invoices for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.tippo_pro_invoices,public.tippo_pro_notifications from anon,authenticated;
grant select(id,owner_id,invoice_number,amount,currency,status,checkout_url,created_at,expires_at,paid_at) on public.tippo_pro_invoices to authenticated;

alter table public.tippo_pro_invoices add column if not exists send_locked_until timestamptz;
alter table public.tippo_pro_invoices add column if not exists recovery_required boolean not null default false;
create or replace function public.tippo_claim_pro_checkout(p_id uuid,p_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.tippo_pro_invoices set send_locked_until=now()+interval '60 seconds'
 where id=p_id and owner_id=p_owner and status='creating' and checkout_url is null
 and not recovery_required and expires_at>now() and (send_locked_until is null or send_locked_until<=now());
 return found;
end;$$;
create or replace function public.tippo_review_pro_checkout(p_id uuid,p_owner uuid) returns void
language sql security definer set search_path='' as $$
 update public.tippo_pro_invoices set recovery_required=true where id=p_id and owner_id=p_owner and status='creating';
$$;
alter table public.tippo_pro_invoices drop constraint if exists tippo_pro_invoices_status_check;
alter table public.tippo_pro_invoices add constraint tippo_pro_invoices_status_check check(status in ('creating','pending','paid','expired','error','cancelled'));
alter table public.tippo_pro_invoices add column if not exists period_start timestamptz;
alter table public.tippo_pro_invoices add column if not exists period_end timestamptz;
alter table public.tippo_pro_invoices add column if not exists cancellation_request_id uuid not null default gen_random_uuid();
alter table public.tippo_pro_invoices add column if not exists cancelled_at timestamptz;

create or replace function public.tippo_begin_pro_checkout(p_owner uuid,p_client_id text,p_callback text,p_notification text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.tippo_pro_invoices%rowtype; code text; body text; request uuid:=gen_random_uuid(); customer jsonb;
begin
 if p_owner is null or length(p_client_id) not between 1 and 128 or p_callback is null or p_notification is null then raise exception 'INVALID_CONFIG'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,812));
 update public.tippo_pro_invoices set status='expired' where owner_id=p_owner and status in ('creating','pending') and (expires_at<=now() or amount<>25000 or length(invoice_number)>30);
 select * into row from public.tippo_pro_invoices where owner_id=p_owner and status in ('creating','pending');
 if found then
  if row.client_id<>p_client_id then raise exception 'MERCHANT_CHANGED'; end if;
  return to_jsonb(row);
 end if;
 select jsonb_strip_nulls(jsonb_build_object('id',id::text,'name',left(coalesce(nullif(trim(raw_user_meta_data->>'full_name'),''),nullif(trim(raw_user_meta_data->>'name'),''),nullif(trim(raw_user_meta_data->>'business_name'),''),split_part(email,'@',1),'Pengguna Tippo'),100),'email',email)) into customer from auth.users where id=p_owner;
 if customer is null then raise exception 'CUSTOMER_NOT_FOUND'; end if;
 code:='TPR'||substr(upper(replace(gen_random_uuid()::text,'-','')),1,24);
 body:=jsonb_build_object('order',jsonb_build_object('invoice_number',code,'amount',25000,'currency','IDR','callback_url',p_callback,'callback_url_cancel',p_callback,'language','ID','auto_redirect',true),
  'payment',jsonb_build_object('payment_due_date',60),'customer',customer,
  'additional_info',jsonb_build_object('override_notification_url',p_notification))::text;
 insert into public.tippo_pro_invoices(owner_id,invoice_number,client_id,request_id,request_body) values(p_owner,code,p_client_id,request,body) returning * into row;
 return to_jsonb(row);
end; $$;

create or replace function public.tippo_get_pro_billing(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 with recent as (
 select jsonb_build_object('id',id,'number',invoice_number,'amount',amount,'currency',currency,'status',case when status in ('creating','pending') and expires_at<=now() then 'expired' else status end,
 'checkoutUrl',case when status='cancelled' then null else checkout_url end,'createdAt',created_at,'expiresAt',expires_at,'paidAt',paid_at,
 'recoveryRequired',recovery_required and status='creating' and expires_at>now(),
 'periodStart',period_start,'periodEnd',period_end,'customerName',request_body::jsonb->'customer'->>'name','customerEmail',request_body::jsonb->'customer'->>'email') as value,created_at,id
 from public.tippo_pro_invoices where owner_id=p_owner order by created_at desc,id desc limit 20)
 select jsonb_build_object('environment','production','proUntil',(select pro_until from public.tippo_workspaces where owner_id=p_owner),'invoice',(select value from recent order by created_at desc,id desc limit 1),'invoices',coalesce((select jsonb_agg(value order by created_at desc,id desc) from recent),'[]'::jsonb));
$$;

create or replace function public.tippo_claim_pro_cancellation(p_id uuid,p_owner uuid,p_client_id text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.tippo_pro_invoices%rowtype;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,812));
 update public.tippo_pro_invoices set send_locked_until=now()+interval '60 seconds'
 where id=p_id and owner_id=p_owner and client_id=p_client_id and status in ('creating','pending') and expires_at>now()
 and (send_locked_until is null or send_locked_until<=now()) returning * into row;
 if not found then return null; end if;
 return to_jsonb(row);
end;$$;
create or replace function public.tippo_attach_pro_checkout(p_id uuid,p_owner uuid,p_url text,p_expires timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_url is null or p_expires is null then raise exception 'INVALID_CHECKOUT'; end if;
 update public.tippo_pro_invoices set checkout_url=p_url,expires_at=p_expires,send_locked_until=null,
 status=case when status='paid' then 'paid' else 'pending' end
 where id=p_id and owner_id=p_owner and status in ('creating','pending','paid');
 if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
end;$$;
create or replace function public.tippo_finish_pro_cancellation(p_id uuid,p_owner uuid,p_success boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,812));
 update public.tippo_pro_invoices set status=case when p_success then 'cancelled' else status end,
 cancelled_at=case when p_success then now() else cancelled_at end,send_locked_until=null
 where id=p_id and owner_id=p_owner and status in ('creating','pending');
end;$$;
revoke all on function public.tippo_claim_pro_cancellation(uuid,uuid,text),public.tippo_finish_pro_cancellation(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.tippo_claim_pro_cancellation(uuid,uuid,text),public.tippo_finish_pro_cancellation(uuid,uuid,boolean) to service_role;
create or replace function public.tippo_accept_pro_notification(p_invoice text,p_client_id text,p_amount numeric,p_request_id text,p_digest text,p_status text,p_original_request text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare row public.tippo_pro_invoices%rowtype; previous public.tippo_pro_notifications%rowtype; starts timestamptz; ends timestamptz;
begin
 select * into row from public.tippo_pro_invoices where invoice_number=p_invoice;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(row.owner_id::text,812));
 select * into row from public.tippo_pro_invoices where invoice_number=p_invoice for update;
 if p_client_id is distinct from row.client_id or p_amount is distinct from row.amount::numeric or (p_original_request is not null and p_original_request<>row.request_id::text) then raise exception 'PAYMENT_MISMATCH'; end if;
 if p_request_id is null or length(p_request_id) not between 1 and 128 or p_digest is null or length(p_digest)>128 or p_status not in ('SUCCESS','FAILED','PENDING','EXPIRED') then raise exception 'INVALID_NOTIFICATION'; end if;
 select * into previous from public.tippo_pro_notifications where request_id=p_request_id;
 if found then
  if previous.digest<>p_digest or previous.invoice_number<>p_invoice then raise exception 'REPLAY_MISMATCH'; end if;
  return true;
 end if;
 insert into public.tippo_pro_notifications(request_id,invoice_number,digest,status) values(p_request_id,p_invoice,p_digest,p_status);
 -- Checkout FAILED is an unsuccessful attempt, not a final invoice failure.
 if p_status='SUCCESS' and row.status<>'paid' then
  insert into public.tippo_workspaces(owner_id) values(row.owner_id) on conflict(owner_id) do nothing;
  select greatest(coalesce(pro_until,now()),now()) into starts from public.tippo_workspaces where owner_id=row.owner_id for update;
  ends:=((starts at time zone 'Asia/Jakarta')+interval '1 month') at time zone 'Asia/Jakarta';
  update public.tippo_workspaces set pro_until=ends where owner_id=row.owner_id;
  update public.tippo_pro_invoices set status='paid',paid_at=now(),period_start=starts,period_end=ends where id=row.id;
 elsif p_status='EXPIRED' and row.status not in ('paid','cancelled') then
  update public.tippo_pro_invoices set status='expired' where id=row.id;
 end if;
 return true;
end; $$;
revoke all on function public.tippo_begin_pro_checkout(uuid,text,text,text),public.tippo_attach_pro_checkout(uuid,uuid,text,timestamptz),public.tippo_get_pro_billing(uuid),public.tippo_accept_pro_notification(text,text,numeric,text,text,text,text) from public,anon,authenticated;
grant execute on function public.tippo_begin_pro_checkout(uuid,text,text,text),public.tippo_attach_pro_checkout(uuid,uuid,text,timestamptz),public.tippo_get_pro_billing(uuid),public.tippo_accept_pro_notification(text,text,numeric,text,text,text,text) to service_role;
create or replace function public.tippo_fail_pro_checkout(p_id uuid,p_owner uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 update public.tippo_pro_invoices set status='error' where id=p_id and owner_id=p_owner and status='creating';
end; $$;
revoke all on function public.tippo_fail_pro_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tippo_fail_pro_checkout(uuid,uuid) to service_role;

revoke all on function public.tippo_claim_pro_checkout(uuid,uuid),public.tippo_review_pro_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tippo_claim_pro_checkout(uuid,uuid),public.tippo_review_pro_checkout(uuid,uuid) to service_role;
commit;
