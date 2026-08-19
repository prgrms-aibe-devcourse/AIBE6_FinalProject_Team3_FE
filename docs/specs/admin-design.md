# 관리자(admin) 도메인 — Frontend 구현 현황 정리

## 배경 / 성격

Backend `docs/specs/admin-design.md`와 같은 성격의 **신규 작성 문서**입니다. Backend가 `/admin/**` API와 인가/감사로그를 다룬다면, 이 문서는 그 API를 실제로 소비하는 **Frontend 쪽 구현**(대시보드/유저 관리/신고 관리/체크리스트 템플릿 관리 화면, 접근 제어, mock 데이터)이 원 계획과 얼마나 일치하는지를 소스 코드 기준으로 정리합니다. 참고한 원본 계획/작업 문서는 backend `admin-design.md`의 "배경" 섹션과 동일합니다.

## 범위

- `app/(main)/admin/**`(대시보드, 유저/신고/체크리스트 관리 페이지 및 하위 클라이언트 컴포넌트/테스트)
- `app/services/admin.ts`(GET), `app/services/adminActions.ts`(mutation), `app/repositories/adminRepository.ts`(mock), `app/mocks/init/admin.ts`(mock 시드 데이터)
- **제외**: 개발용 "관리자로 로그인" 버튼(`DevLoginButton.tsx`)은 auth 도메인 범위라 `auth-design.md`를 참고하세요. 크로스오리진 인증 전환(`MainLayoutGate`, `crossOriginAuth` 분기) 자체의 상세도 auth 문서 범위이며, 이 문서에서는 admin 화면이 그 결정을 어떻게 소비하는지만 다룹니다.

## 주요 화면 / 파일

| 파일 | 역할 |
| --- | --- |
| `app/(main)/admin/layout.tsx`(`AdminLayout`) | role 게이트 — `getCurrentUser()`로 `role === 'ADMIN'` 확인, 아니면 404 동일 화면 |
| `app/(main)/admin/AdminNav.tsx` | 대시보드/유저 관리/신고 관리/체크리스트 관리 탭 네비게이션 |
| `app/(main)/admin/page.tsx` + `AdminDashboardClient.tsx` | 통계 대시보드 — 요약 카드 3개, 추이 라인차트, 분포 차트(recharts) |
| `app/(main)/admin/users/page.tsx` + `AdminUsersClient.tsx` | 유저 검색/필터/권한변경/정지 |
| `app/(main)/admin/reports/page.tsx` + `AdminReportsClient.tsx` | 매물 신고 목록/상세/조치완료·반려 |
| `app/(main)/admin/checklists/page.tsx` + `AdminChecklistTemplatesClient.tsx` | 체크리스트 문항 템플릿 CRUD |
| `app/services/admin.ts` | GET 전용(대시보드/유저목록/신고목록/체크리스트목록 조회) |
| `app/services/adminActions.ts` | mutation + 단건 조회(권한/상태변경, 신고검토, 체크리스트 CRUD, 신고 상세) |
| `app/repositories/adminRepository.ts` | mock 모드 구현체 — `globalThis` 기반 상태 공유(아래 참고) |

## 접근 제어 — 실제로 어떻게 막는지

**전적으로 클라이언트 사이드입니다.** `AdminLayout`이 마운트 시 `getCurrentUser()`(브라우저에서 직접 `/auth/me` 호출)로 role을 확인하고, `ADMIN`이 아니면(또는 실패하면 `unreachable`이 아닌 한) 실제 페이지 콘텐츠(`{children}`) 자체를 렌더링하지 않고 **404와 동일한 화면**을 보여줍니다 — 관리자가 아닌 사용자에게 "이 경로가 존재한다"는 사실 자체를 숨기려는 의도(리다이렉트가 아니라 404를 흉내내는 이유).

