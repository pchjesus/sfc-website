
-- SFC v1.4 role management (Supabase PostgreSQL).
-- Existing cms_admins rows remain valid, initially mapped to 'admin'.
-- The first superadmin must be approved once using SQL Editor after Auth user creation.
create schema if not exists sfc_private;
revoke all on schema sfc_private from public;
grant usage on schema sfc_private to authenticated;

alter table public.cms_admins
  add column if not exists role text not null default 'admin'
  check (role in ('superadmin','admin','member'));
alter table public.cms_admins add column if not exists email text;
update public.cms_admins as m set email=lower(u.email)
from auth.users as u where m.user_id=u.id and m.email is null;
create unique index if not exists cms_admins_email_lower_idx
on public.cms_admins (lower(email)) where email is not null;

create or replace function sfc_private.current_member_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select m.role from public.cms_admins m
  where m.user_id = (select auth.uid()) limit 1;
$$;
revoke all on function sfc_private.current_member_role() from public, anon;
grant execute on function sfc_private.current_member_role() to authenticated;

create or replace function sfc_private.validate_member_change()
returns trigger
language plpgsql volatile security definer set search_path = ''
as $$
declare
  canonical_id uuid;
  canonical_email text;
  super_count integer;
begin
  -- Serializes concurrent promotions/insertions so the 3-person limit is atomic.
  perform pg_catalog.pg_advisory_xact_lock(8820, 3);
  select count(*) into super_count from public.cms_admins where role='superadmin';

  if tg_op='INSERT' then
    if new.user_id is null then
      select id, lower(email) into canonical_id, canonical_email
      from auth.users where lower(email)=lower(trim(new.email)) limit 1;
    else
      select id, lower(email) into canonical_id, canonical_email
      from auth.users where id=new.user_id limit 1;
    end if;
    if canonical_id is null or canonical_email is null then
      raise exception '등록된 Supabase Auth 계정이 없습니다. 먼저 해당 이메일의 사용자를 초대하거나 생성해 주세요.';
    end if;
    new.user_id=canonical_id;
    new.email=canonical_email;
    if new.role='superadmin' and super_count >= 3 then
      raise exception '최고관리자는 최대 3명까지 지정할 수 있습니다.';
    end if;
    return new;
  end if;

  if tg_op='UPDATE' then
    if (select auth.uid())=old.user_id and new.role is distinct from old.role then
      raise exception '본인의 관리 권한은 직접 변경할 수 없습니다.';
    end if;
    new.user_id=old.user_id;
    new.email=old.email;
    new.created_at=old.created_at;
    if old.role='superadmin' and new.role<>'superadmin' and super_count<=1 then
      raise exception '최소 1명의 최고관리자가 필요합니다.';
    end if;
    if old.role<>'superadmin' and new.role='superadmin' and super_count >= 3 then
      raise exception '최고관리자는 최대 3명까지 지정할 수 있습니다.';
    end if;
    return new;
  end if;

  if tg_op='DELETE' then
    if (select auth.uid())=old.user_id then
      raise exception '본인 계정은 직접 삭제할 수 없습니다.';
    end if;
    if old.role='superadmin' and super_count<=1 then
      raise exception '마지막 최고관리자 계정은 삭제할 수 없습니다.';
    end if;
    return old;
  end if;
  return null;
end;
$$;
revoke all on function sfc_private.validate_member_change() from public, anon, authenticated;

drop trigger if exists sfc_validate_member_changes on public.cms_admins;
create trigger sfc_validate_member_changes
before insert or update or delete on public.cms_admins
for each row execute function sfc_private.validate_member_change();

alter table public.cms_admins enable row level security;
drop policy if exists "Admin can see own membership" on public.cms_admins;
drop policy if exists "SFC members read allowed profiles" on public.cms_admins;
create policy "SFC members read allowed profiles" on public.cms_admins
for select to authenticated using
(user_id=(select auth.uid()) or (select sfc_private.current_member_role())='superadmin');
drop policy if exists "SFC superadmins add members" on public.cms_admins;
create policy "SFC superadmins add members" on public.cms_admins
for insert to authenticated
with check ((select sfc_private.current_member_role())='superadmin');
drop policy if exists "SFC superadmins edit members" on public.cms_admins;
create policy "SFC superadmins edit members" on public.cms_admins
for update to authenticated
using ((select sfc_private.current_member_role())='superadmin')
with check ((select sfc_private.current_member_role())='superadmin');
drop policy if exists "SFC superadmins remove members" on public.cms_admins;
create policy "SFC superadmins remove members" on public.cms_admins
for delete to authenticated
using ((select sfc_private.current_member_role())='superadmin');

revoke all on public.cms_admins from anon, authenticated;
grant select, insert, update, delete on public.cms_admins to authenticated;

drop policy if exists "Admins read all posts" on public.cms_posts;
drop policy if exists "Authenticated read permitted posts" on public.cms_posts;
create policy "Authenticated read permitted posts" on public.cms_posts
for select to authenticated
using (status='published' or (select sfc_private.current_member_role()) in ('superadmin','admin'));

drop policy if exists "Admins create posts" on public.cms_posts;
create policy "Admins create posts" on public.cms_posts
for insert to authenticated
with check (
  author_id=(select auth.uid())
  and (select sfc_private.current_member_role()) in ('superadmin','admin')
);
drop policy if exists "Admins edit posts" on public.cms_posts;
create policy "Admins edit posts" on public.cms_posts
for update to authenticated
using ((select sfc_private.current_member_role()) in ('superadmin','admin'))
with check ((select sfc_private.current_member_role()) in ('superadmin','admin'));
drop policy if exists "Admins delete posts" on public.cms_posts;
create policy "Admins delete posts" on public.cms_posts
for delete to authenticated
using ((select sfc_private.current_member_role()) in ('superadmin','admin'));

drop policy if exists "SFC admin media read" on storage.objects;
create policy "SFC admin media read" on storage.objects
for select to authenticated
using (bucket_id='sfc-media' and (select sfc_private.current_member_role()) in ('superadmin','admin'));
drop policy if exists "SFC admin media upload" on storage.objects;
create policy "SFC admin media upload" on storage.objects
for insert to authenticated
with check (bucket_id='sfc-media' and (select sfc_private.current_member_role()) in ('superadmin','admin'));
drop policy if exists "SFC admin media update" on storage.objects;
create policy "SFC admin media update" on storage.objects
for update to authenticated
using (bucket_id='sfc-media' and (select sfc_private.current_member_role()) in ('superadmin','admin'))
with check (bucket_id='sfc-media' and (select sfc_private.current_member_role()) in ('superadmin','admin'));
drop policy if exists "SFC admin media delete" on storage.objects;
create policy "SFC admin media delete" on storage.objects
for delete to authenticated
using (bucket_id='sfc-media' and (select sfc_private.current_member_role()) in ('superadmin','admin'));

-- One-time bootstrap after Supabase Auth > Users has the verified account:
-- insert into public.cms_admins (user_id, role)
-- select id, 'superadmin' from auth.users where lower(email)=lower('OWNER@EXAMPLE.COM');
