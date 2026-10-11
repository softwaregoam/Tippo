begin;
alter table public.tippo_feedback add column if not exists public_consent boolean not null default false;
alter table public.tippo_feedback add column if not exists published boolean not null default false;
alter table public.tippo_feedback add column if not exists public_email text;

create or replace function public.submit_public_tippo_feedback(p_id uuid,p_category text,p_area text,p_subject text,p_message text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; email_address text;
begin
  result := public.submit_tippo_feedback(p_id,p_category,p_area,p_subject,p_message);
  select email into email_address from auth.users where id=auth.uid();
  update public.tippo_feedback set public_consent=true,
    public_email=case when position('@' in email_address)>1 then left(split_part(email_address,'@',1),1)||'***@'||split_part(email_address,'@',2) else 'Pengguna Tippo' end
    where id=p_id and owner_id=auth.uid();
  return result;
end; $$;
revoke all on function public.submit_public_tippo_feedback(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_public_tippo_feedback(uuid,text,text,text,text) to authenticated;

create or replace function public.list_public_tippo_feedback()
returns table(id uuid,category text,area text,subject text,message text,email text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select id,category,area,subject,message,public_email,created_at
  from public.tippo_feedback where public_consent and published
  order by created_at desc,id desc limit 6;
$$;
revoke all on function public.list_public_tippo_feedback() from public;
grant execute on function public.list_public_tippo_feedback() to anon,authenticated;
commit;