- `admin/users`, `admin/reports`, `admin/checklists` 각 페이지는 `AdminLayout`의 `{children}`으로만 마운트되므로, role 확인이 `'authorized'`가 되기 전에는 이 하위 페이지들의 데이터 조회 자체가 실행되지 않습니다(컴포넌트가 아예 렌더되지 않음) — 데이터 유출 경로는 없습니다.
- 다만 실제 보안 경계는 **항상 backend `/admin/**` → `hasRole("ADMIN")`**입니다(backend `admin-design.md` 참고) — 이 프론트 게이트가 우회되거나 아예 없어도(예: JS 비활성, 직접 API 호출) 데이터는 backend가 다시 401/403으로 막습니다. 프론트 게이트는 UX(존재 자체를 숨김) 목적이고 보안의 최종 방어선이 아닙니다.
- `pathname`이 바뀔 때마다(예: `/admin/users` → `/admin/reports`) role을 재검증합니다 — Next.js가 이 레이아웃을 하위 경로 이동에서 리마운트하지 않기 때문에, 이 재검증이 없으면 세션 중 권한이 박탈돼도 admin 화면에 계속 머무는 동안은 이전 `'authorized'` 상태가 남습니다(2026-08-05에 이미 고쳐진 회귀 — 위 "재검증" 로직이 그 수정 결과).
- 진짜 권한 없음(`forbidden`)과 일시적 네트워크/CORS 오류(`unreachable`)를 구분합니다 — 후자까지 404로 접으면 실제 관리자도 일시 장애 때 "페이지 없음"만 보고 재시도해야 한다는 사실조차 알 수 없기 때문입니다.

## 주요 기능 — 요구사항 대비 실제

| 기능 | 실제 구현 |
|---|---|
| 대시보드 | ✅ `AdminDashboardClient` — 요약 카드 3개(신규 가입자/신규 활성 매물/신규 대기 신고), 추이 `LineChart`, 신고 사유별 `BarChart`, 매물 등록 여부별 `PieChart`. 조회 기간(`startDate`/`endDate`)을 URL 쿼리로 관리해 새로고침/공유해도 유지됨 |
| 유저 관리 | ✅ 이메일/닉네임 검색 + 권한/상태 필터 + 페이지네이션. 본인 계정 행은 버튼 대신 "본인 계정" 문구만 표시(backend `rejectSelf`가 항상 거부하는 액션을 프론트에서도 미리 숨김) |
| 신고 관리 | ✅ 상태 필터(기본값 RECEIVED, "전체" 선택 시 `status=ALL`로 URL에 남겨 새로고침에도 유지) + 사유 필터. 상세 모달에서 매물/신고자 정보 확인 후 메모와 함께 조치완료/반려(둘 다 확인 단계 한 번 더 거침 — 되돌릴 수 없는 결정이라) |
| 체크리스트 템플릿 관리 | ✅ 문항 목록(비활성 포함) + 생성/수정/삭제 모달. `code`(자동 주의판정 연결) 선택 필드, 적용 매물유형 체크박스, 백엔드가 모르는 레거시 토큰 보존(`unknownPropertyTypeTokens`) |

## 상태 관리 패턴 — 4개 화면 공통

2026-08-04(크로스오리진 인증 대응, "이 전환 방향의 최종 확정 여부" 참고)에 admin 화면 전체가 Server Component에서 client component로 전환되면서, 4개 화면이 동일한 패턴을 공유합니다.

- **재조회**: `router.refresh()`가 다시 가져올 Server Component 데이터가 없어 no-op이므로, `page.tsx`가 `reload*()` 콜백을 `onMutated` prop으로 자식(`*Client.tsx`)에 내려주고 mutation 성공 시 자식이 직접 호출합니다.
- **경쟁 상태 방지**: 필터를 빠르게 바꾸면 먼저 보낸 느린 응답이 나중 응답보다 늦게 도착할 수 있어, `requestIdRef`로 매 호출에 순번을 매기고 응답이 왔을 때 최신 호출인지 확인한 뒤에만 state를 반영합니다(`admin/users`, `admin/reports`, `admin/checklists` 3곳 모두 동일).
- **에러 후 재조회 시 잔여 데이터 정리**: 조회 실패 시 `setData(undefined)`로 이전(다른 필터의) 목록이 최신인 것처럼 보이는 걸 막고, 성공 시 `setLoadError(undefined)`로 이전 에러 배너가 남지 않게 합니다.
- **브라우저 뒤로/앞으로가기 동기화**: 검색창/필터 select의 로컬 state는 `useState(filters.x)`로 최초 1회만 seed되므로, `filters` prop이 바뀔 때마다(뒤로가기 등) 로컬 state를 다시 맞추는 effect가 4개 화면 모두에 있습니다.

## 비기능 요구사항 — 대조

