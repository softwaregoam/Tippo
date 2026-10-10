-- Run once in the Supabase SQL Editor. No service/admin key belongs in Next.js.
begin;

create table if not exists public.tippo_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"batches":[],"customers":[],"products":[],"orders":[]}'::jsonb,
  version bigint not null default 0,
  pro_until timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.tippo_order_usage (
  owner_id uuid not null references auth.users(id) on delete cascade,
  order_id text not null,
  type text not null check (type in ('jastip','po')),
  created_at timestamptz not null default now(),
  primary key (owner_id,order_id)
);
create index if not exists tippo_usage_month_idx on public.tippo_order_usage(owner_id,created_at,type);
alter table public.tippo_workspaces enable row level security;
alter table public.tippo_order_usage enable row level security;
drop policy if exists tippo_read_own_workspace on public.tippo_workspaces;
create policy tippo_read_own_workspace on public.tippo_workspaces for select to authenticated using (owner_id=(select auth.uid()));
drop policy if exists tippo_read_own_usage on public.tippo_order_usage;
create policy tippo_read_own_usage on public.tippo_order_usage for select to authenticated using (owner_id=(select auth.uid()));
revoke all on public.tippo_workspaces,public.tippo_order_usage from anon,authenticated;
grant select on public.tippo_workspaces,public.tippo_order_usage to authenticated;

