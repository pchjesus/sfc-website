# SFC — 현재 구현 및 검증 기준선

최신화: 2026-11-27 (KST). 코드 기준 Readiness A PR #15의 검증된 후보 `7e08214ff03dfa45a9d37bd282ef23e1382c811f` (이 문서의 최종 변경은 문서 전용). 이전 main D3.1은 `a50a0f380a270a5a2200f7273f16a5f6ac4cbf37`. 이 문서는 역사적 명세의 완료 여부를 판단하는 기준이며, 계획과 실제 운영 활성화를 구분한다. [통합 선행 개발 계획](V3_READINESS_PLAN.md).

## 현재 상태

| 영역 | 코드 반영 상태 | 검증/제약 |
|---|---|---|
| 공개 홈페이지 | v2.8.4 디자인/모션 및 7탭, 연구 목록/Reader/공개 모집 양식 기능 유지 | 모의 회귀 통과. 실제 자료 및 Pages 최신 URL 미확인 |
| P0/P1 | 계정+작업 ID별 sessionStorage 복구, 안정된 신규 글 ID, CAS, 자동/수동 저장, 파일 가드 | 탭 종료·파일 bytes 복구 없음, 충돌 수동 비교, 공개 URL 잔존, 실제 backend 미검증 |
| P2/S1 | 제목/목록 툴바, 글자 수, 검색/유형/정렬, 집중 모드, sticky 저장, 모바일 폭 preview, B안 로그인 | R1 공용 의미 렌더러/TOC, 서식 전용 undo/redo, 읽기 전용 충돌 비교 구현; 완전한 화면 배치 일치, 자동 병합 및 상세 검수 미완료 |
| P3/RI | schema 0.1, 외부 AI 분석 지침, JSON 파일/붙여넣기, 안전 검증, 원문 근거/누락 표시, 신규 draft 적용 후 첫 수동저장 | 분석 자체는 외부 AI; evidence는 작업 중 표시만, 영구 저장/실제 원문 검증/API 없음 |
| P4 | PR #11의 합성 통합 회귀 검증 및 병합 | 71 mock 시나리오 통과; 모든 원래 P2/P4 계획을 완전 구현했다는 뜻 아님 |
| D0/D1/D2/D3.1 | 개발자 1명/운영 관리자 3명 분리 SQL 후보, 역할 조회/전용 탭, 진단 JSON, 7개 Studio 탭 개선, 이메일 CTA 48px 정렬 | PR #13 병합, 82 mock 시나리오 통과. D1 SQL 미적용, D4 실제 개발자 활성화 미실행 |
| R0/R1 | 세션 전환 격리·지연 응답 가드, 공용 Reader, 비교·복제·서식 undo/redo, 공지/활동 템플릿 | 87 mock 시나리오 통과. 이미 전송된 서버 쓰기는 완료될 수 있음; 구조화 미저장 복구 및 실제 Auth/RLS/Storage 미검증 |
| 운영 관리 | 기존 Auth 계정 allowlist 추가/해제, 최대 3명, 본인/마지막 해제 제한, 사이트/모집 CAS, People/Activities 검색·필터, 모집 일정·파일 상태 preview, JSON 백업 | 초대/계정 생성·MFA/회수 실제 검증 없음, People/Activities CAS 없음, 백업 검증/미디어·복원 없음 |
| 공개 Reach | root canonical/OG, robots, root sitemap, 기본 hash/query 탐색 | 개별 연구 SEO/slug, 전체 접근성/성능 검증 미완료 |
| 계정 및 실제 데이터 | 직전 계정 확인 단계의 읽기 전용 조회에서 Auth 0, 승인 관리자 0, developer table 없음, 게시글 0, 세션 0 | 조회 시점 수치, 이후 상태 추정 금지. 계정 생성과 migration 적용 보류 |

## 정확한 QA 증거

