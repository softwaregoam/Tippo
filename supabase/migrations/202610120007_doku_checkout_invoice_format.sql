-- 27 alphanumeric chars: compatible with Checkout card max 30 and KKI.
-- Retire old long test invoices locally; preserve their immutable ledger.
begin;
create or replace function public.tippo_begin_production_test_checkout(p_owner uuid,p_client_id text,p_callback text,p_notification text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare row public.tippo_production_test_invoices%rowtype; code text; body text; request uuid:=gen_random_uuid();
begin
 if p_owner is null or length(p_client_id) not between 1 and 128 or p_callback is null or p_notification is null then raise exception 'INVALID_CONFIG'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_owner::text,812));
 update public.tippo_production_test_invoices set status='expired' where owner_id=p_owner and status in ('creating','pending') and (expires_at<=now() or amount<>10000 or length(invoice_number)>30);
 select * into row from public.tippo_production_test_invoices where owner_id=p_owner and status in ('creating','pending');
 if found then
  if row.client_id<>p_client_id then raise exception 'MERCHANT_CHANGED'; end if;
  return to_jsonb(row);
 end if;
 code:='TPT'||substr(upper(replace(gen_random_uuid()::text,'-','')),1,24);
 body:=jsonb_build_object('order',jsonb_build_object('invoice_number',code,'amount',10000,'currency','IDR','callback_url',p_callback,'callback_url_cancel',p_callback,'language','ID','auto_redirect',true),
  'payment',jsonb_build_object('payment_due_date',60),
  'additional_info',jsonb_build_object('override_notification_url',p_notification))::text;
 insert into public.tippo_production_test_invoices(owner_id,invoice_number,client_id,request_id,request_body) values(p_owner,code,p_client_id,request,body) returning * into row;
 return to_jsonb(row);
end; $$;
commit;
