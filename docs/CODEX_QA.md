# SFC 2.0 — Codex verification handoff

**Target:** https://pchjesus.github.io/sfc-website/  
**Private Studio:** https://pchjesus.github.io/sfc-website/admin.html  
**Repository:** `pchjesus/sfc-website`, `main`  
**Backend:** Supabase `nnoicikkennbihjdoivt` (Seoul), PostgreSQL and Supabase Auth.

## Scope delivered

- Public: login confined to top-right header, no visitor signup prompt, fully public Research/Activities/People/Recruitment/Updates.
- Recruit: CTA in Recruitment -> native accessible dialog -> PDF inline preview -> PDF download plus optional DOCX. **No official files uploaded**, so placeholder is honest.
- Backoffice: one `superadmin` permission class only (max three allowed); post drafts with local scratch recovery and debounced **server autosave for drafts**, explicit publication, future scheduled availability, trash/restore, revision previews.
- Studio editors: Home/About copy, People, Activities, Recruitment status/dates/files, superadmin account list.
- Publishable key only. Database RLS controls every protected table and Storage write. No service/secret keys.
- Static SEO improvements: one root canonical, generic OG preview, robots.txt and sitemap.xml. **Per-report social previews are not available on hash routes**, which need static/SSR rendering to support.

## Preflight

```bash
npm test
# or without npm/package install:
node tests/static-check.mjs
```

No package installation needed. Review `sql/sfc-integrated-2.0.sql` before making any additional database changes; migration is **already applied** to the dedicated SFC Supabase project. Do not reapply historic v1.3/v1.4 migrations blindly. The older SQL files are retained as migration history.

## Manual browser QA (desktop 1440px, tablet 768px, mobile 360px)

1. Home nav: top-right LOGIN, mobile menu open/close, menu keyboard Escape, no ADMIN LOGIN in footer. Click LOGIN -> Studio; click Studio homepage -> `index.html#home`.
2. All public tabs load with no sign-in. Research demos clearly labeled SAMPLE while no actual public research exists.
3. Recruitment: Application CTA is always available; without a configured PDF, modal explains form not yet registered and has **no broken download link**. Native Escape, × button, backdrop click, focus restoration.
4. With a test *public* PDF and DOCX uploaded by an approved superadmin, verify preview renders, download/open works without login in new incognito session. Never upload filled application forms or private information into public Storage.
5. Supabase Auth: only first verified user explicitly bootstrapped from SQL Editor can log in. Nonlisted authenticated users are redirected away and cannot view Studio. Public signups should be disabled via Supabase Auth configuration.
6. As approved superadmin, create draft, wait >3 seconds, reload page and verify saved draft; edit and save; publish instantly, verify #updates and #research and home; unpublish and verify gone from public. Check image/PDF upload. Cancel changes and use scratch recovery.
7. Schedule test article 10 minutes into future. Verify not public while future, then visible after scheduled time with no cron. Check client timezone vs UTC storage handling.
8. Move post to trash, verify immediately not public; reopen from Trash, restore; see revision history, restore a previous snapshot into editor and save. Finally permanently delete test post (test content only).
9. Populate site copy. Verify About, first hero slide and recruitment text update on page refresh. Don't allow external HTML to run from text fields.
10. People: add, hide, reorder, edit and remove a sample profile. Public shows actual profiles only when visible. Curriculum: add/edit/hide sessions, public stage filters and inline details, fallback behavior when no published sessions.
11. Recruit: set start/end dates, planned/open/closed, verify automatic time-bound status. Upload PDF and DOCX, test unauthenticated access.
12. Access: add second superadmin by **existing** Auth email. Create max three and attempt a fourth (should fail in DB even under concurrent requests). Verify self-removal and removal of last admin are denied. Removing a superadmin should revoke writes immediately in the next API call.
13. Security negative tests **using non-admin token**, not service role: attempt `cms_posts.insert`, `cms_people.insert`, `cms_sessions.update`, `cms_site_settings.update`, `cms_admins.insert`, Storage upload, `cms_post_revisions.insert` — all must fail. Anonymous SELECT of future scheduled/draft/deleted posts should return zero.
14. Accessibility: keyboard tab order, focus visibility, modal close focus, contrast, reduced-motion preferences, narrow-screen overflow, soft reveal animations.

## Required initial activation

1. Create an Auth user in the SFC Supabase project's Authentication > Users.
2. Disable public signup in Auth providers settings.
3. Allow `https://pchjesus.github.io/sfc-website/admin.html` in Auth redirect URLs for password recovery.
4. In SQL Editor as trusted project owner, bootstrap the first superadmin **after the user exists**:
   ```sql
   insert into public.cms_admins(user_id)
   select id from auth.users where lower(email)=lower('YOUR-ADMIN-EMAIL');
   ```
5. Confirm affected row count = 1; sign in, then manage the other two superadmins through Studio.

**No Auth user currently created by this patch.** Real sign-in, PDF file rendering, role provisioning, and true E2E database write tests remain pending. Static checks are not a replacement for browser/integration tests.

## Risks to audit

- Unsaved local scratch uses sessionStorage and is device-local only. Published posts do **not** auto-publish unsaved edits.
- File replacement produces a new public Storage object; old uploaded media is not automatically garbage-collected. Retention/backup plan and secure deletion of any accidentally uploaded private file should be checked.
- PostgreSQL revisions record every insert/update; test retention/growth under auto-save. Consider future coalescing if drafts are large.
- Actual mail deliverability, password recovery redirect, Supabase signup settings and recovery links are not controllable through these repository files.
- Free-plan project costs and automatic backup depend on plan/usage; establish and test external backup and restore procedure before a real recruitment cycle.
- Hash-based public article routes have limited search indexing and social sharing previews.
- Financial reports need appropriate authorship, source and non-investment-advice disclaimer before publication.
