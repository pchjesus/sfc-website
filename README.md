# SFC Website

Official web prototype of Sangmyung Financial Club — **Institutional Finance × Modern Editorial**.

Public site: https://pchjesus.github.io/sfc-website/  
Private editor: https://pchjesus.github.io/sfc-website/admin.html

## v1.4 — CMS with three-level access control

A static GitHub Pages front end with an **optional** Supabase backend.
The public site continues to work without Supabase; the private studio displays a setup notice until an SFC-only project is connected.

- Email/password sign-in with Supabase Auth, persistent session, password reset and sign-out
- Role-aware membership: **superadmin (max 3)**, **admin**, and **member**
- Superadmins can add verified Auth accounts by email, promote/demote roles and remove members in Studio
- Admins can create/edit/publish/delete articles, but cannot change roles; members have public read-only access
- PostgreSQL enforces the 3-superadmin limit with an advisory-lock-protected trigger, prevents removal of the last superadmin and prevents self-demotion
- Draft/publish/unpublish/edit/delete with PostgreSQL persistence, update conflict detection and in-tab recovery copy
- Research, notice and activity post types; published-only public feed and article detail route
- Images and PDFs via a public Supabase Storage bucket with admin-only write policies
- Safe, limited plain-text formatting (# headings, - bullets). All text is rendered with textContent, not arbitrary HTML.
- Demo reports remain clearly separate from published SFC posts.

**Backend linked (2026-11-24):** Dedicated SFC Supabase project `nnoicikkennbihjdoivt` (Seoul, ap-northeast-2) is `ACTIVE_HEALTHY`. Database schema and RLS are applied. Public GitHub Pages frontend is connected with its **publishable key only**. Security Advisor: no warnings. Anonymous role has SELECT only (INSERT/UPDATE/DELETE all denied); the first superadministrator has **not** been provisioned yet, so end-to-end authenticated publishing is still untested.

## Initial administrator setup and login

1. **Already complete:** SFC-only project created in Seoul, within the existing organization. Quoted project creation cost: $0/month. Check your actual usage and plan quotas separately.
2. **Already complete:** [sql/sfc-cms.sql](sql/sfc-cms.sql) has been applied as Supabase migrations, with an additional read-policy optimization and author index. RLS is enabled on both CMS tables.
3. **Already complete:** [sql/sfc-roles-v1.4.sql](sql/sfc-roles-v1.4.sql) has been applied. It adds membership roles and secure administration policies. The superadmin limit is enforced at the database level.
4. In **Authentication > Providers**, turn off public user signups; create/invite the first trusted superadministrator in **Authentication > Users**, then have them verify their email. Never hard-code a password. The project currently has no Auth users or approved members.
5. In Supabase SQL Editor, bootstrap the **first** superadministrator with their actual email (replace the placeholder with the registered email):
   ```sql
   insert into public.cms_admins (user_id, role)
   select id, 'superadmin' from auth.users
   where lower(email) = lower('FIRST-ADMIN@EXAMPLE.COM');
   ```
   Check that exactly one row was added. Do not create an open "first user becomes superadmin" registration flow.
6. After this, the first superadministrator signs in at `admin.html` and opens **회원·권한 관리**. To add anyone, first create/invite their account in Authentication > Users. Then enter their email in Studio and select `member`, `admin` or `superadmin` (at most three total). Grant the minimum role they need.
7. In **Authentication > URL Configuration**, add `https://pchjesus.github.io/sfc-website/admin.html` as an allowed redirect URL (for password recovery). Set Site URL to the intended public origin/site.
8. **Already complete:** the SFC HTTPS URL and **publishable key** (`sb_publishable_...`) are set in [js/cms-config.js](js/cms-config.js). These values are public by design. **Never put a secret / service_role key in frontend files, commits, or chat.**
9. Visit `admin.html` and sign in with the approved account. Create a draft, edit it, publish it, then confirm that it appears publicly at `#updates` and disappears when unpublished.
10. Before live rollout, test anonymous access to drafts (must be denied), anonymous insert/update/delete (denied), authenticated non-admin writes (denied), and admin write/read (allowed). Then run Supabase Security Advisors and resolve relevant notices.

### Data safety

- PostgreSQL is the authoritative source. Saving as a **draft** writes to the server and survives other devices.
- The editor maintains a temporary **sessionStorage** recovery copy for unsaved changes; this is not a substitute for clicking Save. It is removed on save/logout. Avoid shared computers for confidential drafts.
- Updates compare the previously read `updated_at` value before saving to prevent accidental overwrites.
- Uploaded attachments go to the **public** `sfc-media` bucket. Never upload private documents; removing a post does not automatically delete uploaded files (clean up unused media in Supabase Storage manually).
- Supabase backup, restore, and retention availability depend on plan. Set and test an export/restore process before production; don't assume automatic free-tier backups. A monthly CSV/SQL export and pre-release backup are sensible minimums.
- The CDN client is version pinned to `@supabase/supabase-js@2.119.2`. Do not unpin without testing.
- Email delivery, Auth provider and redirect URL configuration are managed in Supabase; web UI alone does not enable them.

## Project structure

```text
index.html             public site (Home, About, Research, Activities, People, Recruitment, Updates)
admin.html             separate private editorial studio
css/site.css           existing design
css/cms-public.css     CMS public styles
css/cms.css            CMS admin styles
js/site.js             route and legacy interactive screens
js/cms-config.js       connected SFC Supabase URL + public publishable key
js/cms-core.js         Supabase client, safe public rendering helpers
js/cms-public.js       published feed, research links, article view
js/cms-admin.js        authenticated editor, uploads and data management
sql/sfc-cms.sql        base RLS schema, triggers and storage policies
sql/sfc-roles-v1.4.sql  role migration, 3-superadmin cap and additional RLS policies
.nojekyll              GitHub Pages uses main/(root)
```

## Deployment

Use **GitHub Pages → Deploy from a branch → main → /(root)**, without a custom Actions deployment setup. Verify the specific commit's Pages build and deploy steps. A successful deployment alone does not prove backend authentication or RLS works.

## Legacy content

All **SAMPLE**, **DEMO** and **PLANNED** records are illustrative mockups, not real SFC research or finalized events. Existing demo Research cards stay separate from published SFC content.
