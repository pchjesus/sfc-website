# SFC v3.0 출시 전 정비 / 승인 게이트
2026-11-28 KST. 기준 main `b3aa5edeba1f768b03ae7a8a002e416947a63319`. R0–R8 소스 병합 및 98 mock 시나리오 PASS. [기준선](CURRENT_BASELINE.md) · [정식 발행 검수](V3.0_PREFLIGHT.md) · [전체 감사](V3_FULL_AUDIT.md).

## 1. 이번 정비 범위
- 문서: R8 실제 결과 및 RI/R4/R7 운영 안내 갱신. 신규 정비 PR은 사용자 검토 전 main 병합하지 않음.
- 공개 코드: 연결 전체 실패/설정 행 삭제 시 오래된 공개 정보 제거, 공식 목록 실패 표시, 열린 모집 파일 미리보기 정리, 회복 시 재조회. 기존 UI/모션 보존.
- DB: 읽기 전용 카탈로그 및 보안 advisor 조회, 별도 변경 금지.
- 자동 검증과 별도 Codex 코드/보안 리뷰 요청. 결과는 PR에서 확인; 현재 후보 통과 미확정.
- 실제 Pages HTTP 응답: 이번 외부 조회도 실패; 실제 장애로 단정하지 않음. 사용자 브라우저에서 직접 확인하고 아래 체크리스트에 기록.

## 2. 운영 DB 읽기 전용 관찰 (2026-11-28)
CMS 6개 테이블 모두 RLS 활성화, anon INSERT/UPDATE/DELETE 권한 없음. 게시글 SELECT는 published + not deleted + scheduled_at<=now 또는 null. People/Activities 공개 visible 조건, revisions/admins anon SELECT 불허. settings는 공개 SELECT 허용(공개 문구/빈 양식 URL 전용, 비공개 메모 금지). Storage sfc-media public, 20 MiB, JPEG/PNG/WebP/PDF/DOCX 허용, 변경 정책은 인증된 superadmin. 보안 advisor lints 0. Auth users/admins/posts/people/sessions/media objects 모두 0, developer table 없음. 실제 JWT 기반 요청, CRUD, 직접 파일 다운로드, 초대/회수 및 복원은 NOT RUN. 카탈로그와 advisor는 실환경 접근 제어의 동적 증명이 아님.

## 3. 출시 차단 게이트 (순서 및 승인)
| Gate | 완료 조건 | 지금 상태 |
|---|---|---|
| L0 코드 | 기존 98 + 신규 회귀, Codex 및 별도 보안 검토; 미해결 P0/P1 없음 | candidate pending |
| L1 배포 | Pages 실제 root/admin/mock HTTP와 캐시/버전 확인 | 독립 조회 불가 |
| L2 운영 승인 | 프로젝트 소유자/운영 3명 정책, 최초 관리자·복구 책임자, 비공개 자료 처리·비용 결정 | 별도 승인 |
| L3 권한 | staging/local 또는 승인 환경에서 실제 anon/비관리/관리 JWT 직접 SELECT/CRUD/Storage, 세션 회수/복구, 최대 3 동시 추가 | NOT RUN |
| L4 자료 | 실제 PDF/저자/작성일/공개 허가/출처/근거·개인정보 확인 | 자료 미수령 |
| L5 편집 | Importer I-08 원문 검토, 수치·단위·기간·출처 확인, Reader/PDF 검수 | NOT RUN |
| L6 발행 | 별도 콘텐츠 공개 승인, 최종 PDF만 업로드, 익명 URL/모바일 및 게시 취소 확인 | NOT RUN |

## 4. 실제 운영 정책 후보
- 현재 운영 관리자 최대 3, 일반 회원 계정 없음. 최초 Auth 사용자 생성 및 bootstrap은 소유자 승인 후에만. 공개 가입 차단과 복구 redirect 확인, 관리자별 개별 계정, MFA/회수 정책 결정. 독립 개발자 역할은 별도 migration 및 검증 후; 지금은 활성화하지 않는다.
- 현재 공개 버킷에는 승인된 최종 보고서/이미지/빈 지원서만. 미승인 파일과 완료 지원서 금지. 게시 취소 후 파일 URL 잔존은 발행 전 고지. 즉시 취소 가능해야 하는 자료는 private staging/배포 설계 승인 전 발행 금지.
- 백업 JSON은 Auth/미디어/개발자 미포함, 여러 조회의 비원자적 결과, 체크섬은 진위 보증 아님. 운영 복원은 별도 승인·실제 훈련 전 제공하지 않음.
- 출시 직후 사용자 불편·오류는 severity, 재현 경로, 환경, 예상/실제 결과, 자료 노출 여부를 기록. 계정·토큰·미공개 자료는 public issue/PR 금지.

## 5. 수동 검수 체크리스트 (운영 쓰기 없는 경로)
- [ ] 공식 root 및 각 7탭: PC/모바일, 사진/모션/텍스트/메뉴/뒤로가기, 직접 링크, DEMO 구분.
- [ ] Studio mock: 관리자/개발자 전환, 신규 초안/검수/저장 오류/가져오기·미리보기/예약/취소/복구, 백업 검사, 초기화.
- [ ] 키보드 Tab/skip/Escape/초점 복구, 200% 확대 및 reduced motion, 좁은 폭/가로 스크롤.
- [ ] 실제 root/admin/mock URL, HTTP/배포 SHA 확인. GitHub Pages 최신 응답을 확인할 수 없는 환경이라면 NOT RUN 기록.
- [ ] 비공개 자료 없이 발견사항 작성, P0/P1은 출시 전에 해결. 모든 실환경 쓰기 및 콘텐츠 발행은 별도 승인.
URLs: https://pchjesus.github.io/sfc-website/ · https://pchjesus.github.io/sfc-website/preview/studio-review/ · https://pchjesus.github.io/sfc-website/admin.html

## 6. 근거
- Supabase. (n.d.). *Row level security*. https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase. (n.d.). *Storage buckets*. https://supabase.com/docs/guides/storage/buckets/fundamentals
- pchjesus. (2026, November 28). *Readiness G — R8 Public Reach and RC candidate* [Pull request]. GitHub. https://github.com/pchjesus/sfc-website/pull/21
