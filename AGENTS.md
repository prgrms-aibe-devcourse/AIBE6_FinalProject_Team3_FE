# AGENTS.md

이 파일은 이 저장소에서 작업하는 AI 코딩 에이전트(Claude Code, Codex, Cursor 등)를 위한 가이드입니다.

## 커맨드

```bash
npm install
npm run dev              # 개발 서버 실행 (http://localhost:3000)
npm run build             # 프로덕션 빌드 + 타입 체크
npm run lint               # ESLint 검사
npm run format:check       # Prettier 포맷 검사
npm run format             # Prettier 포맷 적용
npm run start               # 프로덕션 빌드 실행
```

## 환경 변수

`.env.example`을 `.env.local`로 복사합니다:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=your_kakao_javascript_key
```

`NEXT_PUBLIC_USE_MOCK_DATA=true`로 설정하면 Spring Boot API 대신 `app/mocks/init`의 mock 데이터로 앱이 동작합니다 — 로컬에 백엔드가 안 떠 있을 때 유용합니다.

백엔드 엔드포인트 경로는 `/api` 접두사를 절대 붙이지 않습니다(팀 컨벤션) — `NEXT_PUBLIC_API_BASE_URL`은 origin만 담아야 합니다.

## 아키텍처

- Next.js App Router, TypeScript, Tailwind CSS, React 18.
- **데이터 흐름**: `page.tsx`(Server Component) → `app/services` → 실 API 모드: `app/lib/api`(`requestJson<T>()`가 `ApiResponse<T>.data`를 unwrap하고, 2xx가 아니거나 `success: false`거나 파싱 실패 시 `ApiError`를 던짐) / mock 모드: `app/repositories` + `app/mocks/init` → `app/mappers`(DTO → domain 변환) → 컴포넌트 props.
- 화면은 `fetch`를 직접 호출하지 않고 엔드포인트 문자열도 직접 다루지 않습니다 — 오직 `app/services`만 담당합니다. 백엔드 URL이 바뀌어야 하면 `services`만 고치면 됩니다.
- `*Client.tsx` 컴포넌트만 브라우저 상태(`useState`, 브라우저 이벤트, 탭, 검색/필터, 지도/차트 렌더링, 체크리스트 토글)를 가집니다. 나머지는 전부 Server Component로 유지합니다.
- `app/types/api.ts`(백엔드 DTO 형태)와 `app/types/domain.ts`(화면용 형태)는 겉보기에 똑같아 보여도 분리해서 유지합니다 — 백엔드 필드명 변경, 표시값 가공, Tailwind className 매핑을 DTO 레이어로부터 격리하기 위함입니다. `app/mappers`의 매퍼는 DTO → domain 변환만 담당하고 새로운 비즈니스 로직을 넣으면 안 됩니다(형태 변환만).
- `app/data`(탭 라벨, 카드 문구 등 정적 UI 문구/설정)와 `app/mocks/init`(DTO 형태의 가짜 API 응답)은 비슷해 보이지만 용도가 다릅니다 — 혼동하지 않도록 주의합니다.

## 문구 정책 (Copy / wording policy)

이 서비스는 확정적인 위험 판정, 안전 보장, 허위매물 단정을 절대 내리지 않습니다 — 사실 기반·개수 기반 표현만 사용합니다.

피해야 할 표현: `안전합니다`, `위험 매물입니다`, `허위매물입니다`, `위험도`, `LOW`/`MEDIUM`/`HIGH` 등급, 점수화(예: `점수 80점`).

권장 표현: `확인 필요 신호 N개`, `전세가율 82%`, `시세보다 20% 낮은 가격이에요 — 이유를 확인해보세요`, `이 결과는 참고용 정보이며 안전을 보장하지 않습니다`.

## 현재 화면 목록

- `/` — 랜딩
- `/login`, `/signup`, `/oauth/callback` — 인증
- `/home` — 홈
- `/properties`, `/properties/register`, `/properties/[id]`, `/properties/[id]/edit` — 매물
- `/properties/[id]/checklist` — 매물별 체크리스트
- `/properties/[id]/risk-analysis` — 위험도 분석 전용 페이지
- `/checklists` — 내 체크리스트 목록
- `/contract/upload`, `/contract/result` — 특약사항 분석
- `/mypage`, `/mypage/password`, `/mypage/profile` — 마이페이지
- `/admin`, `/admin/checklists`, `/admin/reports`, `/admin/users` — 관리자

## 더 자세한 참고 문서

- [docs/FRONTEND_STRUCTURE.md](./docs/FRONTEND_STRUCTURE.md) — 빠른 시작용 구조 가이드, 폴더 역할, "새 기능 추가" 절차
- [docs/FRONTEND_STRUCTURE_DETAIL.md](./docs/FRONTEND_STRUCTURE_DETAIL.md) — 실 API vs mock 흐름 예시, 타입/매퍼 컨벤션, 엔드포인트 초안, 사전 체크리스트
- [docs/specs/](./docs/specs/) — 도메인별(auth/user/property/checklist/contract-analysis/market-data/risk-analysis) 요구사항 대비 실제 구현 대조 문서 + 도메인 간 반복 패턴을 모은 [cross-domain-summary.md](./docs/specs/cross-domain-summary.md). 특정 도메인 작업 전에 해당 문서에서 이미 알려진 갭/이슈가 있는지 먼저 확인하면 좋음
- [README.md](./README.md) — 스택 요약과 시작 커맨드
