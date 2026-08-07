# Frontend Structure Guide

`frontend` 작업을 시작하기 전에 보는 요약 문서입니다.
현재 구조는 Next.js App Router, TypeScript, TailwindCSS 기준입니다.

## 핵심 원칙

- 데이터 조회는 `page.tsx` Server Component에서 먼저 처리합니다.
- 검색, 탭, 체크 상태 변경처럼 브라우저 상호작용이 필요한 UI만 `*Client.tsx`로 분리합니다.
- 화면에서 `fetch`를 직접 호출하지 않습니다. 데이터 호출은 `app/services`를 통합니다.
- mock data는 기본 경로가 아닙니다. `NEXT_PUBLIC_USE_MOCK_DATA=true`일 때만 `app/mocks/init` 데이터를 사용합니다.
- API DTO와 화면용 domain 타입은 분리합니다.

## 폴더 역할

```txt
app/
  (main)/        주요 화면 라우트와 공통 레이아웃
  config/        환경변수 기반 설정
  data/          화면 구성용 정적 데이터
  lib/           공통 유틸리티와 API 클라이언트
  mappers/       API DTO -> domain 변환
  mocks/init/    개발 초기 mock DTO
  repositories/  mock 모드 데이터 제공
  services/      실제 API 호출 진입점
  types/         api/domain 타입
  ui/            공통 UI 컴포넌트
```

## 데이터 흐름

실제 API:

```txt
page.tsx -> services -> requestJson -> Spring Boot API
         -> ApiResponse<T>.data -> mapper -> domain -> component props
```

mock 모드:

```txt
page.tsx -> services -> repositories -> mocks/init -> mapper -> domain -> component props
```

## 환경변수

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
NEXT_PUBLIC_USE_MOCK_DATA=false
NEXT_PUBLIC_KAKAO_MAP_APP_KEY=your_kakao_javascript_key
```

- `NEXT_PUBLIC_USE_MOCK_DATA=false`: Spring Boot API 사용
- `NEXT_PUBLIC_USE_MOCK_DATA=true`: `app/mocks/init` 사용
- `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`: 카카오맵 표시용 키

## API 응답 포맷

`requestJson<T>()`는 아래 공통 응답에서 `data`만 반환합니다.

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  } | null;
};
```

`success: false`, HTTP error, JSON 파싱 실패는 `ApiError`로 처리됩니다.

## 타입 기준

- `app/types/api.ts`: 백엔드 request/response DTO
- `app/types/domain.ts`: 화면에서 사용하는 프론트 도메인 타입
- `app/mappers`: DTO를 domain으로 변환

주의:

- 백엔드 DTO에는 Tailwind className을 넣지 않습니다.
- `statusTone`처럼 의미 있는 값만 받고, UI class는 mapper에서 결정합니다.

## Service 기준

`app/services/*.ts` 파일 하나가 도메인 하나에 대응합니다(`auth.ts`, `user.ts`, `properties.ts`, `checklist.ts`, `contract-analysis.ts`, `mypage.ts`). 각 파일 안의 함수 목록은 코드가 원본이라 여기서 따로 나열하지 않습니다 — 새 API가 필요하면 해당 도메인 파일에 함수를 추가하고, 화면에서는 그 함수만 호출합니다.

## Server / Client 분리

예:

```txt
properties/page.tsx            서버에서 getProperties()
properties/PropertiesClient    검색/필터 상태 관리
```

현재 client component(대표 예시 — 전체 목록은 각 라우트 폴더의 `*Client.tsx` 참고):

- `PropertiesClient.tsx`: 검색/필터
- `PropertyDetailClient.tsx`: 지도/차트/삭제/신고 모달 트리거
- `PropertyReportModal.tsx`: 매물 신고 모달
- `ChecklistClient.tsx`: 체크 상태 변경(optimistic update)
- `ChecklistOverviewClient.tsx`: 내 체크리스트 목록 카드
- `ContractResultClient.tsx`: 마스킹 확인 → AI 분석 호출/로딩 → 결과 탭 전환·아코디언·조항별 미니 채팅
- `ProfileClient.tsx`: 프로필 등록/수정 폼(관심지역 3단 select, 닉네임 중복확인)
- `LoginFormClient.tsx` / `SignupFormClient.tsx` / `PasswordUpdateFormClient.tsx`: 인증 폼
- `MainLayoutClient.tsx`: 상단/하단 네비게이션, 로그아웃

## 주요 화면

```txt
/                         랜딩
/login                    로그인
/signup                   회원가입
/oauth/callback           소셜 로그인 콜백(Route Handler)
/home                     홈
/checklists               내 체크리스트 목록(매물별 진행 상태)
/properties               매물 목록
/properties/register      매물 등록
/properties/[id]          매물 상세
/properties/[id]/edit     매물 수정
/properties/[id]/checklist  현장 체크리스트
/contract/upload          특약사항 입력/업로드
/contract/result          특약사항 분석 결과
/mypage                   마이페이지
/mypage/profile           프로필 등록/수정
/mypage/password          비밀번호 변경
```

## 새 기능 추가 순서

1. `types/api.ts`에 request/response DTO 추가
2. 필요하면 `types/domain.ts`에 화면용 타입 추가
3. `mappers`에 변환 함수 추가
4. `services`에 API 함수 추가
5. mock이 필요하면 `mocks/init`와 `repositories`에 추가
6. `page.tsx`에서 service 호출 후 client component에 props 전달
7. `npm run format:check`, `npm run lint`, `npm run build` 확인

## 문구 정책

AGENTS.md 기준으로 확정 판단처럼 보이는 표현은 피합니다.

피할 표현:

- `위험도`
- `LOW`, `MEDIUM`, `HIGH`
- 허위매물 단정
- 안전 보장 표현

권장 표현:

- `확인 필요 신호 N개`
- `전세가율 82%`
- `참고용 정보`
- `실제 계약 전 별도 확인 필요`

## 도메인별 요구사항 대비 구현 현황

각 도메인이 요구사항 명세서와 실제로 얼마나 일치하는지, 뭐가 아직 안 됐는지는 `docs/specs/*.md`에 도메인별로 정리되어 있습니다(`auth-design.md`, `user-design.md`, `property-design.md`, `market-data-design.md`, `checklist-design.md`, `contract-analysis-design.md`, `risk-analysis-design.md`). 여러 도메인에 반복되는 패턴은 `docs/specs/cross-domain-summary.md`에 모아뒀습니다. "다음에 뭘 해야 하는지"는 이 문서들의 "남은 이슈" 절이 이 섹션보다 최신입니다.
