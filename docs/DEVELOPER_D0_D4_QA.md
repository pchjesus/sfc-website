# D0–D4 — Developer Access candidate

Status (2026-11-27): D0–D3.1 source merged as PR #13, a50a0f38; SQL candidate is NOT applied. D4 actual activation deferred by owner. 82 mock browser scenarios PASS; no real account created. See CURRENT_BASELINE.md for exact runs.

## Architecture
- Existing Studio and auth flow; independent singleton `public.cms_developers` allowlist. Only the matching authenticated user can read the user_id column, no browser writes. Infrastructure owner provisions/transfers/revokes after explicit approval. Do not store passwords, developer email, service-role key or user metadata in code.
- Existing 23 CMS/Storage policies use sfc_private.is_superadmin() (read-only production inspection performed). Reuse this predicate for approved developer membership; admin policies, author preservation, visitor visibility and file limits are otherwise unchanged. Existing guard keeps 3 admin limit, self-removal/last-admin restriction; owner guard uses same advisory lock, verified Auth and prevents overlapping owner/admin membership. Initial zero admin state is allowed; once a first admin is added the last-admin restriction holds.
- Login uses existing admin membership first, then owner membership. Missing owner table before migration fails closed for non-admin; normal existing admin remains compatible. Developer tab has read-only exact-count diagnostics and links to GitHub / account management. No privileged logs, service secrets, direct deployment actions or actual backup restore.
- Current account management adds/removes roles for existing verified Auth users, not Auth user invitation/deletion. D5 covers true invitations, audit, isolated staging project, restore and advanced diagnostics.

## Preview
`preview/developer-studio-demo.html` self-contained snapshot of actual admin markup/CSS/JS and test double; no actual configuration, external SDK, real network, login or server writes. CSP connect-src none, form-action none. Download raw HTML from GitHub and open locally; role switch reloads in-memory fixtures. Synthetic titles/emails only. Do not use for real content. It is a development preview only; never use a query flag to bypass production login. Owner-approved synthetic review file was separately added to main at preview/studio-review/index.html; source snapshot also merged in PR #13. Keep noindex, no live config and network denial; do not link it as real Studio.

## Verification gate
- Browser role tests at 1440/768/390/360, admin absence of owner tab, role revocation simulation, separate cap + account rotation, read-only diagnostic counts, standalone preview role switch and no external request. Existing 71 cases run unchanged alongside these additions.
- Static checks: no browser write grants for owner table, singleton constraint, confirmed email, shared lock, no production config/external scripts in demo.
- Separate actual Supabase staging test required: use verified fixture users for owner, 3 admins, extra admin, regular user, unconfirmed account; run direct REST or SET LOCAL ROLE + JWT claims on isolated project, not production. Verify owner and admins can read/write appropriate CMS rows, anon and regular users cannot read drafts or mutate, owner membership SELECT restricted to self and all browser insert/update/delete denied, admin cap and overlapping memberships reject even concurrent insert, self/last admin cannot be removed, owner removal revokes membership on next DB request; test storage and Auth session separately. Run advisors. No staging project configured or migration applied in this turn.
- D4 after owner approves staging and migration: apply to actual Supabase only with explicit approval, check role queries and RLS advisor; compatible frontend already merged, confirm Pages; invite creator's verified email through Auth UI, let them set password privately, provision singleton owner row via authorized infrastructure admin; verify actual session and MFA setup. Keep rollback plan to remove owner row and restore previous predicate/guard; no direct auth deletion. No real reports or credentials in repo.

## Known limitations
- Developer diagnostic counts are current authorized queries, not uptime, server-wide diagnostics or proof of live RLS. Release label is candidate label; actual deployment commit linked via GitHub, not automatically inferred. The account role UI is not the security boundary.
- SQL and real Auth/RLS/Storage have not been executed in staging. Existing production policy inspection only. Current login change adds developer membership lookup; no database writes.

## D3.1 — Studio usability refinement (owner review)
- Access: label in separate row, email and add CTA both 48px high with shared grid alignment; test exact bounding boxes at 360/390/768/1440px. Separate owner identity, remaining seats, duplicate and owner-email precheck. Database guard remains authoritative.
- Posts: status + text + type filter, recent/oldest/title sort, loaded-result count, explicit 300-row cap. No implicit writes.
- Homepage: collapsible live text-only preview of currently edited Hero, About, program and contact fields. Existing versioned save preserved; not a pixel-perfect public page.
- People: search name/position/term, visibility filter, public/private and matching counts. Existing CRUD/order unchanged.
- Activities: search week/title/summary, stage and visibility filters, counts. Existing CRUD/order unchanged.
- Recruitment: live text and file-selection/registered state summary, date order warning, guidance if open without method. Existing file upload and save behavior unchanged; no auto publish.
- Developer: exact authorized count for settings, clarify all posts/draft counts include trash, downloadable JSON of counts and query timestamp only, no emails or content; disables export until valid diagnostic and on logout.
- Full preview is generated from revised actual markup/CSS/scripts and in-memory Supabase mock, with synthetic editable settings, profiles, sessions and posts. No live project configuration or SDK. CSP forbids external connections. For owner review, only the standalone synthetic demo may be independently published at a distinct preview URL; production code, role migration and real accounts remain gated.
- Added four end-to-end standalone browser cases (includes all new controls, diagnostic download and exact CTA alignment). Full D3.1 CI and Codex review must be recorded separately. Earlier D3 candidate passed 78 browser scenarios; does not establish D3.1 pass or live RLS validity.

## Final D3.1 evidence (2026-11-27)
Code 361822b: [QA 45810406204](https://github.com/pchjesus/sfc-website/actions/runs/45810406204) and [preview 45810406290](https://github.com/pchjesus/sfc-website/actions/runs/45810406290) SUCCESS; 51+8+11+12=82 mock cases, alignment at 360/390/768/1440px. Codex receipt on 361822b no major issues. Final docs-only candidate a2128de: runs 45810509276 and 45810509332 SUCCESS; PR #13 merged a50a0f38. Actual Pages URL, live Auth/RLS/Storage, D4 migration/activation remain NOT RUN/unconfirmed. [Current baseline](CURRENT_BASELINE.md), [R4/R5 follow-up](V3_READINESS_PLAN.md).
