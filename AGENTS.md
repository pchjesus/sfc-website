# SFC website — Codex coding & QA guide

Official repository: `pchjesus/sfc-website`. Static GitHub Pages site with a Supabase backend.
Read `docs/CODEX_QA.md` first and run `npm test` before changing anything.

- Preserve existing Institutional Finance × Modern Editorial aesthetics: minimal layout, clear hierarchy, modest motion, mobile readable.
- Only three **superadmin accounts** maximum. No public login requirement and no member/admin role. All private functionality must be enforced by Supabase RLS (never rely only on hidden UI).
- Frontend can contain only public Supabase URL and publishable key. Never commit `service_role`, secret key, passwords, tokens, or application submissions.
- Recruitment public PDF/DOCX in `sfc-media` is safe only for **blank application templates**, never completed submissions.
- Keep legacy Research SAMPLE content clearly separate from actual published research.
- Do not generate imaginary official people, reports, dates or application templates.
- SQL file `sql/sfc-integrated-2.0.sql` was already applied; do not rerun it blindly.
- Run the static check then browser E2E including role-negative tests. Report gaps and unverified cases without claiming success.
- If you commit/push, use small reviewed changes, then confirm GitHub Pages deploy and update `docs/CODEX_QA.md`.

## Code Review Rules

### CMS content integrity
- Flag any path that silently discards unsaved edits when navigating Site, Recruitment, People, Activities or posts. After a failed or conflicted save, keep the exact local input and do not imply success. A slow response must not clobber newer form input.
- Multi-admin writes to JSON settings must check the loaded `updated_at` version. Affected-row count of zero is a conflict, not a successful save. People/Activities currently have no version column; do not claim those cross-admin conflicts are protected.

### Supabase and user data boundaries
- Public/anonymous users may read only deliberately published content. Admin writes must be constrained by database RLS and `sfc_private.is_superadmin()`, never by UI state alone. A public `sfc-media` bucket may hold blank application templates and published reports, never completed applications.
- Mock Supabase tests and read-only catalog inspection do not prove live Auth/RLS/Storage enforcement. Never test destructive writes against the real SFC project without explicit approval.

### Review scope and evidence
- Focus on reproducible P0/P1 defects affecting data integrity, unauthorized access, publication visibility or persistent user content; attach the failing path or test. Keep v2.8.4's approved layout, photos, About copy, Research DEMO disclosure, animations and footer logo unchanged.
- Code review must not merge to `main`, deploy GitHub Pages, or make production DB changes. Production security verification is an explicit separate gate.

## v3.x development handoff

Read [v3.x roadmap](docs/V3_ROADMAP.md), [Studio UX specification](docs/STUDIO_UX_ROADMAP.md), and [v3.0 preflight](docs/V3.0_PREFLIGHT.md) before starting v3.x. These are planning documents, not implementation or test results. Keep code approval and content-publication approval separate; public GitHub branches must not contain unapproved reports or private files. Prioritize storage visibility and live authorization gates before first publication.

For the approved Research Importer track, read [RI roadmap](docs/RESEARCH_IMPORTER_ROADMAP.md) and [report-independent preparation plan](docs/V3.0_PREPARATION_PLAN.md). Imports must be validated, allowlisted and draft-only; treat source documents as untrusted data. No AI API, private-file transmission, paid configuration or live backend changes without separate approval. Implement and test using synthetic fixtures before real report intake.

See [developer access, login and Studio guide](docs/DEVELOPER_ACCESS_AND_STUDIO_GUIDE.md). The proposed owner role is not yet implemented; do not bypass the current three-superadmin model or create production accounts without explicit approval and verified RLS. Match login header to the public site; preserve public access without login.
