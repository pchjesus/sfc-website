# SFC v3.0 독립 전체 감사 — 실행 지시서
기준 main b3aa5edeba1f768b03ae7a8a002e416947a63319; 정비 PR candidate는 PR head를 재확인. 코드 변경/병합/배포/운영 DB 변경/계정 생성/실제 보고서 발행은 리뷰 역할에서 금지. 공개 저장소에서 synthetic fixtures만 사용. AGENTS.md, CURRENT_BASELINE.md, V3.0_PREFLIGHT.md 먼저 읽고 npm test와 browser-check.py, integrated-check.py, people-recruitment-check.py, v29-structured-studio-check.py 실행 가능 여부/결과/환경 기록. 코드 리뷰는 전체 파일 범위와 diff를 구분하고 실제 수행하지 않은 것을 NOT RUN으로 표시.

1. 저장/발행: CAS, 자동저장, 무응답/재시도, 세션 전환, 체크리스트 변경 무효화, 예약 시간, 공개→비공개→휴지통→복원, 실패 파일과 공개 URL 잔존.
2. 보안: 소스/SQL/권한 및 Storage 정책, secret leakage, input/XSS/URL/파일 검증, prototype/크기 제한, 관리자 3명 경쟁 조건, RLS 우회/직접 API, 비공개 상태/공개 설정. 운영 DB에는 직접 접속 또는 변경하지 말고 카탈로그 관찰은 별도 증거로만 사용.
3. 전체 공개 UX: root/hash/query/history, 7탭, 조회 실패 및 복구, Reader stale response, PDF modal cleanup, keyboard/reduced-motion/360~1440px, mock workspace isolation and noindex.
4. Importer와 백업: 신규 draft만, field allowlist, JSON malformed/over-limit, evidence warning not truth verification, no API/network before explicit save, backup v1/v2 checksum, partial table failure, no real restore.
5. 공급망 및 배포: pinned Supabase SDK and third-party assets, workflow permissions/secrets, docs consistency, SEO candidate never emits real content. Live network, Lighthouse, WCAG full audit and actual Pages not inferred.
6. 출력: 확인 SHA/실행환경, 실행한 테스트 및 근거, severity P0/P1/P2/P3, 파일/라인·재현·영향·수정안, 확인되지 않은 위험, 출시 차단 여부. P0/P1 없음을 확인하려면 검토 범위와 한계 명시. 코드 리뷰와 독립 보안 리뷰 구분.

## 사전 자체 소스 점검
- 검토 경로: cms-core, cms-public, cms-admin, cms-studio, research-platform, research-importer, cms-backup, integrated SQL, static contracts/quality workflows. 핵심 함수와 관련 테스트를 점검했으나 모든 코드 라인 및 모든 보안 속성을 전수 증명하지 않음.
- 발견: 전체 공개 연결 실패/설정 제거 시 이전 사이트 문구 및 모집 파일/목록 잔존 가능. 정비 후보에서 초기값 복원·실패 표시·모달 정리·회귀 테스트 추가. CI 검증 대기.
- 잔여 알려진 리스크: 공개 파일 URL 잔존, People/Activities 동시 수정 보호 없음, 미디어 복원 없음, 백업 비원자성, 직접 AI API 미연결, 외부 SDK integrity 미설정, 실제 인증·권한·Storage·페이지 응답 미검증. 실제 출시 게이트에서 검토. 현재 자료 없음이 보안 증명은 아님.
