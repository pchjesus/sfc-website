
-- SFC integrated editorial CMS, November 2026. Applied after sfc-roles-v1.4.sql.
-- Remove legacy member/admin roles. Keep a server-side allowlist of at most 3 superadmins.
drop policy if exists "SFC members read allowed profiles" on public.cms_admins;
drop policy if exists "SFC superadmins add members" on public.cms_admins;
drop policy if exists "SFC superadmins edit members" on public.cms_admins;
drop policy if exists "SFC superadmins remove members" on public.cms_admins;
drop policy if exists "Admin can see own membership" on public.cms_admins;
drop policy if exists "SFC admin media read" on storage.objects;
drop policy if exists "SFC admin media upload" on storage.objects;
drop policy if exists "SFC admin media update" on storage.objects;
drop policy if exists "SFC admin media delete" on storage.objects;
drop policy if exists "Authenticated read permitted posts" on public.cms_posts;
drop policy if exists "Public read published posts" on public.cms_posts;
drop policy if exists "Admins create posts" on public.cms_posts;
drop policy if exists "Admins edit posts" on public.cms_posts;
drop policy if exists "Admins delete posts" on public.cms_posts;
drop trigger if exists sfc_validate_member_changes on public.cms_admins;
drop function if exists sfc_private.validate_member_change();
drop function if exists sfc_private.current_member_role();
-- Existing non-superadmin grants are explicitly removed, not silently upgraded.
delete from public.cms_admins where role <> 'superadmin';
alter table public.cms_admins drop column if exists role;

create or replace function sfc_private.is_superadmin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists(select 1 from public.cms_admins a where a.user_id=(select auth.uid()));
$$;
revoke all on function sfc_private.is_superadmin() from public, anon;
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
      from auth.users where lower(email)=lower(trim(new.email)) limit 1;
    else
      select id,lower(email) into actual_id,actual_email
      from auth.users where id=new.user_id limit 1;
    end if;
    if actual_id is null or actual_email is null then
      raise exception '기존 Supabase Auth 사용자 이메일을 먼저 등록해 주세요.';
    end if;
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
create trigger sfc_guard_superadmins before insert or update or delete
on public.cms_admins for each row execute function sfc_private.guard_superadmins();
alter table public.cms_admins enable row level security;
revoke all on public.cms_admins from anon, authenticated;
grant select, insert, delete on public.cms_admins to authenticated;
create policy "SFC superadmins list" on public.cms_admins for select
to authenticated using ((select sfc_private.is_superadmin()));
create policy "SFC superadmins invite" on public.cms_admins for insert
to authenticated with check ((select sfc_private.is_superadmin()));
create policy "SFC superadmins remove" on public.cms_admins for delete
to authenticated using ((select sfc_private.is_superadmin()));

-- Editorial posts, safe public scheduling without a cron/service key.
alter table public.cms_posts add column if not exists deleted_at timestamptz;
alter table public.cms_posts add column if not exists scheduled_at timestamptz;
alter table public.cms_posts add column if not exists research_sector text not null default '';
alter table public.cms_posts add column if not exists research_company text not null default '';
alter table public.cms_posts add column if not exists research_author text not null default '';
alter table public.cms_posts add column if not exists research_method text not null default '';
alter table public.cms_posts add column if not exists research_limitations text not null default '';
alter table public.cms_posts add constraint cms_research_sector_len check (char_length(research_sector)<=100);
alter table public.cms_posts add constraint cms_research_company_len check (char_length(research_company)<=120);
alter table public.cms_posts add constraint cms_research_author_len check (char_length(research_author)<=160);
alter table public.cms_posts add constraint cms_research_method_len check (char_length(research_method)<=2000);
alter table public.cms_posts add constraint cms_research_limits_len check (char_length(research_limitations)<=2000);
create index if not exists cms_posts_visible_idx on public.cms_posts(published_at desc)
where status='published' and deleted_at is null;

create or replace function public.cms_posts_set_dates()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op='UPDATE' then
    new.author_id:=old.author_id;
    new.created_at:=old.created_at;
  end if;
  new.updated_at:=pg_catalog.clock_timestamp();
  if new.status='published' then
    if tg_op='INSERT' or old.status is distinct from 'published'
       or (tg_op='UPDATE' and old.scheduled_at is distinct from new.scheduled_at) then
      new.published_at:=coalesce(new.scheduled_at,pg_catalog.now());
    elsif tg_op='UPDATE' then
      new.published_at:=old.published_at;
    end if;
  else
    new.published_at:=null;
    new.scheduled_at:=null;
  end if;
  return new;
end;
$$;

create policy "SFC visitors read public posts" on public.cms_posts for select
to anon using (status='published' and deleted_at is null
 and (scheduled_at is null or scheduled_at<=now()));
create policy "SFC superadmins read posts" on public.cms_posts for select
to authenticated using ((select sfc_private.is_superadmin())
 or (status='published' and deleted_at is null and (scheduled_at is null or scheduled_at<=now())));
create policy "SFC superadmins create posts" on public.cms_posts for insert
to authenticated with check ((select sfc_private.is_superadmin()) and author_id=(select auth.uid()));
create policy "SFC superadmins update posts" on public.cms_posts for update
to authenticated using ((select sfc_private.is_superadmin()))
with check ((select sfc_private.is_superadmin()));
create policy "SFC superadmins delete posts" on public.cms_posts for delete
to authenticated using ((select sfc_private.is_superadmin()));

