# SFC Website

Official web prototype of Sangmyung Financial Club — **Institutional Finance × Modern Editorial**.

Public site: https://pchjesus.github.io/sfc-website/  
Private editor: https://pchjesus.github.io/sfc-website/admin.html

## v1.3 — CMS foundation

A static GitHub Pages front end with an **optional** Supabase backend.
The public site continues to work without Supabase; the private studio displays a setup notice until an SFC-only project is connected.

- Email/password sign-in with Supabase Auth, persistent session, password reset and sign-out
- Membership verified against a server-side administrator allowlist
- Draft/publish/unpublish/edit/delete with PostgreSQL persistence, update conflict detection and in-tab recovery copy
- Research, notice and activity post types; published-only public feed and article detail route
- Images and PDFs via a public Supabase Storage bucket with admin-only write policies
- Safe, limited plain-text formatting (# headings, - bullets). All text is rendered with textContent, not arbitrary HTML.
- Demo reports remain clearly separate from published SFC posts.

**Backend linked (2026-11-24):** Dedicated SFC Supabase project `nnoicikkennbihjdoivt` (Seoul, ap-northeast-2) is `ACTIVE_HEALTHY`. Database schema and RLS are applied. Public GitHub Pages frontend is connected with its **publishable key only**. Security Advisor: no warnings. Anonymous role has SELECT only (INSERT/UPDATE/DELETE all denied); the first administrator has **not** been provisioned yet, so end-to-end authenticated publishing is still untested.

## Provisioning — requires a new dedicated project

1. **Already complete:** SFC-only project created in Seoul, within the existing organization. Quoted project creation cost: $0/month. Check your actual usage and plan quotas separately.
2. **Already complete:** [sql/sfc-cms.sql](sql/sfc-cms.sql) has been applied as Supabase migrations, with an additional read-policy optimization and author index. RLS is enabled on both CMS tables.
3. In **Authentication > Providers**, turn off public user signups; create/invite the verified initial administrator in **Authentication > Users**. If email confirmation is required, complete it. Never hard-code a password.
4. Copy the administrator's **actual auth.users UUID** from the Supabase dashboard and insert it in the SQL editor:
   ```sql
   insert into public.cms_admins (user_id)
   values ('YOUR-AUTH-USER-UUID');
   ```
   Future administrators must be explicitly approved via the same process. Do not expose a public registration form.
5. In **Authentication > URL Configuration**, add `https://pchjesus.github.io/sfc-website/admin.html` as an allowed redirect URL (for password recovery). Set Site URL to the intended public origin/site.
6. **Already complete:** the SFC HTTPS URL and **publishable key** (`sb_publishable_...`) are set in [js/cms-config.js](js/cms-config.js). These values are public by design. **Never put a secret / service_role key in frontend files, commits, or chat.**
7. Visit `admin.html` and sign in with the approved account. Create a draft, edit it, publish it, then confirm that it appears publicly at `#updates` and disappears when unpublished.
8. Before live rollout, test anonymous access to drafts (must be denied), anonymous insert/update/delete (denied), authenticated non-admin writes (denied), and admin write/read (allowed). Then run Supabase Security Advisors and resolve relevant notices.

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
js/cms-config.js       blank config until backend provisioning
js/cms-core.js         Supabase client, safe public rendering helpers
js/cms-public.js       published feed, research links, article view
js/cms-admin.js        authenticated editor, uploads and data management
sql/sfc-cms.sql        RLS schema, triggers and storage policies
.nojekyll              GitHub Pages uses main/(root)
```

## Deployment

Use **GitHub Pages → Deploy from a branch → main → /(root)**, without a custom Actions deployment setup. Verify the specific commit's Pages build and deploy steps. A successful deployment alone does not prove backend authentication or RLS works.

## Legacy content

All **SAMPLE**, **DEMO** and **PLANNED** records are illustrative mockups, not real SFC research or finalized events. Existing demo Research cards stay separate from published SFC content.
