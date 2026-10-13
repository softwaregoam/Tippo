-- Optional shop/brand and product option snapshots. Existing workspaces remain valid.
begin;
do $$ begin
 if to_regprocedure('public.tippo_valid_workspace_before_recap(jsonb)') is null then
  alter function public.tippo_valid_workspace(jsonb) rename to tippo_valid_workspace_before_recap;
 end if;
end $$;
create or replace function public.tippo_valid_workspace(d jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare p jsonb; o jsonb; i jsonb; k text;
begin
 if not public.tippo_valid_workspace_before_recap(d) then return false; end if;
 for p in select value from jsonb_array_elements(d->'products') loop
  foreach k in array array['store','color','size'] loop
   if p ? k and (not public.tippo_text(p->k) or length(p->>k)>80) then return false; end if;
  end loop;
 end loop;
 for o in select value from jsonb_array_elements(d->'orders') loop
  for i in select value from jsonb_array_elements(o->'items') loop
   if i ? 'store' and (not public.tippo_text(i->'store') or length(i->>'store')>80) then return false; end if;
  end loop;
 end loop;
 return true;
exception when others then return false;
end $$;
revoke all on function public.tippo_valid_workspace(jsonb),public.tippo_valid_workspace_before_recap(jsonb) from public,anon,authenticated;
commit;
