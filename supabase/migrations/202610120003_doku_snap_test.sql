-- SNAP BNI production test, fixed Rp10, no subscription entitlement.
begin;
create table if not exists public.tippo_snap_test_invoices(
 id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
 invoice_number text not null unique,client_id text not null,request_id text not null unique,
 request_body text not null,amount integer not null default 10 check(amount=10),
 currency text not null default 'IDR' check(currency='IDR'),
 status text not null default 'creating' check(status in ('creating','pending','paid','expired','error')),
 partner_service_id text not null,customer_prefix text not null,customer_no text,va_number text,va_name text not null,
 instructions_url text,created_at timestamptz not null default now(),expires_at timestamptz not null,paid_at timestamptz
);
create unique index if not exists tippo_snap_test_active on public.tippo_snap_test_invoices(owner_id) where status in ('creating','pending');
create table if not exists public.tippo_snap_test_notifications(
 payment_id text primary key,event_id text not null,invoice_number text not null references public.tippo_snap_test_invoices(invoice_number),
 digest text not null,received_at timestamptz not null default now()
);
alter table public.tippo_snap_test_invoices enable row level security;
alter table public.tippo_snap_test_notifications enable row level security;
drop policy if exists own_snap_test on public.tippo_snap_test_invoices;
create policy own_snap_test on public.tippo_snap_test_invoices for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.tippo_snap_test_invoices,public.tippo_snap_test_notifications from anon,authenticated;
grant select(id,owner_id,invoice_number,amount,currency,status,va_number,va_name,instructions_url,created_at,expires_at,paid_at) on public.tippo_snap_test_invoices to authenticated;