-- Revisions are generated only by a protected trigger; users cannot fabricate them.
create table if not exists public.cms_post_revisions(
  id bigint generated always as identity primary key,
  post_id uuid not null,
  snapshot jsonb not null,
  actor_id uuid,
  recorded_at timestamptz not null default now()
);
create index if not exists cms_post_revisions_history_idx on public.cms_post_revisions(post_id, id desc);
alter table public.cms_post_revisions enable row level security;
revoke all on public.cms_post_revisions from anon,authenticated;
grant select on public.cms_post_revisions to authenticated;
create policy "SFC superadmins inspect revisions" on public.cms_post_revisions
for select to authenticated using ((select sfc_private.is_superadmin()));

create or replace function sfc_private.capture_post_revision()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.cms_post_revisions(post_id,snapshot,actor_id)
  values (new.id,to_jsonb(new),auth.uid());
  return new;
end;
$$;
revoke all on function sfc_private.capture_post_revision() from public,anon,authenticated;
drop trigger if exists sfc_post_revision on public.cms_posts;
create trigger sfc_post_revision after insert or update
on public.cms_posts for each row execute function sfc_private.capture_post_revision();

-- Public configuration, editable in Studio by superadmins. NO secrets here.
create table if not exists public.cms_site_settings(
  key text primary key check(key in ('site','recruitment')),
  value jsonb not null default '{}'::jsonb check(jsonb_typeof(value)='object'),
  updated_at timestamptz not null default now()
);
alter table public.cms_site_settings enable row level security;
revoke all on public.cms_site_settings from anon,authenticated;
grant select on public.cms_site_settings to anon,authenticated;
grant insert,update on public.cms_site_settings to authenticated;
create policy "SFC public settings read" on public.cms_site_settings for select
to anon,authenticated using (true);
create policy "SFC superadmin settings insert" on public.cms_site_settings for insert
to authenticated with check ((select sfc_private.is_superadmin()));
create policy "SFC superadmin settings update" on public.cms_site_settings for update
to authenticated using ((select sfc_private.is_superadmin()))
with check ((select sfc_private.is_superadmin()));

create table if not exists public.cms_people(
  id uuid primary key default gen_random_uuid(),
  name text not null check(char_length(trim(name)) between 1 and 100),
  position text not null default '' check(char_length(position)<=130),
  term text not null default '' check(char_length(term)<=80),
  bio text not null default '' check(char_length(bio)<=2000),
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.cms_people enable row level security;
revoke all on public.cms_people from anon,authenticated;
grant select on public.cms_people to anon,authenticated;
grant insert,update,delete on public.cms_people to authenticated;
create policy "SFC visitors read people" on public.cms_people
for select to anon using (visible);
create policy "SFC admin reads people" on public.cms_people
for select to authenticated using (visible or (select sfc_private.is_superadmin()));
create policy "SFC admin adds people" on public.cms_people
for insert to authenticated with check ((select sfc_private.is_superadmin()));
create policy "SFC admin edits people" on public.cms_people
for update to authenticated using ((select sfc_private.is_superadmin()))
with check ((select sfc_private.is_superadmin()));
create policy "SFC admin deletes people" on public.cms_people
for delete to authenticated using ((select sfc_private.is_superadmin()));

create table if not exists public.cms_sessions(
  id uuid primary key default gen_random_uuid(),
  week_label text not null check(char_length(trim(week_label)) between 1 and 20),
  title text not null check(char_length(trim(title)) between 1 and 150),
  summary text not null default '' check(char_length(summary)<=500),
  detail text not null default '' check(char_length(detail)<=2500),
  stage text not null default 'foundation'
    check(stage in ('foundation','application','research')),
  sort_order int not null default 0,
  visible boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.cms_sessions enable row level security;
revoke all on public.cms_sessions from anon,authenticated;
grant select on public.cms_sessions to anon,authenticated;
grant insert,update,delete on public.cms_sessions to authenticated;
create policy "SFC visitors read sessions" on public.cms_sessions for select
to anon using(visible);
create policy "SFC admin reads sessions" on public.cms_sessions for select
to authenticated using(visible or (select sfc_private.is_superadmin()));
create policy "SFC admin adds sessions" on public.cms_sessions for insert
to authenticated with check ((select sfc_private.is_superadmin()));
create policy "SFC admin edits sessions" on public.cms_sessions for update
to authenticated using ((select sfc_private.is_superadmin()))
with check ((select sfc_private.is_superadmin()));
create policy "SFC admin deletes sessions" on public.cms_sessions for delete
to authenticated using ((select sfc_private.is_superadmin()));

-- Asset storage: PDFs and editable DOCX forms; all files in this bucket are publicly readable.
update storage.buckets set file_size_limit=20971520,
allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
where id='sfc-media';
create policy "SFC superadmins media select" on storage.objects for select to authenticated
using (bucket_id='sfc-media' and (select sfc_private.is_superadmin()));
create policy "SFC superadmins media insert" on storage.objects for insert to authenticated
with check (bucket_id='sfc-media' and (select sfc_private.is_superadmin()));
create policy "SFC superadmins media update" on storage.objects for update to authenticated
using (bucket_id='sfc-media' and (select sfc_private.is_superadmin()))
with check (bucket_id='sfc-media' and (select sfc_private.is_superadmin()));
create policy "SFC superadmins media delete" on storage.objects for delete to authenticated
using (bucket_id='sfc-media' and (select sfc_private.is_superadmin()));

insert into public.cms_site_settings(key,value) values
('site','{}'::jsonb),('recruitment','{"status":"planned"}'::jsonb)
on conflict (key) do nothing;

-- FIRST ACCOUNT: Create an Auth user and verify email in Dashboard first.
-- In SQL Editor (not frontend):
-- insert into public.cms_admins(user_id)
-- select id from auth.users where lower(email)=lower('OWNER@EXAMPLE.COM');
