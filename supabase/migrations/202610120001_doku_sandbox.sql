-- Sandbox billing only. Never changes tippo_workspaces.pro_until.
begin;
create table if not exists public.tippo_sandbox_invoices (
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
create unique index if not exists tippo_sandbox_active_invoice on public.tippo_sandbox_invoices(owner_id) where status in ('creating','pending');
create table if not exists public.tippo_sandbox_pro_access (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 pro_until timestamptz not null
);
create table if not exists public.tippo_sandbox_notifications (
 request_id text primary key,
 invoice_number text not null references public.tippo_sandbox_invoices(invoice_number),
 digest text not null,
 status text not null,
 received_at timestamptz not null default now()
);
alter table public.tippo_sandbox_invoices enable row level security;
alter table public.tippo_sandbox_pro_access enable row level security;
alter table public.tippo_sandbox_notifications enable row level security;
drop policy if exists own_sandbox_invoices on public.tippo_sandbox_invoices;
create policy own_sandbox_invoices on public.tippo_sandbox_invoices for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists own_sandbox_pro on public.tippo_sandbox_pro_access;
create policy own_sandbox_pro on public.tippo_sandbox_pro_access for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.tippo_sandbox_invoices,public.tippo_sandbox_pro_access,public.tippo_sandbox_notifications from anon,authenticated;
grant select(id,owner_id,invoice_number,amount,currency,status,checkout_url,created_at,expires_at,paid_at) on public.tippo_sandbox_invoices to authenticated;
grant select on public.tippo_sandbox_pro_access to authenticated;

create or replace function public.tippo_begin_sandbox_checkout(p_owner uuid,p_client_id text,p_callback text,p_notification text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.tippo_sandbox_invoices%rowtype; code text; body text; request uuid:=gen_random_uuid();
begin
 if p_owner is null or length(p_client_id) not between 1 and 128 or p_callback is null or p_notification is null then raise exception 'INVALID_CONFIG'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,812));
 update public.tippo_sandbox_invoices set status='expired' where owner_id=p_owner and status in ('creating','pending') and expires_at<=now();
 select * into row from public.tippo_sandbox_invoices where owner_id=p_owner and status in ('creating','pending');
 if found then
  if row.client_id<>p_client_id then raise exception 'MERCHANT_CHANGED'; end if;
  return to_jsonb(row);
 end if;
 code:='TSBX-'||upper(replace(gen_random_uuid()::text,'-',''));
 body:=jsonb_build_object('order',jsonb_build_object('invoice_number',code,'amount',25000,'currency','IDR','callback_url',p_callback,'callback_url_cancel',p_callback,'language','ID','auto_redirect',true),
  'payment',jsonb_build_object('payment_due_date',60,'payment_method_types',jsonb_build_array('QRIS')),
  'additional_info',jsonb_build_object('override_notification_url',p_notification))::text;
 insert into public.tippo_sandbox_invoices(owner_id,invoice_number,client_id,request_id,request_body) values(p_owner,code,p_client_id,request,body) returning * into row;
 return to_jsonb(row);
end; $$;

create or replace function public.tippo_attach_sandbox_checkout(p_id uuid,p_owner uuid,p_url text,p_expires timestamptz) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_url is null or p_expires is null then raise exception 'INVALID_CHECKOUT'; end if;
 update public.tippo_sandbox_invoices set checkout_url=p_url,expires_at=p_expires,status=case when status='paid' then 'paid' else 'pending' end where id=p_id and owner_id=p_owner and status in ('creating','pending','paid');
 if not found then raise exception 'INVOICE_NOT_FOUND'; end if;
end; $$;

create or replace function public.tippo_get_sandbox_billing(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('environment','sandbox','proUntil',(select pro_until from public.tippo_sandbox_pro_access where owner_id=p_owner),'invoice',
  (select jsonb_build_object('id',id,'number',invoice_number,'amount',amount,'currency',currency,'status',case when status in ('creating','pending') and expires_at<=now() then 'expired' else status end,'checkoutUrl',checkout_url,'createdAt',created_at,'expiresAt',expires_at,'paidAt',paid_at) from public.tippo_sandbox_invoices where owner_id=p_owner order by created_at desc,id desc limit 1));
$$;

create or replace function public.tippo_accept_sandbox_notification(p_invoice text,p_client_id text,p_amount numeric,p_request_id text,p_digest text,p_status text,p_original_request text default null) returns boolean
language plpgsql security definer set search_path='' as $$
declare row public.tippo_sandbox_invoices%rowtype; previous public.tippo_sandbox_notifications%rowtype;
begin
 select * into row from public.tippo_sandbox_invoices where invoice_number=p_invoice;
 if not found then return false; end if;
 perform pg_advisory_xact_lock(hashtextextended(row.owner_id::text,812));
 select * into row from public.tippo_sandbox_invoices where invoice_number=p_invoice for update;
 if p_client_id is distinct from row.client_id or p_amount is distinct from row.amount::numeric or (p_original_request is not null and p_original_request<>row.request_id::text) then raise exception 'PAYMENT_MISMATCH'; end if;
 if p_request_id is null or length(p_request_id) not between 1 and 128 or p_digest is null or length(p_digest)>128 or p_status not in ('SUCCESS','FAILED','PENDING','EXPIRED') then raise exception 'INVALID_NOTIFICATION'; end if;
 select * into previous from public.tippo_sandbox_notifications where request_id=p_request_id;
 if found then
  if previous.digest<>p_digest or previous.invoice_number<>p_invoice then raise exception 'REPLAY_MISMATCH'; end if;
  return true;
 end if;
 insert into public.tippo_sandbox_notifications(request_id,invoice_number,digest,status) values(p_request_id,p_invoice,p_digest,p_status);
 -- Checkout FAILED is an unsuccessful attempt, not a final invoice failure.
 if p_status='SUCCESS' and row.status<>'paid' then
  insert into public.tippo_sandbox_pro_access(owner_id,pro_until) values(row.owner_id,((now() at time zone 'Asia/Jakarta')+interval '1 month') at time zone 'Asia/Jakarta')
  on conflict(owner_id) do update set pro_until=((greatest(public.tippo_sandbox_pro_access.pro_until,now()) at time zone 'Asia/Jakarta')+interval '1 month') at time zone 'Asia/Jakarta';
  update public.tippo_sandbox_invoices set status='paid',paid_at=now() where id=row.id;
 elsif p_status='EXPIRED' and row.status<>'paid' then
  update public.tippo_sandbox_invoices set status='expired' where id=row.id;
 end if;
 return true;
end; $$;

revoke all on function public.tippo_begin_sandbox_checkout(uuid,text,text,text),public.tippo_attach_sandbox_checkout(uuid,uuid,text,timestamptz),public.tippo_get_sandbox_billing(uuid),public.tippo_accept_sandbox_notification(text,text,numeric,text,text,text,text) from public,anon,authenticated;
grant execute on function public.tippo_begin_sandbox_checkout(uuid,text,text,text),public.tippo_attach_sandbox_checkout(uuid,uuid,text,timestamptz),public.tippo_get_sandbox_billing(uuid),public.tippo_accept_sandbox_notification(text,text,numeric,text,text,text,text) to service_role;
commit;
