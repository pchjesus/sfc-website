# R4 operations design — proposal, NOT applied
Baseline 4085ba93de1f216dc7d70930ccaa3ef83a5c3fec. Existing production three-superadmin model unchanged. No migrations, live accounts, Storage changes or API connections authorized. Private infrastructure needs separate approval and local/staging validation first.

| Area | Candidate interface and constraints | Verification / rollback |
|---|---|---|
| Working copies | Separate internal work table keyed by post_id and editor; base_version, revision, review fingerprint, explicit publication transaction/CAS. Public cms_posts stays source of truth; no public grant on drafts. | Negative anonymous reads, concurrent edit/restore; keep old reader and revert client before migration rollback. |
| People/Activities | Add updated_at with server-maintained version; compare loaded version in every update/delete. | Two clients, zero affected rows conflict, no input loss; rollback clients before removing version. |
| Media | Private staging, approved final copy only; manifest object_id/path/bucket/content type/size/hash/approval/reference state. Public URL persists after post unpublish. No public draft bytes, no signed URL in public records. | Anonymous private GET denied, role and upload validation, expiry; no deletion before inventory, backup and approval. |
| Orphan review | Read-only dry-run: inventory minus references across current posts, revisions and recruitment settings; unknown/failed scan blocks deletion. Candidate path is not proof of orphanhood. | Compare snapshot, retention grace and concurrent new reference; report only, manual deletion separately authorized. |
| Audit | Server-written append-only actor/action/target/revision/time; no credentials or raw documents in audit payload. | Verify unauthorized write denied and actor not forgeable; export least data. |
| Backup | v2 JSON SHA-256 integrity + schema checks, v1 compatibility; media/Auth/developer membership not included. Multi-query export is not a transaction-consistent snapshot. | Isolated synthetic restore comparison only; do not restore arbitrary user JSON into production. Future real backup requires media manifest, protected account mapping, tested restore/rollback. |
| Accounts | Existing operational role remains. Separate approved developer migration, invitations, MFA, recovery/revocation and session expiry verified before rollout. | Negative token/direct API checks; emergency recovery tested before changes. |

Proposed transaction and SQL interfaces require review against actual installed schema, local/staging migration, RLS tests and separately approved rollout. This document is not executable SQL or verified production security.
