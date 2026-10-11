-- Resolve masked sender email for legacy feedback without a public_email snapshot.
begin;
create or replace function public.list_public_tippo_feedback()
returns table(id uuid,category text,area text,subject text,message text,email text,created_at timestamptz)
language sql stable security definer set search_path=public as $$
  select f.id,f.category,f.area,f.subject,f.message,
    coalesce(nullif(btrim(f.public_email),''),
      case when position('@' in u.email)>1
        then left(split_part(u.email,'@',1),1)||'***@'||split_part(u.email,'@',2)
        else 'Pengguna Tippo' end),f.created_at
  from public.tippo_feedback f left join auth.users u on u.id=f.owner_id
  where f.public_consent and f.published
  order by f.created_at desc,f.id desc limit 6;
$$;
revoke all on function public.list_public_tippo_feedback() from public;
grant execute on function public.list_public_tippo_feedback() to anon,authenticated;
commit;
