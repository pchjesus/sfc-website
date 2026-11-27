# SFC 2.0 — Codex verification handoff

**Current handoff (2026-11-27):** [CURRENT_BASELINE.md](CURRENT_BASELINE.md) is the source for latest Readiness B QA; [V3_READINESS_PLAN.md](V3_READINESS_PLAN.md) defines R0–R8. PR #16 merged; 90 mock cases PASS (see exact runs in baseline), live Auth/RLS/Storage NOT RUN, D1 SQL candidate unapplied and real accounts deferred. Below is the historical 2.0 checklist, not evidence of real execution; apply current preflight and file-publication restrictions.

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
13. As superadmin, use **계정 관리 → 데이터 백업(JSON)**. Inspect that the archive contains all six CMS tables and includes deleted drafts/revisions. Note the archive contains sensitive unpublished content, and **does not** include original Storage objects or Auth accounts. Test exporting with 0 and multiple posts. No import/restore UI is implemented.
14. Security negative tests **using non-admin token**, not service role: attempt `cms_posts.insert`, `cms_people.insert`, `cms_sessions.update`, `cms_site_settings.update`, `cms_admins.insert`, Storage upload, `cms_post_revisions.insert` — all must fail. Anonymous SELECT of future scheduled/draft/deleted posts should return zero.
15. Accessibility: keyboard tab order, focus visibility, modal close focus, contrast, reduced-motion preferences, narrow-screen overflow, soft reveal animations.

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

## 2026-11-25 verification and fixes

Baseline: fetched `origin/main`, `067684cccceebf6507b1b9939e20ac3cb52be341`.
The worktree was clean before this review. No production data, Auth account,
Storage object, database policy or migration was changed.

### Confirmed defects addressed

- Editor selection was allowed during a save; late responses could replace the
  selected article. Block user selection until the save completes and cancel
  the previous editor's timers when selecting another article.
- Manual saves unconditionally reapplied the response and cleared dirty state,
  discarding text entered while the request was pending. Compare raw input and
  selected files; retain newer input, scratch and dirty state, then autosave
  remaining draft edits. Track file input changes as unsaved work.
- Draft saves reapplied a server response whose trigger clears `scheduled_at`.
  Preserve the intended local schedule and include it in session scratch.
  Scratch now retains raw inputs (including invalid URLs) and is scoped to the
  verified user. Files themselves cannot be restored from sessionStorage.
- Failed/conflicting autosaves retried indefinitely. Stop automatic retries on
  failure, display failure state and leave input available for explicit retry.
- Revision restoration of a draft started an automatic write despite promising
  an explicit save. Restore into the form without scheduling a write; subsequent
  normal edits still use draft autosave. Discard stale history responses after
  article selection changes.
- Permanent deletion lacked the update-version guard used by edit/trash/restore.
  Require matching `updated_at` and an actually returned deleted row.
- Public content shared Studio's persistent authenticated client; a superadmin's
  broad RLS read could include scheduled posts. Use a separate nonpersistent,
  anonymous client and explicitly filter release time in public queries. RLS
  remains authoritative; the browser time filter is an additional constraint.
- Reloading the public feed with no research did not restore the SAMPLE home
  fallback after real research disappeared. Reset visibility in both directions.
- Malformed percent-encoded hashes crashed route rendering. Fall back to home.
- Mobile header controls clipped, and Studio's post grid overflowed at 360px.
  Reduce header gaps and allow the single-column editor/sidebar grid to shrink.
- Use a unique stable key order for backup pagination. The export still does
  not provide a transactionally consistent database snapshot.
- Defer Auth callback checks to a later task (including token refresh), rather
  than potentially calling Supabase Auth while its callback holds a lock.
  Do not discard scratch on a reported sign-out error.

### Reproduce local checks

```bash
npm test
python3 tests/browser-check.py
# Browser suite requires Python Playwright and Chromium on PATH.
```

The browser suite starts and shuts down its own ephemeral HTTP server, blocks
all external requests and injects `tests/fixtures/supabase-mock.js`. It exercises
real application scripts and DOM in Chromium, but does **not** emulate or prove
PostgreSQL RLS, Storage security or real Supabase Auth behavior. Fixture data and
addresses are artificial test inputs only. Screenshots are written under `/tmp`.
A baseline checkout failed the malformed-hash regression with `URI malformed`.