| 항목 | 실제 |
|---|---|
| 관리자 아닌 사용자에게 페이지 존재 비노출 | ✅ 404 동일 화면(리다이렉트 아님) |
| 접근 제어 재검증 | ✅ 경로 이동마다(`pathname` 의존성) |
| 진짜 권한없음 vs 일시적 오류 구분 | ✅ `unreachable` 상태로 분리, "다시 시도" 버튼 제공 |
| mutation 실패 시 사용자에게 원인 노출 | ✅ `resolveErrorMessage()`로 backend `ApiError.message`를 그대로 표시(400/409는 관리자가 바로 고칠 수 있는 원인 문구) |
| 되돌릴 수 없는 결정에 확인 단계 | ✅ 권한변경/정지/신고처리 전부 확인 모달 한 번 더 거침 |
| 페이지 크기/입력값 방어 | ✅ `page` 쿼리파라미터 `parsePageParam()`으로 정규화(NaN/음수 방지), 메모 500자 제한(backend `@Size(max=500)`과 일치) |

## 요구사항에 없던 추가 구현

- **본인 계정 액션 숨김**(2026-08-03) — backend가 항상 거부하는 액션을, 눌러도 실패하는 버튼을 그대로 두는 대신 프론트에서 먼저 숨김
- **신고 상태 필터의 `status=ALL` 명시적 유지**(2026-08-03) — 파라미터를 생략하면 서버(프론트 자체 기본값)가 최초진입으로 오인해 RECEIVED로 되돌아가버리는 것을 방지
- **매물 등록 여부별 유저 분포 파이차트**(2026-08-03) — 원래 "역할별 유저 분포"였다가 교체(backend `admin-design.md` 참고)
- **체크리스트 템플릿 폼의 `unknownPropertyTypeTokens` 보존**(2026-08-04) — 백엔드는 자유 텍스트 컬럼이라 프론트가 모르는 값이 있어도 무시하지 않고 보존 후 재저장

## Mock 모드 — 스키마/비즈니스 규칙 정합성

- **스키마(타입) 정합성**: `app/types/api.ts`의 `Admin*Dto` 타입들을 backend 실제 응답 DTO(`AdminUserListItemResponse`, `AdminStatsSummaryResponse` 등)와 필드 단위로 대조한 결과, **불일치 없음** — mock이 반환하는 객체 구조는 실제 API 응답과 동일한 필드/타입을 갖습니다.
- **비즈니스 규칙 정합성**: ⚠️ **스키마와 달리 검증 로직은 미러링하지 않습니다.** `adminRepository.ts`의 mock 함수들(`updateMockAdminUserRole`/`updateMockAdminUserStatus`/`createMockAdminChecklistItemTemplate`/`updateMockAdminChecklistItemTemplate`/`reviewMockAdminPropertyReport`)은 다음을 전혀 검사하지 않습니다:
  - 본인 계정 권한/상태 변경 금지(`AdminUserController.rejectSelf`)
  - 마지막 활성 관리자 강등/정지 방지(`rejectIfLastActiveAdmin`)
  - 체크리스트 `code`/`itemType` 짝 검증, 활성 `code` 중복 방지, 마지막 활성 문항 삭제/비활성 방지
  - 신고 셀프리뷰 방지, RECEIVED 상태에서만 검토 가능하다는 제약
  
  즉 mock 모드에서는 위 제약을 위반하는 액션도 화면상으로는 전부 "성공"합니다. 이미 2026-08-04 작업 문서에 "기존 관례(예: 자기 자신 권한 변경 금지도 mock에는 없음)를 그대로 따랐다"고 의도적으로 기록된 한계이며, 이번 조사에서도 재확인만 하고 별도 findings로 새로 다루지 않았습니다(로컬 개발 편의용 mock의 알려진 트레이드오프).

## 남은 이슈 / 확인 필요 총정리

1. **감사로그를 확인할 화면이 없음** — backend가 `admin_audit_logs`에 저장은 하지만 조회 API가 아직 없어(backend `admin-design.md` 참고), 프론트에도 당연히 감사로그 화면이 없음. API가 생기면 후속 작업 필요.
2. **mock 모드 비즈니스 규칙 미러링 부재** — 위 "Mock 모드" 섹션 참고. 로컬 개발용 한계로 이미 알려짐.
3. 크로스오리진 인증(`crossOriginAuth`) 전환 자체의 상세(어느 페이지가 어떤 이유로 client component가 됐는지 등)는 auth 도메인 문서/작업기록(`2026-08-05-*` 문서들)에 더 자세히 있음 — 이 문서는 admin 화면이 그 결정을 소비하는 결과만 서술.