- P0~P4: PR [#11](https://github.com/pchjesus/sfc-website/pull/11), main `bd790c5ee49c40ccddd302cd0c3c4fc86ea1942f`. [Run 45789078026](https://github.com/pchjesus/sfc-website/actions/runs/45789078026): 40+8+11+12=71 mock browser scenarios; npm tests PASS. Codex reviewed `6e89b0e`, no additional findings; final copy-only B change `013535e8`. 
- D3.1: PR [#13](https://github.com/pchjesus/sfc-website/pull/13), code `361822bec224b44b81b63f2677a304ccab838e21`; [run 45810406204](https://github.com/pchjesus/sfc-website/actions/runs/45810406204) static/npm/browser SUCCESS: 51+8+11+12=82 scenarios; CTA alignment at 360/390/768/1440px. [Preview QA 45810406290](https://github.com/pchjesus/sfc-website/actions/runs/45810406290) SUCCESS. [Codex receipt](https://github.com/pchjesus/sfc-website/pull/13#issuecomment-7190752343): no major issues reported. Separate security review not run.
- Final candidate `a2128de2b624b5d91732ff48e329975fa44b01d0` differs from 361822b only in documentation. [Run 45810509276](https://github.com/pchjesus/sfc-website/actions/runs/45810509276) and [preview 45810509332](https://github.com/pchjesus/sfc-website/actions/runs/45810509332) both SUCCESS; merged as a50a0f38. All scenarios use mock CMS, not live Auth/RLS/Storage.
- Pages source: main root; approved isolated synthetic demo file `preview/studio-review/index.html` on main, and source snapshot `preview/developer-studio-demo.html`. No live configuration/SDK, no external connections, mock data only, noindex. Existing latest Pages response not independently verified. No operational credentials or reports.
- Historical QA: [V2.9_QA_REPORT.md](V2.9_QA_REPORT.md), [V3.0_P1_QA.md](V3.0_P1_QA.md), [DEVELOPER_D0_D4_QA.md](DEVELOPER_D0_D4_QA.md). Their candidate-era notes are retained as historical evidence; latest status here.

## Readiness A verification
- PR [#15](https://github.com/pchjesus/sfc-website/pull/15): initial 5637db3 npm and 56 browser cases passed; integrated test failed on retired preview selector. Corrected test verifies both method and limitations in the shared DOM. Code candidate 036c82a [quality 46019874948](https://github.com/pchjesus/sfc-website/actions/runs/46019874948) and [preview QA 46019874946](https://github.com/pchjesus/sfc-website/actions/runs/46019874946) SUCCESS. 56+8+11+12=87 mock scenarios. Final 7e08214 changed only QA docs; [quality 46019900562](https://github.com/pchjesus/sfc-website/actions/runs/46019900562) SUCCESS; final duplicate preview workflow was still recording clips at last check. Codex [review receipt](https://github.com/pchjesus/sfc-website/pull/15#issuecomment-7221286984) no findings on 5637db3; subsequent changes limited to test selectors, identical synthetic preview snapshot at approved route and documentation. No separate security review. See [READINESS_A_QA.md](READINESS_A_QA.md).
- Owner approved merge and deployment after QA. Actual latest Pages HTTP response cannot be verified from this environment. No production migrations/accounts/files changed.

## Next starting point
R2 → R3 (Readiness B), in a new chat as requested. R0/R1 core implementation and mock validation done, residual limitations above. R2–R8 not started; follow V3_READINESS_PLAN.md, recheck main and PR #15 release status before coding. After R8, satisfy actual v3.0–v3.4 release gates first; consider v4.x research intelligence, editorial intelligence, society operations and platform sustainability as provisional, evidence-driven themes, not approved implementations. No production migration, account creation, actual report analysis, real content publication, direct AI API, paid environment or separate staging provisioning authorized in this documentation update. Do not silently carry forward stale completion claims. Update this file at each merged package with source SHA, actual QA evidence, NOT RUN and open risks.