Result: `npm test` passed; all **18 browser scenarios** passed; `git diff --check`
passed. These are local results, not a deployment certification.

Coverage: seven public routes and six Studio panes at 1440/768/360px, mobile menu,
recruitment placeholder/Escape/focus, configured PDF/DOCX link and iframe URLs,
anonymous/nonlisted-user UI rejection, slow manual saves/newer input, autosave,
optimistic conflicts, request errors, scheduled payloads, trash/restore, explicit
revision restoration, guarded permanent deletion, invalid uploads and raw scratch
recovery across reload. Responsive screenshots were inspected; external fonts and
photos were intentionally blocked, so their appearance is not certified.

### Security review and unverified integration

Source review: the integrated SQL removes former role policies/functions, uses
`is_superadmin()` with a protected definer/search path, checks membership for
protected writes, and protects revision creation with a trigger. The superadmin
guard takes `pg_advisory_xact_lock(8820,3)` before counting, rejects a fourth
account, and rejects self/last-account deletion. Public post policies constrain
status, deletion and release time. Storage writes require superadmin membership,
with MIME/size limits; public bucket objects remain publicly readable even after
post deletion. These are source findings, **not live policy introspection**.

Live Supabase Auth settings GET was blocked by the network proxy with HTTP 403.
No usable real test accounts or privileged database connection were supplied.
Consequently the following remain **unverified**:

- Real login/recovery/email delivery, disabled signup and redirect configuration.
- Actual installed RLS/grants, authenticated non-admin write-negative tests,
  forged-token rejection, immediate revocation, concurrent fourth-superadmin
  insertion, and self/last-admin removal in the running database.
- Actual revision trigger output, schedule boundary visibility at database time,
  cross-device concurrent edits, and transactional behavior under failures.
- Real PDF rendering/download bytes, uploaded DOCX, anonymous public Storage GET
  and prohibited upload attempts. Local tests verify link wiring, not these.
- Safari/Firefox, physical touch devices, external image/font rendering and a
  complete accessibility/contrast audit.

Use a separate staging Supabase project with disposable verified admin/non-admin
accounts for those write tests. Do not run historical migrations or destructive
negative tests on production merely to complete this checklist.

### Remaining risks and structure assessment

- Site/recruitment settings and People/Activities do not have the post editor's
  optimistic concurrency guard. Concurrent saves can overwrite another editor;
  avoid simultaneous edits until server-owned versioning is added and tested.
- Settings/structured forms do not share the post editor's scratch/dirty guard.
  Navigating away can lose unsaved changes; in-flight pane reloads may replace
  those forms. The post-editor fixes do not certify these separate forms.
- Draft schedule intent is local scratch, not cross-device server state (the
  existing DB trigger clears schedules on draft rows). Draft file selections
  must be reselected after reload. No offline multi-device merge is provided.
- Public/admin lists are capped at 300 and history at 40. Older direct article
  links can appear missing; export stops rather than silently truncating at its
  safety bound. Concurrent table mutations can still affect paginated exports.
- Uploads and content saves are separate operations. Partial failure/replacement
  may leave public orphan files; never upload private applications. Old public
  media and revision snapshots require an explicit retention policy.
- An already-open public page needs refresh to discover newly released or
  revoked posts; only recruitment status currently refreshes on a timer.
- Hash routes retain generic share/search metadata. Source was pushed to `main`;
  GitHub Pages deployment remains unverified (see publication record below).

Refactoring assessment: **local improvement**, not a rewrite. The existing
framework-free separation of core/public/editor/structured Studio is adequate.
Save-state ownership and tests needed immediate attention; structured-editor
versioning, list pagination and unified dirty/recovery handling are the next
review triggers. No trend of historical bug frequency is asserted.

### GitHub publication record

The validated changes were committed as `c0f5c53` (code and browser regressions)
and `a326450` (verification report), then pushed successfully to both `main` and
`codex/editor-safety-and-responsive-qa`. A read-only `git ls-remote` confirmed
both remote refs at `a326450fceaf83b287e5ab80cf14a83882859270`.

