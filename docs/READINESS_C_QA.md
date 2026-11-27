# Readiness C candidate — R4

R4 local backup validator (v1/v2, SHA-256, limits, table/row/reference checks), no real restore; privacy-safe diagnostic outcome and build identifier, deterministic mock workspace generated from current source, isolated sessionStorage namespace. Candidate design for work-copy/CAS/media/audit/accounts in R4_OPERATIONS_DESIGN.md; no SQL applied. Test fixture copy is not a full restoration engine; checksum is not authenticity; backups are non-atomic and exclude media/Auth. Verification pending. No production changes.
