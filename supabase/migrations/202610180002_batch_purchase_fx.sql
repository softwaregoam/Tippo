-- Batch reference quotes are defaults only; order item snapshots remain independent.
begin;
do $$ begin
 if to_regprocedure('public.tippo_valid_workspace_before_batch_fx(jsonb)') is null then
  alter function public.tippo_valid_workspace(jsonb) rename to tippo_valid_workspace_before_batch_fx;
 end if;
end $$;
create or replace function public.tippo_valid_workspace(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare b jsonb; f jsonb; r numeric;
begin
 if not public.tippo_valid_workspace_before_batch_fx(d) then return false; end if;
 for b in select value from jsonb_array_elements(d->'batches') loop
  if not (b ? 'purchaseFx') then continue; end if;
  f:=b->'purchaseFx';
  if b->>'type' is distinct from 'jastip' or jsonb_typeof(f) is distinct from 'object' then return false; end if;
  if not coalesce(f->>'currency' in ('JPY','KRW','SGD','USD','EUR','CNY','MYR','THB','HKD','AUD','GBP') and f->>'source' in ('manual','frankfurter'),false) then return false; end if;
  if f->'rate'='null'::jsonb then r:=null;
  elsif jsonb_typeof(f->'rate')='string' and f->>'rate' ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then r:=(f->>'rate')::numeric;
  else return false; end if;
  if r is not null and r<=0 then return false; end if;
  if f ? 'rateDate' then
   if jsonb_typeof(f->'rateDate') is distinct from 'string' or f->>'rateDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((f->>'rateDate')::date,'YYYY-MM-DD')<>f->>'rateDate' then return false; end if;
  end if;
  if f->>'source'='frankfurter' and (r is null or not (f ? 'rateDate')) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.tippo_valid_workspace(jsonb),public.tippo_valid_workspace_before_batch_fx(jsonb) from public,anon,authenticated;
commit;
