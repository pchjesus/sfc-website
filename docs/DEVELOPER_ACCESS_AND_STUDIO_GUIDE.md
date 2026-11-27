# SFC — Developer access, login design and Studio guide

Current source and QA: [baseline](CURRENT_BASELINE.md); [R0–R8](V3_READINESS_PLAN.md). D3.1 has role-gated Developer pane, diagnostics and JSON export; D4 not run. B login copy implemented.

2026-11-27 · D3.1 frontend and SQL candidate merged; production migration/account activation still deferred.

## Developer / owner account (A3)
- The site's creator requires long-term maintenance access independent of the rotating maximum three operational superadmins. Proposed explicit named developer/owner role, maximum one active owner, separate from three operational seats. No hidden backdoor, hardcoded email/password, secret in frontend, or unauthenticated endpoint. Existing superadmin-only RLS model remains unchanged until a separately reviewed migration is approved.
- Developer uses ordinary verified Supabase Auth account, server-side owner allowlist, MFA where supported, and reauthentication for sensitive actions. Privileges: all normal Studio editorial/configuration functions, maintenance diagnostics and account lifecycle tools; developer-only security actions and recovery are explicit and auditable. GitHub/Supabase infrastructure ownership stays in their respective consoles, not a browser CMS service-role key.
- Operational admins retain normal day-to-day autonomy; cannot grant developer role, alter developer allowlist, or remove owner via Studio. Owner privileges must be approved by society/governance, documented to future operators and transferable/revocable via verified infrastructure owner process. No covert permanent access; least privilege and clear role labels. No automatic developer access to unrelated personal information or applications. Log sensitive changes without secrets.
- Preserve maximum three operational seats and at least one active authorized operational admin after initial onboarding. Account bootstrap and creator's developer role require actual verified email, explicit migration/production approval, staging policy tests and direct negative requests. First-account activation is deferred by owner; developer activation requires separate role migration approval. Do not create a fourth superadmin or bypass existing constraints. Test owner/operational/ordinary/anonymous permissions, concurrent account limits, transfer/revocation, session expiry and audit. No production account creation in this documentation change.

## Login presentation (P2 or independently reviewed cosmetic patch)
- Match public homepage header height, horizontal padding, typography, SFC brand mark, dot color and mobile breakpoints. Preserve public header and existing Studio navigation. Reuse public design tokens or scoped equivalent CSS; do not load conflicting global CSS blindly. Check actual computed dimensions at 360/390/768/1440px, account/logout wrapping and accessible focus.
- Historical copy options (B selected by owner and merged in PR #11):
  - A (recommended): "SFC Studio는 연구보고서 작성, 콘텐츠 발행 및 홈페이지 관리를 위한 운영진 전용 공간입니다. 일반 방문자는 로그인 없이 홈페이지의 모든 공개 콘텐츠를 열람하고 이용할 수 있습니다."
  - B (short): "운영진 전용 로그인입니다. 연구보고서, 학회 활동 및 모집 안내 등 모든 공개 콘텐츠는 로그인 없이 이용할 수 있습니다."
  - C (friendly): "홈페이지 이용에 로그인은 필요하지 않습니다. 이곳은 연구보고서 작성과 홈페이지 관리를 위한 운영진 전용 공간입니다."
- Clearly visible link "홈페이지로 돌아가기". No public sign-up or separate developer login link. Login for authorized maintainers only; public content accessible without account. Do not promise access to internal functionality.

## Studio manual (after feature completion, S3 / v3.2; starter guide after P4)
- Korean operator quick-start plus detailed guide: first login/password recovery, panes, write/edit, automatic and manual saves, recovery/limitations, preview, PDF and public/private file policy, scheduling, publish/unpublish/trash/revisions, Research Importer prompts and JSON, future direct AI analysis only when implemented, homepage/People/Activities/Recruitment, account invitation/revocation/handoff, backup and troubleshooting.
- In-Studio help link to versioned guide and printable PDF option (only after actual UI finalized). Include screenshots from approved mock/staging with no real emails, unpublished reports or tokens. Separate developer maintenance appendix with permissions, verification, rollback, logs and incident response; no secrets or private access instructions in public docs.
- Update guide when feature or policy changes; distinguish implemented vs planned, current version and last checked date. Validate against P4 and actual approved account workflow. R5: online Korean help and starter guide now planned before report intake; final PDF after real account/publication workflow and UI stabilize.
