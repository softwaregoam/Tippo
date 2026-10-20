-- Personal purchases retain shopping quantities but have no customer billing.
-- Validation only: existing data, row-level security and quota RPCs are unchanged.
begin;
do $$ begin
 if to_regprocedure('public.tippo_valid_workspace_before_personal(jsonb)') is null then
  alter function public.tippo_valid_workspace(jsonb) rename to tippo_valid_workspace_before_personal;
 end if;
end $$;
create or replace function public.tippo_valid_workspace(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare o jsonb; i jsonb; projected jsonb:=d; orders jsonb:='[]'::jsonb; customer_id text; has_personal boolean:=false;
begin
 if jsonb_typeof(d->'orders') is distinct from 'array' or jsonb_typeof(d->'customers') is distinct from 'array' then return false; end if;
 for o in select value from jsonb_array_elements(d->'orders') loop
  if o ? 'purpose' then
   if o->'purpose' is distinct from '"personal"'::jsonb then return false; end if;
   has_personal:=true;
   if o->'customerId' is distinct from '""'::jsonb or o->'serviceFee' is distinct from '0'::jsonb or o->'shippingCharge' is distinct from '0'::jsonb or o->'paid' is distinct from '0'::jsonb or o ? 'discount' then return false; end if;
   if o ? 'refunds' and o->'refunds' is distinct from '[]'::jsonb then return false; end if;
   if jsonb_typeof(o->'items') is distinct from 'array' then return false; end if;
   for i in select value from jsonb_array_elements(o->'items') loop
    if i->'unitPrice' is distinct from '0'::jsonb or not public.tippo_money(i->'unitCost') then return false; end if;
   end loop;
  end if;
 end loop;
 if not has_personal then return public.tippo_valid_workspace_before_personal(d); end if;
 -- Feed a temporary customer reference to the existing validator. This projection
 -- is never stored; it preserves all existing limits, FX checks and item rules.
 customer_id:=d->'customers'->0->>'id';
 if customer_id is null then
  customer_id:='tippo-personal-validation';
  projected:=jsonb_set(projected,'{customers}',jsonb_build_array(jsonb_build_object('id',customer_id,'name','Untuk sendiri','phone','')));
 end if;
 for o in select value from jsonb_array_elements(d->'orders') loop
  if o->>'purpose'='personal' then o:=jsonb_set(o-'purpose','{customerId}',to_jsonb(customer_id)); end if;
  orders:=orders||jsonb_build_array(o);
 end loop;
 return public.tippo_valid_workspace_before_personal(jsonb_set(projected,'{orders}',orders));
exception when others then return false;
end $$;
revoke all on function public.tippo_valid_workspace(jsonb),public.tippo_valid_workspace_before_personal(jsonb) from public,anon,authenticated;
commit;
