# SFC Official Website

**Sangmyung Financial Club (SFC)** — public research and recruitment website + private editorial Studio.

- Public website: https://pchjesus.github.io/sfc-website/
- Login / Studio: https://pchjesus.github.io/sfc-website/admin.html
- Supabase backend: dedicated SFC project `nnoicikkennbihjdoivt` in Seoul (`ap-northeast-2`)
- Architecture: framework-free GitHub Pages static HTML/CSS/JS + Supabase Auth/PostgreSQL/Storage

## Integrated 2.0 release

**Everyone can browse the site and download official blank application forms without login.** A small LOGIN link is located only in the top-right header. There are no ordinary member accounts, administrator roles, comments or community features.

**Superadmins (maximum three)** are approved by the Supabase database allowlist. Only superadmins can access Studio, write/edit/publish/unpublish/schedule/trash/restore posts, manage files, change public content and add/remove fellow superadmins.

Studio includes:
- **Posts:** public notice, activity and research reports; research tags, company, author, method, limitations, PDF attachment
- **Drafts:** immediate in-tab sessionStorage recovery and debounced server autosave for valid draft content
- **Publication:** scheduled release based on UTC timestamps using PostgreSQL public visibility rules, no cron needed
- **Safety:** revision history captured by database trigger; trash, restore and permanent delete
- **Site content:** home hero intro, About intro, program description, official contact email
- **People / Activities:** managed structured lists replace illustrative placeholders when populated
- **Recruitment:** status, start/end date, audience, meeting details, application instructions; admin upload of blank PDF and optional editable DOCX application forms; public preview modal and download
- **Access:** superadmin allowlist management via existing verified Supabase Auth email; maximum three enforced in serialized DB trigger
- **Content export:** download JSON with posts, revisions, settings, people, sessions and superadmin list; does not include original media files or Auth credentials

The published Research/Updates feed uses database RLS to expose **only published, nontrashed, released posts**. Existing demo reports stay labeled as SAMPLE and are hidden once actual public research is present. No real SFC report, official member bio, application form or dates have been fabricated.

## Run verification

```bash
npm test
# no package installation required
```

Read [docs/CODEX_QA.md](docs/CODEX_QA.md) for browser and Supabase security integration tests. [AGENTS.md](AGENTS.md) is a concise Codex guide.

## Supabase activation (first account)

The dedicated project and migrations are already set up. **The project currently has no pre-created Auth users.** To activate the editor:

1. Create or invite the real initial user in [Supabase Authentication → Users](https://supabase.com/dashboard/project/nnoicikkennbihjdoivt/auth/users). Confirm the email and set a strong private password.
2. Disable open public signups in Supabase Auth settings. Set `https://pchjesus.github.io/sfc-website/admin.html` as a password recovery redirect URL.
3. In the project's SQL Editor only, approve the first trusted superadmin by actual Auth email:
   ```sql
   insert into public.cms_admins(user_id)
   select id from auth.users
   where lower(email) = lower('YOU@EXAMPLE.COM');
   ```
4. Sign in to Studio. Additional superadmins can then be approved through the **계정 관리** tab after their Auth accounts exist.

**Never commit service_role / secret keys, a password or user token.** `js/cms-config.js` only contains a public project URL and publishable API key. Backend RLS is the source of permission enforcement, not the Studio UI.

## Implementation notes

- Migrations already applied to this project (in order):
  `sql/sfc-cms.sql` → `sql/sfc-roles-v1.4.sql` → `sql/sfc-integrated-2.0.sql`.
  Do **not** blindly reapply historical migrations.
- Site is deployed from `main` root via GitHub Pages. A Pages success confirms static distribution, **not** that live Auth and uploads were tested.
- Scheduled published posts become visible when `scheduled_at <= now()`, including on anonymous sessions; times are entered in browser local time and stored as ISO UTC.
- PostgreSQL post revisions capture every save including automatic draft saves. The visible editor can restore a snapshot into its unsaved form, then the superadmin explicitly saves.
- Uploaded files in `sfc-media` are public. Only upload blank recruitment templates and public research attachments. Deleting posts/settings does not garbage-collect old public files automatically.
- **Per-post social sharing cards and search indexing are limited by hash-based routing**; the root has generic Open Graph metadata, robots.txt and sitemap.xml.
- Production backup/restore, email deliverability, mobile visual QA, browser E2E, first admin creation and negative authorization tests require a real approved Auth account. See QA handoff.
- Major structural changes (navigation redesign, code, layout) belong in reviewed GitHub/Codex work, not in an authenticated browser-based code editor.

## Code map

```text
index.html             public routes, login link, application preview dialog
admin.html             private editorial Studio
css/site.css           public design system
css/cms-public.css     live post, curriculum, team styling
css/cms.css            Studio styling
js/site.js             legacy navigation, slides, demo fallback
js/cms-config.js       public-only Supabase connection
js/cms-core.js         safe formatting, client setup and shared helpers
js/cms-public.js       published posts, site settings, public content, recruitment
js/cms-admin.js        superadmin sign-in, posts, history, trash, schedules, uploads
js/cms-studio.js       site/people/sessions/recruitment/access editors
sql/                   applied migration snapshots (not to be rerun blindly)
tests/static-check.mjs dependency-free source validation
docs/CODEX_QA.md       browser integration and security QA matrix
AGENTS.md              Codex instructions
```


## Motion & interaction (v2.3)

The public UI now shares `js/motion.js` and `css/motion.css` for contextual
entrances, keyed filter transitions, layout changes, smooth disclosures,
stable CTA states, modal transitions, hero pause/progress and reduced motion.
Codex's editor and responsive fixes are retained. Run `npm test` and
`python3 tests/browser-check.py` (Playwright Chromium required) for regressions.
See [Codex QA handoff](docs/CODEX_QA.md) for mock-versus-live scope.

### v2.3.1 motion refinement
Longer editorial entrances and symmetric filter dissolves, balanced three-button hero controls (active button toggles autoplay), matching progress track and contrasting Recruitment CTA. See QA report for timings and tests.

### v2.3.2 balanced motion
Most transition durations are now 1.5–2 times the v2.3 baseline; unchanged hero dwell time and symmetric filter transitions. Custom domain not yet configured.

### v2.3.3
Fine adjustment of animation durations toward 1.3–1.8 times v2.3 baseline; previous v2.3.2 static and Chromium checks passed. No new About content or data changes.
