-- Realtime publishes invoice updates; existing owner RLS and column grants remain in force.
begin;
do $$
begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  raise exception 'Supabase Realtime publication is missing';
 end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tippo_pro_invoices') then
  alter publication supabase_realtime add table public.tippo_pro_invoices;
 end if;
end $$;
commit;
