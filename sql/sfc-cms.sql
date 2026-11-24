-- SFC CMS v1.3: run in a NEW, dedicated SFC Supabase project.
-- Never expose a secret/service_role key in the public site.
create extension if not exists pgcrypto;
create table if not exists public.cms_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.cms_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('research','notice','activity')),
  title text not null check (char_length(trim(title)) between 3 and 180),
  excerpt text not null default '' check (char_length(excerpt) <= 350),
  body text not null default '' check (char_length(body) <= 50000),
  status text not null default 'draft' check (status in ('draft','published')),
  cover_url text check (cover_url is null or (char_length(cover_url) <= 2000 and cover_url ~ '^https://')),
  attachment_url text check (attachment_url is null or (char_length(attachment_url) <= 2000 and attachment_url ~ '^https://')),
  author_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz
);
create index if not exists cms_posts_public_idx on public.cms_posts (published_at desc) where status = 'published';
create index if not exists cms_posts_manage_idx on public.cms_posts (updated_at desc);

create or replace function public.cms_posts_set_dates()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.author_id := old.author_id;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  if new.status = 'published' then
    if tg_op = 'INSERT' then
      new.published_at := now();
    elsif old.status is distinct from 'published' or old.published_at is null then
      new.published_at := now();
    else
      new.published_at := old.published_at;
    end if;
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;
drop trigger if exists cms_posts_dates on public.cms_posts;
create trigger cms_posts_dates before insert or update on public.cms_posts
for each row execute function public.cms_posts_set_dates();

alter table public.cms_admins enable row level security;
alter table public.cms_posts enable row level security;
revoke all on public.cms_admins from anon, authenticated;
revoke all on public.cms_posts from anon, authenticated;
grant select on public.cms_admins to authenticated;
grant select on public.cms_posts to anon, authenticated;
grant insert, update, delete on public.cms_posts to authenticated;

drop policy if exists "Admin can see own membership" on public.cms_admins;
create policy "Admin can see own membership" on public.cms_admins
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Visitors read published posts" on public.cms_posts;
create policy "Visitors read published posts" on public.cms_posts
for select to anon, authenticated using (status = 'published');

drop policy if exists "Admins read all posts" on public.cms_posts;
create policy "Admins read all posts" on public.cms_posts
for select to authenticated
using (exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins create posts" on public.cms_posts;
create policy "Admins create posts" on public.cms_posts
for insert to authenticated
with check (author_id = (select auth.uid())
  and exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins edit posts" on public.cms_posts;
create policy "Admins edit posts" on public.cms_posts
for update to authenticated
using (exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())))
with check (exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())));

drop policy if exists "Admins delete posts" on public.cms_posts;
create policy "Admins delete posts" on public.cms_posts
for delete to authenticated
using (exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())));

-- Public media, admin-only writes. Uploading secrets here is prohibited.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('sfc-media','sfc-media',true,15728640,
        array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

drop policy if exists "SFC admin media read" on storage.objects;
create policy "SFC admin media read" on storage.objects
for select to authenticated
using (bucket_id = 'sfc-media'
  and exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())));
drop policy if exists "SFC admin media upload" on storage.objects;
create policy "SFC admin media upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'sfc-media'
  and exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())));
drop policy if exists "SFC admin media update" on storage.objects;
create policy "SFC admin media update" on storage.objects
for update to authenticated
using (bucket_id = 'sfc-media'
  and exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())))
with check (bucket_id = 'sfc-media'
  and exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())));
drop policy if exists "SFC admin media delete" on storage.objects;
create policy "SFC admin media delete" on storage.objects
for delete to authenticated
using (bucket_id = 'sfc-media'
  and exists(select 1 from public.cms_admins a where a.user_id = (select auth.uid())));

-- Bootstrap with the verified Auth user UUID after an administrator is invited.
-- insert into public.cms_admins(user_id) values ('YOUR-AUTH-USER-UUID');
