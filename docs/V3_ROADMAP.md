# SFC v3.x — 개발 로드맵

- 합의일: 2026-11-26 (KST)
- 기준: v2.9, main `9be1e6caef29ee9490527e3b39782ee859d98f8f`
- [PR #8](https://github.com/pchjesus/sfc-website/pull/8) · [v2.9 QA](V2.9_QA_REPORT.md)
- 상태: 소유자와 개발 방향 합의. 개별 구현·DB 변경·main 병합·콘텐츠 발행은 별도 승인.
- 관련: [Studio 편의성 명세](STUDIO_UX_ROADMAP.md) · [v3.0 준비/검증 체크리스트](V3.0_PREFLIGHT.md)

## 1. 목표와 불변 원칙

v1.x는 기반, v2.x는 시각 디자인과 안정화, v3.x는 실제 연구 성과와 운영 체계 완성.
기존 framework-free GitHub Pages + Supabase Auth/PostgreSQL/Storage를 재사용한다. 기존 v2.8.4의 7개 탭별 고유 모션, 사진, 상명대학교 로고, 정보 계층, People/Recruitment의 즉시 읽을 수 있는 구조를 보존한다. 승인되지 않은 카피·인물·수치·날짜·보고서를 만들지 않는다. 초기 연구가 적을 때 불필요한 필터/통계/UI를 늘리지 않는다. 일반 방문자는 로그인 없이 공개 자료를 읽으며, 기존 최대 3인 superadmin 체제를 유지한다. 복잡한 역할·커뮤니티·실시간 주가·AI 투자추천은 범위 밖.

모든 코드 변경은 별도 브랜치 → 검증 → 소유자 검수 → 명시적 병합 승인 → Pages 검증. 콘텐츠 발행은 코드 배포와 별개로 원본/공개 허가 확인 → 비공개 검수 → 명시적 발행 승인 → 익명 브라우저 확인. 공개 저장소의 브랜치/Actions artifact도 비밀 자료 저장에 사용하지 않는다. 운영 Supabase에 승인 없는 계정 생성, 쓰기, 삭제, DDL, 권한 변경을 금지한다. 기존 마이그레이션을 재실행하지 않는다.

## 2. 기준 기능과 확인된 위험

- Research Archive (`js/research-platform.js`): 공개 연구 전환, 제목/기업/산업/저자 검색, 산업 필터, 최신/오래된/제목순, 목록/격자, 6개 페이지네이션, URL 상태 저장, 목록 메타데이터만 조회. Reader (`js/research-reader.js`): 요약, 제목/저자/기업/산업/발행일, 본문, 분석 방법/한계, 자동 목차, PDF 열기/미리보기, 링크 복사.
- Studio (`admin.html`, `js/cms-admin.js`, `js/cms-studio.js`): 자동저장/수동 임시저장, sessionStorage 복구, 예약 발행, 수정 이력, 휴지통, 구조화 사이트/인물/교육과정/모집/계정 편집, JSON 내보내기. 상세 개선은 별도 명세.
- DB: cms_posts, cms_post_revisions, cms_site_settings, cms_people, cms_sessions, cms_admins. 공개 콘텐츠 조회는 RLS; 파일은 공개 sfc-media 버킷.
- v2.9 QA 기록: mock 브라우저 33+8+11+12 시나리오 통과, Codex 1차 P1 2건 수정 후 2차 신규 P0/P1 없음. 당시 RLS/DB grants/Storage 읽기 전용 검사 완료. 실제 인증·CRUD·비인가 토큰·PDF 바이트·계정 복구는 NOT RUN. 당시 Auth 및 CMS 게시물 0건(현재 실측 아님).
- 기존 위험: People/Activities 동시 수정용 version 부재, 고아 파일, JSON만 내보내고 복원/미디어 백업 미비, 해시 주소 공유/검색 제한. 추가 확인: draft 저장시에도 공개 버킷 업로드, 비공개 처리 후 직접 파일 URL 접근 가능. 따라서 파일 공개 승인과 게시물 공개는 다른 개념이다.

## 3. 버전별 범위·순서·완료 기준

### v3.0 — First Publication
목표: 첫 실제 보고서 한 편의 검증된 발행. 자료 없이 공식 연구 콘텐츠를 만들거나 스키마를 추측하여 확장하지 않는다.
1. 원본 확보(최종 PDF, 제목, 저자/팀, 원본 작성일, 공개 허가, 가능하면 원본 표/재무모델).
2. 연구 질문, 산업·기업·재무·가치평가(해당 시), 방법, 가정, 결과, 한계, 출처, 페이지 대응, 공개 권한을 분석. 저자의 결론과 편집자/AI의 검토 의견 구분. 임의 수치/근거 금지.
3. 기존 CMS 필드(title/excerpt/body/research_sector/company/author/method/limitations/attachment_url)를 우선 활용. 시스템 발행일과 원본 작성일 구분, 데이터 기준일/연구 유형/참고문헌은 본문부터 검토. 실제 보고서 유형별로 목차를 구성. 원문 PDF가 최종 근거이며 웹은 요약 및 접근성 있는 설명. 표·차트는 원문에 근거하고 페이지·단위·기간을 표시.
4. 격리된 mock/staging에서 Reader/Home/Research/Updates/Studio를 검수. 소수 보고서는 단순 목록 중심. DEMO는 첫 공식 보고서 공개 시 숨김; 연결 실패와 빈 데이터 구분. PDF 20 MiB 제한 및 모바일 대체 열기 검증.
5. 승인된 계정으로 Auth/RLS/Storage 실환경 게이트 수행. 공개 허가된 최종 파일만 공개 버킷에 업로드하며 사전 공개 금지/예약 파일은 비공개 검수 파일 분리 또는 업로드 연기. 미검증·무단 생산 쓰기 금지.
6. 소유자/학회 공개 승인 후 발행, 비로그인 직접 링크 및 PDF 검증. Studio 개선 S0/S1(저장 안전·상태, 작성 흐름) 중 실제 발행을 막는 문제는 먼저 해결.

완료: 원문과 요약의 내용/수치/인용 일치, 공개 허가, 실제 관리자 및 비인가 차단 검증, 임시저장·미리보기·수정·발행·예약·비공개·휴지통 노출 확인, 실제 PDF 열람, DEMO 전환, 기존 7탭 및 모바일 회귀, 소유자 승인. 미검증 항목은 NOT RUN 및 사유를 남기며 운영 발행 차단 항목을 통과로 표시하지 않는다.

### v3.1 — Research Library
기존 검색을 확장: 기업/산업 명칭 정규화, 동일 기업/산업/후속 연구 관련 연결, 연도·학기·저자(복수 저자)·연구 유형, 필요한 경우 종목코드/키워드. 관련 보고서는 설명 가능한 규칙, 공개 자료만. 기존 query URL 상태 및 뒤로가기 유지. 페이지네이션과 안정적 정렬, 산업 목록 조회의 400행 상한은 데이터 증가 시 보완.
UI 가이드(제안값, 고정 요구 아님): 1–5편은 간단 목록, 6–15편은 검색/산업/정렬, 16편 이상은 필요한 복합 필터 및 보기 전환. 데이터 분포와 사용성에 맞게 조정하며 기존 검색 링크를 깨지 않는다.
완료: 복합 필터, 정확한 관련 연구, 페이지 경계·0건·느린 응답·오류·뒤로가기, 미공개/예약/삭제 비노출, 360/390/768/1440px 및 모션 회귀. 소수 연구에서 화면 복잡도 증가 금지.

### v3.2 — Editorial Operations
Studio S2/S3 중심: 검수 체크리스트/검수 상태(초안→검수→승인 준비→발행; 역할 변경 없이 시작), 공개본과 작업본 분리, 변경 전후 비교, 파일 메타데이터/참조/고아 정리(dry-run, 승인 후), private staging 버킷과 공개 배포 정책, 예약·비공개 파일 수명 관리, People/Activities 낙관적 잠금, 운영 이벤트 로그, 미디어와 JSON 백업 및 격리 복원, 관리자 인수인계.
저장 충돌·파일 공개 위험은 필요시 v3.0으로 앞당긴다. DB 변경은 별도 staging/마이그레이션/rollback 검수 및 승인. 소유자 승인 없는 삭제 금지, revision에서 참조하는 파일도 고려.
완료: 다중 관리자 충돌 시 원본/입력 보존, 잘못된 파일 공개 차단, 실패/재시도/고아 처리 검증, 백업 manifest/체크섬과 실제 미디어 복원 시험, DB 권한 음성 테스트, 감사 기록 및 운영 문서.

### v3.3 — Society Identity
실제 회장 사진·인사말, 운영진 이름/역할/공개 동의, 확정 소개/교육과정, 실제 Activities 기록(계획과 실적 구분), Recruitment 일정·자격·선발·FAQ·공식 빈 PDF/DOCX, 문의 채널. 기존 People/Recruitment 정보 즉시 노출과 디자인 유지. 확정 콘텐츠가 먼저 도착하면 안전 검증 후 앞당길 수 있음.
완료: 실명/사진/일정/연락처 검수 및 공개 동의, 계획/실제 구분, 모바일/키보드 가독성, 모집 상태·파일 없는 경우·공개 다운로드 확인. 개인정보 있는 작성 완료 지원서는 공개 저장소/버킷 금지.

### v3.4 — Public Reach
개별 연구 안정적 slug/URL, canonical, 보고서별 OG/메타데이터, sitemap, 과거 링크 호환. GitHub Pages 정적 생성 또는 대안 비교; 공개 상태와 생성/삭제 동기화, 캐시와 검색엔진 잔존 위험 안내. 비공개가 공개 정적 HTML에서 남는 문제를 먼저 해결. 불필요한 PDF 로딩 제거, 이미지 최적화, 접근성 WCAG 2.2 AA 검토, reduced-motion, 키보드/모달/초점 및 모바일 표.
제안 성능 목표(현장 75백분위 기준, 충분한 샘플 없으면 lab 결과 별도): LCP ≤2.5s, INP ≤200ms, CLS ≤0.1.
완료: 보고서별 공유/직접 접속/메타/sitemap 검증, 비공개 동기화 및 캐시 정책, 기존 hash 링크 호환, 7탭 디자인/모션, 접근성/성능 결과 기록.

## 3.1. 병행 개발 트랙 — Research Importer (RI)

소유자 승인(2026-11-26): 문서 분석 및 게시 초안 자동화 기능을 정식 로드맵에 추가. [Research Importer 상세 명세](RESEARCH_IMPORTER_ROADMAP.md). 외부 AI+JSON 가져오기와 향후 사이트 직접 API 분석을 공통 schema로 연결한다. RI 0.1~0.3은 보고서 도착 전 Studio S0/S1 이후 구현 가능; 실제 문서 분석 품질은 자료 수령 후 검증한다. RI 0.4~1.0은 실제 보고서·비공개 파일 처리·보안·비용 승인 조건을 충족한 뒤 진행한다. AI 직접 발행 금지.
보고서 없이 진행할 작업 패키지 P0~P4 및 검수 기준은 [v3.0 준비 개발 계획](V3.0_PREPARATION_PLAN.md) 참조. 구현과 main 병합은 별도 검수. 문서 승인과 운영 변경 승인 구분.

## 4. 장기 확장 (수요와 데이터 축적 후)

기업별 연구 연혁, 학기별 컬렉션, Annual Research Review, 연구자별 페이지, 원본 기반 재무차트, 후속 연구/가정 비교, 인용 정보 복사, 영문 요약, 독립 도메인, 기수별 운영 인수인계. 우선 기업별 연구 연혁을 검토하되 실제 후속 보고서가 없으면 제작하지 않는다.

## 5. 위험과 공통 품질 게이트

| 위험 | 대응 |
|---|---|
| 비공개 파일/비인가 접근 | P0/P1 후보, v3.0 사전 차단, DB/Storage 직접 권한 테스트 |
| 연구 수치/출처 오류 | 원문 페이지 매핑, 학회 검수 |
| 입력 유실/충돌/파일 고아 | 저장 상태/동시수정/실패 재현, S0/S2 |
| 백업/관리자 교체 | v3.2 실복원·계정 운영 문서 |
| 정적 검색 잔존 | v3.4 공개 동기화 및 캐시 정책 |
| 비용/사용량 | 실제 수요에 맞춰 관리, 유료 전환은 별도 승인 |
| UI/모션 회귀 | 기존 디자인 기준 스크린샷, 7탭/모바일/접근성 검사 |

코드: npm test → 기존 Playwright + 신규 실패 재현 → GitHub Actions → 위험한 저장/권한/파일/복원 변경은 Codex 독립 리뷰 및 수정 후 재검증 → 미해결 P0/P1 없음 → 사용자 검수 → 승인 후 merge → 실제 Pages 확인. mock 테스트와 실제 운영 인증/DB 테스트는 분리. 테스트 결과와 SHA, 실행 링크, NOT RUN/제약을 기록한다.
콘텐츠: 공개 허가 + 학회 내용 검수 + 소유자 발행 승인. 배포 승인과 자료 공개 승인은 서로 대체하지 않는다.

## 6. 근거 자료

- pchjesus. (2026, November 26). *SFC v2.9—운영 기능 전수 검증*. GitHub. https://github.com/pchjesus/sfc-website/blob/main/docs/V2.9_QA_REPORT.md
- pchjesus. (2026). *SFC official website* [Source code]. GitHub. https://github.com/pchjesus/sfc-website/tree/9be1e6caef29ee9490527e3b39782ee859d98f8f
- pchjesus. (2026). *SFC 2.0—Codex verification handoff*. GitHub. https://github.com/pchjesus/sfc-website/blob/main/docs/CODEX_QA.md
- Supabase. (n.d.). *Storage buckets*. https://supabase.com/docs/guides/storage/buckets/fundamentals
