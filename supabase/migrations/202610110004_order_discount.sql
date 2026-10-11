begin;
-- Preserve the existing shape, ownership, quota and safe-integer checks.
do $$ begin
  if to_regprocedure('public.tippo_valid_workspace_before_discount(jsonb)') is null then
    alter function public.tippo_valid_workspace(jsonb) rename to tippo_valid_workspace_before_discount;
  end if;
end $$;
create or replace function public.tippo_valid_workspace(d jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare o jsonb; i jsonb; base numeric; gross numeric; net_total numeric; discount_value numeric; discount_kind text; x jsonb;
begin
  if not public.tippo_valid_workspace_before_discount(d) then return false; end if;
  for o in select value from jsonb_array_elements(d->'orders') loop
    base := (o->>'serviceFee')::numeric;
    for i in select value from jsonb_array_elements(o->'items') loop
      base := base + (i->>'quantity')::numeric*(i->>'unitPrice')::numeric;
    end loop;
    gross := base+(o->>'shippingCharge')::numeric;
    net_total := gross;
    if o ? 'discount' then
      x := o->'discount';
      if jsonb_typeof(x)<>'object' or not public.tippo_money(x->'value') or x->>'type' is null then return false; end if;
      discount_kind := x->>'type'; discount_value := (x->>'value')::numeric;
      if discount_kind='percent' then
        if discount_value>100 then return false; end if;
        net_total := gross-round(base*discount_value/100);
      elsif discount_kind='amount' then
        if discount_value>base then return false; end if;
        net_total := gross-discount_value;
      else return false;
      end if;
    end if;
    if (o->>'paid')::numeric>net_total then return false; end if;
  end loop;
  return true;
exception when others then return false;
end; $$;
revoke all on function public.tippo_valid_workspace(jsonb),public.tippo_valid_workspace_before_discount(jsonb) from public,anon,authenticated;
commit;
