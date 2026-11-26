-- D1 candidate, NOT applied. Run only after staging verification and owner approval.
-- Existing policies call is_superadmin(): extend its membership predicate without
-- granting additional SQL privileges to browser clients. Owner provisioning is infrastructure-only.
begin;
create table public.cms_developers (
  singleton boolean primary key default true check(singleton),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.cms_developers enable row level security;
revoke all on public.cms_developers from public,anon,authenticated;
grant select(user_id) on public.cms_developers to authenticated;
create policy "Developer reads own role" on public.cms_developers for select to authenticated
using (user_id=(select auth.uid()));
create function sfc_private.guard_developer()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(8820,3);
  if tg_op='DELETE' then return old; end if;
  if not exists(select 1 from auth.users u where u.id=new.user_id and u.email_confirmed_at is not null) then
    raise exception 'A verified Auth user is required.';
  end if;
  if exists(select 1 from public.cms_admins a where a.user_id=new.user_id) then
    raise exception 'Developer must be outside the operational administrator allowlist.';
  end if;
  return new;
end;
$$;
revoke all on function sfc_private.guard_developer() from public,anon,authenticated;
create trigger sfc_guard_developer before insert or update or delete on public.cms_developers
for each row execute function sfc_private.guard_developer();

create or replace function sfc_private.is_superadmin()
returns boolean language sql stable security definer set search_path=''
as $$
  select (select auth.uid()) is not null and (
    exists(select 1 from public.cms_admins a where a.user_id=(select auth.uid()))
    or exists(select 1 from public.cms_developers d where d.user_id=(select auth.uid()))
  );
$$;
revoke all on function sfc_private.is_superadmin() from public,anon;
grant execute on function sfc_private.is_superadmin() to authenticated;

create or replace function sfc_private.guard_superadmins()
returns trigger language plpgsql volatile security definer set search_path = ''
as $$
declare existing_count int;
declare actual_id uuid;
declare actual_email text;
begin
  perform pg_catalog.pg_advisory_xact_lock(8820,3);
  select count(*) into existing_count from public.cms_admins;
  if tg_op='INSERT' then
    if existing_count>=3 then raise exception '최고관리자는 최대 3명입니다.'; end if;
    if new.user_id is null then
      select id,lower(email) into actual_id,actual_email
      from auth.users where lower(email)=lower(trim(new.email)) and email_confirmed_at is not null limit 1;
    else
      select id,lower(email) into actual_id,actual_email
      from auth.users where id=new.user_id and email_confirmed_at is not null limit 1;
    end if;
    if actual_id is null or actual_email is null then
      raise exception '기존 Supabase Auth 사용자 이메일을 먼저 등록해 주세요.';
    end if;
    if exists(select 1 from public.cms_developers where user_id=actual_id) then raise exception '개발자는 운영 관리자 정원에 등록할 수 없습니다.'; end if;
    new.user_id=actual_id;
    new.email=actual_email;
    return new;
  elsif tg_op='UPDATE' then
    new.user_id=old.user_id;
    new.email=old.email;
    new.created_at=old.created_at;
    return new;
  elsif tg_op='DELETE' then
    if old.user_id=(select auth.uid()) then raise exception '본인 계정은 직접 해제할 수 없습니다.'; end if;
    if existing_count<=1 then raise exception '마지막 최고관리자는 해제할 수 없습니다.'; end if;
    return old;
  end if;
  return null;
end;
$$;
revoke all on function sfc_private.guard_superadmins() from public,anon,authenticated;

-- No owner inserted, no Auth mutations. Old admin count/last/self guards remain.
commit;
