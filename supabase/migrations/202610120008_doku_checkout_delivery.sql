-- Serialize outbound Checkout requests across tabs/functions. Preserve identity.
begin;
alter table public.tippo_production_test_invoices add column if not exists send_locked_until timestamptz;
alter table public.tippo_production_test_invoices add column if not exists recovery_required boolean not null default false;
create or replace function public.tippo_claim_production_test_checkout(p_id uuid,p_owner uuid) returns boolean
language plpgsql security definer set search_path='' as $$
begin
 update public.tippo_production_test_invoices set send_locked_until=now()+interval '60 seconds'
 where id=p_id and owner_id=p_owner and status='creating' and checkout_url is null
 and not recovery_required and expires_at>now() and (send_locked_until is null or send_locked_until<=now());
 return found;
end;$$;
create or replace function public.tippo_review_production_test_checkout(p_id uuid,p_owner uuid) returns void
language sql security definer set search_path='' as $$
 update public.tippo_production_test_invoices set recovery_required=true where id=p_id and owner_id=p_owner and status='creating';
$$;
create or replace function public.tippo_get_production_test_billing(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('environment','production-test','proUntil',null,'invoice',
  (select jsonb_build_object('id',id,'number',invoice_number,'amount',amount,'currency',currency,'status',
    case when status in ('creating','pending') and expires_at<=now() then 'expired' else status end,
    'checkoutUrl',checkout_url,'createdAt',created_at,'expiresAt',expires_at,'paidAt',paid_at,
    'recoveryRequired',recovery_required and status='creating' and expires_at>now())
   from public.tippo_production_test_invoices where owner_id=p_owner order by created_at desc,id desc limit 1));
$$;
revoke all on function public.tippo_claim_production_test_checkout(uuid,uuid),public.tippo_review_production_test_checkout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tippo_claim_production_test_checkout(uuid,uuid),public.tippo_review_production_test_checkout(uuid,uuid) to service_role;
commit;
