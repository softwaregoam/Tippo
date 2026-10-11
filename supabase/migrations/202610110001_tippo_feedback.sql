-- Run in Supabase SQL Editor after the workspace migration.
begin;
create table if not exists public.tippo_feedback (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('criticism','suggestion','issue')),
  area text not null check (area in ('general','jastip','po')),
  subject text not null check (char_length(btrim(subject)) between 3 and 120),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists tippo_feedback_owner_idx on public.tippo_feedback(owner_id,created_at desc);
alter table public.tippo_feedback enable row level security;
drop policy if exists tippo_feedback_read_own on public.tippo_feedback;
create policy tippo_feedback_read_own on public.tippo_feedback for select to authenticated using (owner_id=(select auth.uid()));
revoke all on public.tippo_feedback from anon,authenticated;
grant select on public.tippo_feedback to authenticated;
grant all on public.tippo_feedback to service_role;

create or replace function public.submit_tippo_feedback(p_id uuid,p_category text,p_area text,p_subject text,p_message text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare account uuid:=auth.uid(); saved public.tippo_feedback%rowtype;
begin
  if account is null then raise exception 'TIPPO_AUTH'; end if;
  if p_id is null or p_category is null or p_category not in ('criticism','suggestion','issue') or p_area is null or p_area not in ('general','jastip','po') or p_subject is null or char_length(btrim(p_subject)) not between 3 and 120 or p_message is null or char_length(btrim(p_message)) not between 10 and 2000 then raise exception 'TIPPO_FEEDBACK_INVALID'; end if;
  insert into public.tippo_feedback(id,owner_id,category,area,subject,message) values(p_id,account,p_category,p_area,btrim(p_subject),btrim(p_message)) on conflict(id) do nothing returning * into saved;
  if saved.id is null then
    select * into saved from public.tippo_feedback where id=p_id and owner_id=account;
    if not found or saved.category<>p_category or saved.area<>p_area or saved.subject<>btrim(p_subject) or saved.message<>btrim(p_message) then raise exception 'TIPPO_FEEDBACK_CONFLICT'; end if;
  end if;
  return jsonb_build_object('id',saved.id,'createdAt',saved.created_at);
end; $$;
revoke all on function public.submit_tippo_feedback(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_tippo_feedback(uuid,text,text,text,text) to authenticated;
commit;