create or replace function public.tippo_begin_snap_test(p_owner uuid,p_client_id text,p_partner text,p_prefix text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.tippo_snap_test_invoices%rowtype; code text; body text; expiry timestamptz:=date_trunc('second',now())+interval '60 minutes'; external text;
begin
 if p_owner is null or p_client_id is null or length(p_client_id) not between 1 and 128 or p_partner is null or p_partner!~'^ *[0-9]{1,8}$' or length(p_partner)<>8 or p_prefix is null or p_prefix!~'^[0-9]{1,20}$' then raise exception 'INVALID_CONFIG';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,813));
 update public.tippo_snap_test_invoices set status='expired' where owner_id=p_owner and status in ('creating','pending') and expires_at<=now();
 select * into row from public.tippo_snap_test_invoices where owner_id=p_owner and status in ('creating','pending');
 if found then
  if row.client_id<>p_client_id or row.partner_service_id<>p_partner or row.customer_prefix<>p_prefix then raise exception 'MERCHANT_CHANGED';end if;
  return to_jsonb(row);
 end if;
 code:='TSNP-'||upper(replace(gen_random_uuid()::text,'-',''));
 -- Two random 56-bit values converted to a numeric external ID (36 digits).
 external:=lpad((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,14))::bit(56)::bigint)::text,18,'0')||
           lpad((('x'||substr(replace(gen_random_uuid()::text,'-',''),1,14))::bit(56)::bigint)::text,18,'0');
 body:=jsonb_build_object('partnerServiceId',p_partner,'customerNo',p_prefix,
  'virtualAccountNo',lpad(trim(p_partner),8,'0')||p_prefix,'virtualAccountName','Tippo Uji Pembayaran',
  'trxId',code,'virtualAccountTrxType','C','totalAmount',jsonb_build_object('value','10.00','currency','IDR'),
  'expiredDate',to_char(expiry at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"'),
  'additionalInfo',jsonb_build_object('channel','VIRTUAL_ACCOUNT_BNI','virtualAccountConfig',jsonb_build_object('reusableStatus',false)))::text;
 insert into public.tippo_snap_test_invoices(owner_id,invoice_number,client_id,request_id,request_body,partner_service_id,customer_prefix,va_name,expires_at)
 values(p_owner,code,p_client_id,external,body,p_partner,p_prefix,'Tippo Uji Pembayaran',expiry) returning * into row;
 return to_jsonb(row);
end;$$;

create or replace function public.tippo_attach_snap_test(p_id uuid,p_owner uuid,p_va jsonb,p_url text) returns void
language plpgsql security definer set search_path='' as $$
declare row public.tippo_snap_test_invoices%rowtype;
begin
 select * into row from public.tippo_snap_test_invoices where id=p_id and owner_id=p_owner for update;
 if not found then raise exception 'INVOICE_NOT_FOUND';end if;
 if p_va->>'trxId' is distinct from row.invoice_number or p_va->>'partnerServiceId' is distinct from row.partner_service_id
  or p_va#>>'{totalAmount,value}' is distinct from '10.00' or p_va#>>'{totalAmount,currency}' is distinct from 'IDR'
  or p_va#>>'{additionalInfo,channel}' is distinct from 'VIRTUAL_ACCOUNT_BNI' or p_va->>'virtualAccountTrxType' is distinct from 'C'
  or p_va->>'virtualAccountName' is distinct from row.va_name or (p_va->>'expiredDate')::timestamptz is distinct from row.expires_at
  or p_va->>'customerNo' is null or p_va->>'customerNo'!~'^[0-9]{1,20}$' or left(p_va->>'customerNo',length(row.customer_prefix))<>row.customer_prefix
  or p_va->>'virtualAccountNo' is distinct from lpad(trim(row.partner_service_id),8,'0')||(p_va->>'customerNo')
  or (row.va_number is not null and row.va_number<>p_va->>'virtualAccountNo') then raise exception 'PAYMENT_MISMATCH';end if;
 update public.tippo_snap_test_invoices set customer_no=p_va->>'customerNo',va_number=p_va->>'virtualAccountNo',instructions_url=p_url,
  status=case when status='creating' then 'pending' else status end where id=p_id;
end;$$;

create or replace function public.tippo_get_snap_test(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('environment','snap-production-test','proUntil',null,'invoice',
 (select jsonb_build_object('id',id,'number',invoice_number,'amount',amount,'currency',currency,
 'status',case when status in ('creating','pending') and expires_at<=now() then 'expired' else status end,
 'vaNumber',va_number,'vaName',va_name,'bank','BNI','instructionsUrl',instructions_url,'createdAt',created_at,'expiresAt',expires_at,'paidAt',paid_at)
 from public.tippo_snap_test_invoices where owner_id=p_owner order by created_at desc,id desc limit 1));
$$;

create or replace function public.tippo_accept_snap_test(p_payload jsonb,p_event text,p_digest text) returns boolean
language plpgsql security definer set search_path='' as $$
declare row public.tippo_snap_test_invoices%rowtype; previous public.tippo_snap_test_notifications%rowtype; payment text:=p_payload->>'paymentRequestId';
begin
 select * into row from public.tippo_snap_test_invoices where invoice_number=p_payload->>'trxId' for update;
 if not found then return false;end if;
 if p_payload->>'partnerServiceId' is distinct from row.partner_service_id or p_payload->>'virtualAccountName' is distinct from row.va_name
 or p_payload#>>'{paidAmount,value}' is distinct from '10.00' or p_payload#>>'{paidAmount,currency}' is distinct from 'IDR'
 or (p_payload ? 'totalAmount' and (p_payload#>>'{totalAmount,value}' is distinct from '10.00' or p_payload#>>'{totalAmount,currency}' is distinct from 'IDR'))
 or p_payload#>>'{additionalInfo,channel}' is distinct from 'VIRTUAL_ACCOUNT_BNI'
 or p_payload->>'customerNo' is null or p_payload->>'customerNo'!~'^[0-9]{1,20}$' or left(p_payload->>'customerNo',length(row.customer_prefix))<>row.customer_prefix
 or p_payload->>'virtualAccountNo' is distinct from lpad(trim(row.partner_service_id),8,'0')||(p_payload->>'customerNo')
 or (row.va_number is not null and row.va_number<>p_payload->>'virtualAccountNo')
 or (p_payload ? 'virtualAccountTrxType' and p_payload->>'virtualAccountTrxType'<>'C')
 then raise exception 'PAYMENT_MISMATCH';end if;
 if payment is null or length(payment) not between 1 and 30 or p_event is null or p_event!~'^[0-9]{1,36}$'
 or p_digest is null or p_digest!~'^[a-f0-9]{64}$' then raise exception 'INVALID_NOTIFICATION';end if;
 select * into previous from public.tippo_snap_test_notifications where payment_id=payment;
 if found then
  if previous.invoice_number<>row.invoice_number or previous.digest<>p_digest then raise exception 'REPLAY_MISMATCH';end if;
  return true;
 end if;
 insert into public.tippo_snap_test_notifications(payment_id,event_id,invoice_number,digest) values(payment,p_event,row.invoice_number,p_digest);
 -- Authenticated payment notification is final. No Pro grant, even when paid.
 update public.tippo_snap_test_invoices set status='paid',paid_at=coalesce(paid_at,now()),
 customer_no=p_payload->>'customerNo',va_number=p_payload->>'virtualAccountNo' where id=row.id;
 return true;
end;$$;

create or replace function public.tippo_fail_snap_test(p_id uuid,p_owner uuid) returns void
language sql security definer set search_path='' as $$
 update public.tippo_snap_test_invoices set status='error' where id=p_id and owner_id=p_owner and status='creating';
$$;
revoke all on function public.tippo_begin_snap_test(uuid,text,text,text),public.tippo_attach_snap_test(uuid,uuid,jsonb,text),
 public.tippo_get_snap_test(uuid),public.tippo_accept_snap_test(jsonb,text,text),public.tippo_fail_snap_test(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tippo_begin_snap_test(uuid,text,text,text),public.tippo_attach_snap_test(uuid,uuid,jsonb,text),
 public.tippo_get_snap_test(uuid),public.tippo_accept_snap_test(jsonb,text,text),public.tippo_fail_snap_test(uuid,uuid) to service_role;
commit;