PR creation was attempted with the title “fix: prevent CMS edit loss and improve
responsive verification” and a description of the fixes, all 18 passing browser
scenarios and live-integration gaps. GitHub's GraphQL request failed with
`Forbidden`, so **no PR was created**. The changes are already on `main`; do not
interpret the pushed review branch as an open PR.

The GitHub Actions runs API also returned `Forbidden`. Requesting the public
Pages URL was denied by the network proxy with HTTP 403 before reaching the
site. Thus the Git ref update is confirmed, while Pages build/deployment and
served application content are **unverified**. The proxy response is not
evidence of an application-level HTTP 403 or a failed Pages deployment.


## v2.3 — Motion & interaction overhaul

Integrated above Codex's verification commits; retain all editor save-state,
anonymous-public-client, backup-order, malformed-hash and responsive fixes.
No SQL migrations or production data changes were made in this motion release.

- Shared keyed list reconciliation and position/height transitions for both
  sample and CMS curriculum, Research filters/search/grid, and Updates filters.
- Stable filter controls, animated selected marker, retained DOM when unchanged,
  keyboard-visible focus, open-row identity, interruption/cancellation.
- Contextual entry effects (rise, opposing sides, stagger, image mask), visible-only
  hero motion with pause and synchronized CTA, scroll reading progress.
- Consistent CTA and hover feedback, smooth disclosures and native modal transitions;
  Escape, focus restoration, fallback when the official form is absent.
- Preserve Research filter/layout/scroll on return; public fallback restored
  when live curriculum/people/research is removed.
- Added four mock-browser regression scenarios to the original 18 (motion,
  reverse/rapid filter, sample/live switch, scroll return, reduced motion).
- GitHub Actions runs the original static suite and the extended Chromium suite.
  A test result is valid only if that specific workflow run succeeds.
  Browser fixture tests do not certify live Supabase, physical devices, Safari/Firefox,
  external photos/fonts, actual PDF bytes, or motion visual quality.

## v2.3.1 — Motion pacing and symmetric swaps

- Page 1040ms, Recruitment 1450ms, section reveal 1120ms, mask reveal 1350ms, filter reflow 900ms, photo fade 1650ms, modal 620/480ms. Buttons remain responsive; no intentional delay before state changes.
- Disjoint result sets dissolve without a directional slide; shared items retain identity and move with the same layout timing. Old lists use a noninteractive document-positioned snapshot, removed on completion or interruption. No DB changes.
- Hero pause button removed; three equal-width selection buttons and full-width progress. Click active number to toggle autoplay; focus/hover controls pause temporarily and reduced-motion disables autoplay.
- Application CTA uses distinct coral hover and dark text. Fixed hover-induced horizontal movement in rows; slower disclosures and mobile navigation.
- Three additional Chromium tests assert forward/reverse equal keyframes for one-to-one Research and unequal Activities swaps, and Recruitment duration/color. Existing tests updated to check hero controls and wait for transitions.
- Real visual preference and actual device performance require user review; mock tests do not validate live Supabase.

## v2.3.2 — Balanced pacing

Page 600ms; Recruitment 640ms; reveal 880ms; mask 1050ms; reflow and disclosure 620ms; photo fade 1450ms; modal 460/320ms; hover 260ms. Preserve symmetric swaps, hero controls and reduced-motion support. Raise starting page opacity to improve perceived responsiveness. The prior run passed 24 scenarios but failed the CTA hover assertion; the hover regression now waits for entrance motion to settle and asserts computed color using Playwright's retrying assertion. Explicit CTA hover selector retained. Domain configuration unchanged.

## v2.3.3 — Fine pacing adjustment

Previous v2.3.2 GitHub Actions run 45635951984 completed successfully (static and Chromium). The previously failing CTA hover test passed after its fix. Page 520ms, Recruitment 570ms, content reveal 780ms, mask 950ms, list reflow/disclosure 550ms, photo fade 1350ms, dialog 410/300ms, hover 240ms. Preserve direction-independent motion, CTA, DOM identity and reduced motion. Updated timing assertions; new CI result must be verified separately. No content or database changes.
