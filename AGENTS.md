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