## 전수조사 결과 (2026-08-12)

`app/(main)/admin/**` 전체(layout/nav/dashboard/users/reports/checklists 및 테스트), `app/services/admin.ts`/`adminActions.ts`, `app/repositories/adminRepository.ts`, `app/mocks/init/admin.ts`, `app/types/api.ts`의 `Admin*Dto` 타입 전체를 코드 기준으로 전수조사했다. 아래는 기존 문서(팀의 2026-08-03~08-05 자체 조사)에 없던 새 발견만 담았다.

### 버그/정확성

1. 특별히 발견된 이슈 없음. 4개 화면(대시보드/유저/신고/체크리스트)의 `requestIdRef` 기반 경쟁 상태 방지, `clampToValidPage`(목록이 줄어 현재 페이지가 무효해질 때 자동 보정), 브라우저 뒤로/앞으로가기 시 로컬 state 재동기화 effect를 실제 호출 순서까지 추적했고 로직 결함은 찾지 못했다.

### 보안

특별히 발견된 이슈 없음. 접근 제어가 클라이언트 사이드([위 "접근 제어" 섹션](#접근-제어--실제로-어떻게-막는지) 참고)라는 점 자체는 설계상 의도된 것이고(진짜 방어선은 backend), 자식 페이지(`admin/users` 등)의 데이터 조회가 `AdminLayout`의 `'authorized'` 상태 이전에는 마운트조차 되지 않는다는 것(컴포넌트 트리 구조로 확인)을 확인해 최소한 "role 게이트 통과 전에 admin 데이터가 먼저 로드되는" 종류의 실제 유출 경로는 없음을 검증했다.

### 코드 품질 (중복/구조/일관성)

1. ~~**`admin/users/page.tsx`가 `getCurrentUser()`를 부모 `AdminLayout`과 별개로 한 번 더 호출한다.** `AdminLayout`(`app/(main)/admin/layout.tsx:39`)이 이미 role 게이트 목적으로 `getCurrentUser()`를 호출해 `/auth/me`를 한 번 부르고, 그 결과로 `'authorized'`가 되어야만 자식이 마운트된다. 그런데 `admin/users/page.tsx:90`가 "본인 계정" 판단에 필요한 `currentUserId`를 얻기 위해 같은 `getCurrentUser()`를 **또** 호출한다 — `/admin/users`에 진입할 때마다(또는 `pathname` 변경으로 레이아웃이 재검증할 때마다) `/auth/me`가 실질적으로 두 번 왕복한다.~~ — ✅ **(2026-08-12 해결)** `admin/layout.tsx`가 role 게이트 시 확인한 `userId`를 `AdminCurrentUserContext`(+ `useAdminCurrentUser()` 훅)로 하위에 내려주도록 바꿨고, `admin/users/page.tsx`는 더 이상 `getCurrentUser()`를 직접 호출하지 않는다(관련된 `currentUserId`/`currentUserError` 로딩 상태와 에러 화면 분기도 함께 제거). (참고: backend `admin-design.md`의 코드 품질 2번이 지적한 "3개 컨트롤러의 중복 로깅 코드"와 결이 비슷한, "이미 상위에서 확인한 것을 하위에서 다시 확인하는" 유형의 중복이었다.)
2. ~~`AdminStatsSummaryDto`(`app/types/api.ts:533-537`)의 `totalUsers`/`totalProperties`/`pendingReports` 필드명이 backend DTO(`AdminStatsSummaryResponse`)의 이름을 그대로 물려받아 동일한 "이름이 실제 의미(기간 내 신규 발생분)와 어긋난다"는 문제를 프론트 타입에도 그대로 갖고 있다~~ — ✅ **(2026-08-12 해결)** backend와 함께 `newUsers`/`newProperties`/`newPendingReports`로 변경(`types/api.ts`, `AdminDashboardClient.tsx`, `adminRepository.ts` mock 데이터까지 함께 반영).