create or replace function public.tippo_money(v jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
begin
  return coalesce(jsonb_typeof(v)='number' and v::text ~ '^[0-9]+$' and v::numeric<=9007199254740991,false);
exception when others then return false;
end; $$;
create or replace function public.tippo_text(v jsonb,required boolean default false) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(jsonb_typeof(v)='string' and length(v#>>'{}')<=4020 and (not required or length(trim(v#>>'{}'))>0),false);
$$;
create or replace function public.tippo_valid_workspace(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; o jsonb; i jsonb; total numeric; purchase numeric:=0; revenue numeric:=0; qty numeric:=0; item_ids text[]:='{}'; q numeric; costs numeric:=0;
begin
  if jsonb_typeof(d) is distinct from 'object' or octet_length(d::text)>10485760 then return false; end if;
  foreach k in array array['batches','customers','products','orders'] loop
    if jsonb_typeof(d->k) is distinct from 'array' or jsonb_array_length(d->k)>100000 then return false; end if;
    if exists (select 1 from jsonb_array_elements(d->k) e where not public.tippo_text(e->'id',true)) then return false; end if;
    if (select count(*) from jsonb_array_elements(d->k))<>(select count(distinct e->>'id') from jsonb_array_elements(d->k) e) then return false; end if;
  end loop;
  for v in select value from jsonb_array_elements(d->'batches') loop
    if not public.tippo_text(v->'name',true) or not public.tippo_text(v->'origin') or (v->>'type') not in ('jastip','po') or (v->>'status') not in ('open','closed','completed') or not public.tippo_money(v->'directCosts') or not public.tippo_text(v->'closeDate') then return false; end if;
    if v->>'type' is null or v->>'status' is null then return false; end if;
    if v->>'closeDate' <> '' and (v->>'closeDate' !~ '^\d{4}-\d{2}-\d{2}$' or to_char((v->>'closeDate')::date,'YYYY-MM-DD')<>v->>'closeDate') then return false; end if;
    costs:=costs+(v->>'directCosts')::numeric;
  end loop;
  for v in select value from jsonb_array_elements(d->'customers') loop
    if not public.tippo_text(v->'name',true) or not public.tippo_text(v->'phone') then return false; end if;
  end loop;
  for v in select value from jsonb_array_elements(d->'products') loop
    if not public.tippo_text(v->'name',true) or not public.tippo_text(v->'variant') or not public.tippo_text(v->'sku') or not public.tippo_money(v->'unitPrice') or not (v ? 'unitCost') or not (v->'unitCost'='null'::jsonb or public.tippo_money(v->'unitCost')) or jsonb_typeof(v->'active') is distinct from 'boolean' then return false; end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(d->'products') e where e->>'sku'<>'' group by lower(e->>'sku') having count(*)>1) then return false; end if;
  for o in select value from jsonb_array_elements(d->'orders') loop
    if not exists(select 1 from jsonb_array_elements(d->'batches') b where b->>'id'=o->>'batchId') or not exists(select 1 from jsonb_array_elements(d->'customers') c where c->>'id'=o->>'customerId') then return false; end if;
    if o ?| array['product','productId','quantity','unitPrice','unitCost'] then return false; end if;
    if not public.tippo_money(o->'serviceFee') or not public.tippo_money(o->'shippingCharge') or not public.tippo_money(o->'paid') or not public.tippo_text(o->'notes') or not public.tippo_text(o->'createdAt',true) or not public.tippo_text(o->'date',true) then return false; end if;
    if o->>'date' !~ '^\d{4}-\d{2}-\d{2}$' or to_char((o->>'date')::date,'YYYY-MM-DD')<>o->>'date' or o->>'createdAt' !~ '^\d{4}-\d{2}-\d{2}T' then return false; end if;
    perform (o->>'createdAt')::timestamptz;
    if o->>'status' is null or o->>'status' not in ('new','purchased','ready','shipped','done','cancelled') then return false; end if;
    if jsonb_typeof(o->'items') is distinct from 'array' or jsonb_array_length(o->'items') not between 1 and 100 then return false; end if;
    total:=(o->>'serviceFee')::numeric+(o->>'shippingCharge')::numeric; q:=0;
    for i in select value from jsonb_array_elements(o->'items') loop
      if not public.tippo_text(i->'id',true) or (i->>'id')=any(item_ids) or not public.tippo_text(i->'product',true) or not public.tippo_text(i->'variant') or not public.tippo_text(i->'color') or not public.tippo_text(i->'size') or not public.tippo_money(i->'quantity') or (i->>'quantity')::numeric<1 or not public.tippo_money(i->'unitPrice') or not (i ? 'unitCost') or not (i->'unitCost'='null'::jsonb or public.tippo_money(i->'unitCost')) then return false; end if;
      item_ids:=array_append(item_ids,i->>'id');
      if i->'productId' is not null and i->'productId'<>'null'::jsonb and not exists(select 1 from jsonb_array_elements(d->'products') p, jsonb_array_elements(d->'batches') b where p->>'id'=i->>'productId' and b->>'id'=o->>'batchId' and b->>'type'='po') then return false; end if;
      total:=total+(i->>'quantity')::numeric*(i->>'unitPrice')::numeric;
      purchase:=purchase+(i->>'quantity')::numeric*coalesce((i->>'unitCost')::numeric,0);
      q:=q+(i->>'quantity')::numeric;
    end loop;
    if (o->>'paid')::numeric>total or (o->>'status'='cancelled' and (o->>'paid')::numeric<>0) then return false; end if;
    if exists(select 1 from jsonb_array_elements(d->'batches') b where b->>'id'=o->>'batchId' and q*(b->>'directCosts')::numeric>9007199254740991) then return false; end if;
    revenue:=revenue+total; qty:=qty+q;
  end loop;
  return greatest(revenue,purchase+costs,qty,costs)<=9007199254740991;
exception when others then return false;
end; $$;

-- Private helpers are not callable by browser/anonymous clients.
create or replace function public.tippo_workspace_result(p_owner uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('data',w.data,'version',w.version,
    'subscription',jsonb_build_object('tier',case when w.pro_until>now() then 'pro' else 'free' end,'expiresAt',w.pro_until),
    'usage',coalesce((select jsonb_agg(jsonb_build_object('orderId',u.order_id,'type',u.type,'month',to_char(u.created_at at time zone 'Asia/Jakarta','YYYY-MM'))) from public.tippo_order_usage u where u.owner_id=p_owner),'[]'::jsonb))
  from public.tippo_workspaces w where w.owner_id=p_owner;
$$;
create or replace function public.get_tippo_workspace() returns jsonb
language plpgsql security definer set search_path='' as $$
declare account uuid:=auth.uid();
begin
  if account is null then raise exception 'TIPPO_UNAUTHORIZED'; end if;
  insert into public.tippo_workspaces(owner_id) values(account) on conflict(owner_id) do nothing;
  return public.tippo_workspace_result(account);
end; $$;

create or replace function public.save_tippo_workspace(p_data jsonb,p_expected_version bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare account uuid:=auth.uid(); w public.tippo_workspaces%rowtype; o jsonb; btype text; known public.tippo_order_usage%rowtype; canonical jsonb:='[]'; is_pro boolean; new_current boolean:=false; month_start timestamptz:=date_trunc('month',now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta';
begin
  if account is null then raise exception 'TIPPO_UNAUTHORIZED'; end if;
  if not public.tippo_valid_workspace(p_data) then raise exception 'TIPPO_INVALID'; end if;
  insert into public.tippo_workspaces(owner_id) values(account) on conflict(owner_id) do nothing;
  select * into w from public.tippo_workspaces where owner_id=account for update;
  if p_expected_version is null or w.version<>p_expected_version then raise exception 'TIPPO_CONFLICT'; end if;
  is_pro:=coalesce(w.pro_until>now(),false);
  if not is_pro and jsonb_array_length(p_data->'products')>5 and exists(select 1 from jsonb_array_elements(p_data->'products') p where not exists(select 1 from jsonb_array_elements(w.data->'products') old where old->>'id'=p->>'id')) then raise exception 'TIPPO_PRODUCT_LIMIT'; end if;
  for o in select value from jsonb_array_elements(p_data->'orders') loop
    select b->>'type' into btype from jsonb_array_elements(p_data->'batches') b where b->>'id'=o->>'batchId';
    select * into known from public.tippo_order_usage where owner_id=account and order_id=o->>'id';
    if found then
      if known.type<>btype then raise exception 'TIPPO_INVALID_ORDER_TYPE'; end if;
    else
      insert into public.tippo_order_usage(owner_id,order_id,type) values(account,o->>'id',btype) returning * into known;
      new_current:=true;
    end if;
    -- Server creation time is authoritative, including Excel and JSON imports.
    canonical:=canonical||jsonb_build_array(jsonb_set(o,'{createdAt}',to_jsonb(to_char(known.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))));
  end loop;
  if not is_pro and new_current and exists(select 1 from public.tippo_order_usage where owner_id=account and created_at>=month_start group by type having count(*)>5) then raise exception 'TIPPO_ORDER_LIMIT'; end if;
  update public.tippo_workspaces set data=jsonb_set(p_data,'{orders}',canonical),version=version+1,updated_at=now() where owner_id=account;
  return public.tippo_workspace_result(account);
end; $$;

revoke all on function public.tippo_money(jsonb),public.tippo_text(jsonb,boolean),public.tippo_valid_workspace(jsonb),public.tippo_workspace_result(uuid),public.get_tippo_workspace(),public.save_tippo_workspace(jsonb,bigint) from public,anon,authenticated;
grant execute on function public.get_tippo_workspace(),public.save_tippo_workspace(jsonb,bigint) to authenticated;
-- Entitlements can only be changed by privileged server-side payment processing.
grant all on public.tippo_workspaces,public.tippo_order_usage to service_role;
commit;
