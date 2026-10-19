-- Expand supported national currencies. No workspace, ledger or quota changes.
-- Standalone after shopping_recap; also upgrades existing purchase_fx/batch_purchase_fx.
begin;
do $$ begin
 if to_regprocedure('public.tippo_valid_workspace_before_fx(jsonb)') is null then
  alter function public.tippo_valid_workspace(jsonb) rename to tippo_valid_workspace_before_fx;
 end if;
end $$;
create or replace function public.tippo_valid_workspace_before_batch_fx(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare o jsonb; i jsonb; f jsonb; a numeric; r numeric; cost numeric; kind text;
begin
 if not public.tippo_valid_workspace_before_fx(d) then return false; end if;
 for o in select value from jsonb_array_elements(d->'orders') loop
  select b->>'type' into kind from jsonb_array_elements(d->'batches') b where b->>'id'=o->>'batchId';
  for i in select value from jsonb_array_elements(o->'items') loop
   if not (i ? 'purchaseFx') then continue; end if;
   f:=i->'purchaseFx';
   if kind is distinct from 'jastip' or jsonb_typeof(f) is distinct from 'object' then return false; end if;
   if not coalesce(f->>'currency' in ('JPY','KRW','SGD','USD','EUR','CNY','MYR','THB','HKD','AUD','GBP','AED','AFN','ALL','AMD','AOA','ARS','AWG','AZN','BAM','BBD','BDT','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNH','COP','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','FJD','FKP','GEL','GGP','GHS','GIP','GMD','GNF','GTQ','GYD','HNL','HTG','HUF','ILS','IMP','INR','IQD','IRR','ISK','JEP','JMD','JOD','KES','KGS','KHR','KMF','KPW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SHP','SLE','SOS','SRD','SSP','STN','SYP','SZL','TJS','TMT','TND','TOP','TRY','TTD','TVD','TWD','TZS','UAH','UGX','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XCG','XOF','XPF','YER','ZAR','ZMW','ZWG') and f->>'status' in ('estimate','final') and f->>'source' in ('manual','frankfurter','exchange-api'),false) then return false; end if;
   if f->'amount'='null'::jsonb then a:=null;
   elsif jsonb_typeof(f->'amount')='string' and f->>'amount' ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then a:=(f->>'amount')::numeric;
   else return false; end if;
   if f->'rate'='null'::jsonb then r:=null;
   elsif jsonb_typeof(f->'rate')='string' and f->>'rate' ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then r:=(f->>'rate')::numeric;
   else return false; end if;
   if r is not null and r<=0 then return false; end if;
   if f ? 'rateDate' then
    if jsonb_typeof(f->'rateDate') is distinct from 'string' or f->>'rateDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((f->>'rateDate')::date,'YYYY-MM-DD')<>f->>'rateDate' then return false; end if;
   end if;
   if f->>'source' in ('frankfurter','exchange-api') and (r is null or not (f ? 'rateDate')) then return false; end if;
   if a is null or r is null then
    if f->>'status'='final' or i->'unitCost' is distinct from 'null'::jsonb then return false; end if;
   else
    cost:=round(a*r);
    if cost>9007199254740991 or jsonb_typeof(i->'unitCost') is distinct from 'number' or (i->>'unitCost')::numeric<>cost then return false; end if;
   end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
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
  if not coalesce(f->>'currency' in ('JPY','KRW','SGD','USD','EUR','CNY','MYR','THB','HKD','AUD','GBP','AED','AFN','ALL','AMD','AOA','ARS','AWG','AZN','BAM','BBD','BDT','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD','CAD','CDF','CHF','CLP','CNH','COP','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','FJD','FKP','GEL','GGP','GHS','GIP','GMD','GNF','GTQ','GYD','HNL','HTG','HUF','ILS','IMP','INR','IQD','IRR','ISK','JEP','JMD','JOD','KES','KGS','KHR','KMF','KPW','KWD','KYD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MZN','NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SHP','SLE','SOS','SRD','SSP','STN','SYP','SZL','TJS','TMT','TND','TOP','TRY','TTD','TVD','TWD','TZS','UAH','UGX','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XCG','XOF','XPF','YER','ZAR','ZMW','ZWG') and f->>'source' in ('manual','frankfurter','exchange-api'),false) then return false; end if;
  if f->'rate'='null'::jsonb then r:=null;
  elsif jsonb_typeof(f->'rate')='string' and f->>'rate' ~ '^[0-9]{1,12}(\.[0-9]{1,6})?$' then r:=(f->>'rate')::numeric;
  else return false; end if;
  if r is not null and r<=0 then return false; end if;
  if f ? 'rateDate' then
   if jsonb_typeof(f->'rateDate') is distinct from 'string' or f->>'rateDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or to_char((f->>'rateDate')::date,'YYYY-MM-DD')<>f->>'rateDate' then return false; end if;
  end if;
  if f->>'source' in ('frankfurter','exchange-api') and (r is null or not (f ? 'rateDate')) then return false; end if;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.tippo_valid_workspace(jsonb),public.tippo_valid_workspace_before_batch_fx(jsonb),public.tippo_valid_workspace_before_fx(jsonb) from public,anon,authenticated;
commit;
