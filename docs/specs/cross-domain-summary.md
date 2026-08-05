# 도메인 전체 구현 현황 — 요약 (Frontend)

## 배경

`auth-design.md`, `user-design.md`, `property-design.md`, `market-data-design.md`, `checklist-design.md`, `contract-analysis-design.md`, `risk-analysis-design.md` 7개 문서를 도메인별로 작성하면서 반복적으로 나타난 패턴을 모았습니다. Backend `docs/specs/cross-domain-summary.md`와 같은 목적의 문서이며, 여기서는 **화면/클라이언트 관점에서 반복된 문제**만 다룹니다.

## 도메인별 구현 상태 한눈에

| 도메인              | 상태                            | 비고                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`              | 거의 완전 구현                  | **(2026-07-28 갱신)** 확인 필요 1개로 축소 — matcher 누락/비밀번호 정책 중복 해결, 에러 메시지 pass-through는 의도된 설계로 재분류됨. 남은 1개(클라이언트 사이드 자동 재발급 미구현)는 브라우저-side refresh-retry 흐름 미구현 상태로 보류                                                                                                                                       |
| `checklist`         | 거의 완전 구현                  | **(2026-07-31 갱신)** 확인 필요 1개로 축소 — Backend가 helperText 컬럼과 "최종 점검일"(lastCheckedAt + 정렬)까지 마저 구현해서 FE 연동 완료, FE도 완료/미흡 버튼 취소(토글)·미확인 개수 안내·말풍선 UI를 추가로 구현. risk-analysis 연계 신호도 risk-analysis 도메인 연동으로 해소됨. 남은 건 특약사항 분석과의 여정 연결(propertyId 전달·결과 저장, 브레인스토밍만 하고 미해결) |
| `user`              | 부분 구현                       | 회원 탈퇴 완전 미구현, 이미지 업로드 자체가 없음                                                                                                                                                                                                                                                                                                                                 |
| `property`          | 부분 구현, 명세보다 크게 좁음   | 검색/정렬/페이지네이션 없음, 사진 업로드 없음, 시세·위험신호·신고이력·체크리스트진행 표시 전무                                                                                                                                                                                                                                                                                   |
| `contract-analysis` | 부분 구현(진행 중), 사실상 데모 | 입력 → 분석 파이프라인이 안 이어져 있어 항상 고정 문구만 분석함                                                                                                                                                                                                                                                                                                                  |
| `market-data`       | 표시 로직 미흡                  | 응답에 있는 필드 대부분(기준일/표본수/대표시세)을 화면에 안 옮김, 상태 2분류라 사유 표현 불가                                                                                                                                                                                                                                                                                    |
| `risk-analysis`     | 거의 완전 구현                  | **(2026-07-31 갱신)** Backend가 이미 전부 구현해뒀던 걸 확인하고 FE 연동 완료 — 매물 상세 카드(신호 미리보기 2개 + 보증금 안전성 미니 섹션) + 전용 페이지(`/properties/[id]/risk-analysis`, 신호 4종 전체 + 보증금 안전성 전체). 남은 건 선순위보증금 재계산 폼 미연동(placeholder만) + 150% 초과 전용 경고 문구 없음 + `/contract/result` 보증금 탭 미연동                      |

## 반복적으로 나타난 패턴

### 1. 실패 사유를 백엔드 메시지 하나로 뭉뚱그리는 pass-through 패턴이 전 도메인에 반복됨

거의 모든 도메인 문서에서 같은 문장이 반복됩니다: "N가지 실패 사유가 요구사항엔 있지만, 화면엔 단일 에러 문구 하나뿐."

- `auth`: 로그인/회원가입 실패 사유 3~5종 → `ApiError.message` 그대로 노출
- `user`: 프로필 등록/수정 실패 사유 각 5종 → 동일 패턴
- `property`: 등록/수정/삭제/신고 실패 사유 대부분 → 동일 패턴(신고의 `REPORT_DUPLICATE`만 유일하게 예외적으로 구분됨)
- `checklist`: 생성/조회/항목확인 실패 사유 각 3~4종 → 동일 패턴

원인은 하나입니다 — `app/lib/api/http.ts`의 `parseOrThrow`가 백엔드 `error.message`를 그대로 `ApiError`에 담고, 거의 모든 폼/화면이 `error instanceof ApiError ? error.message : '기본 문구'`로만 처리합니다. 백엔드가 각 실패 사유에 다른 에러 코드(`error.code`)를 이미 내려주고 있다면, `property`의 `REPORT_DUPLICATE` 처리처럼 `code` 기준으로 분기하는 게 기술적으로 어렵지 않습니다 — 지금은 그 분기를 안 하고 있을 뿐입니다.

### 2. 클라이언트 사이드 호출은 Access Token 자동 재발급 대상이 아님 (자동 재발급 미구현, 여러 도메인 영향)

`auth-design.md` 이슈 2번에서 지적한 문제(클라이언트 컴포넌트에서 Access Token 자동 재발급이 아직 구현돼 있지 않음 — **정정, 2026-07-28**: 이전엔 "httpOnly라서 원천적으로 불가능"이라고 적었으나 부정확했음. httpOnly는 JS가 쿠키 값을 직접 읽는 것만 막지, `credentials:'include'` fetch가 쿠키를 자동으로 보내거나 브라우저가 `Set-Cookie`를 자동 반영하는 것까지 막지는 않는다 — 자세한 내용은 `auth-design.md` 참고)가 실제로 영향을 주는 화면은 하나가 아닙니다:

- ~~`checklist`: 항목 체크/미흡 처리(`updateChecklistItem`)~~ ✅ **해결됨(2026-07-29)** — `ChecklistClient`도 `isSessionInvalidErrorCode()`로 개별 감지하도록 수정
- `property`: 매물 신고(`reportProperty`), 매물 삭제(`deleteProperty`)
- `user`: 프로필 등록/수정(`registerProfile`/`updateMyProfile`), 닉네임 중복확인

지금은 `PasswordUpdateFormClient`와 `ChecklistClient` 둘만 `isSessionInvalidErrorCode()`(**2026-07-28 정정**: 기존에는 `error.code === 'UNAUTHORIZED'` 단일 체크였는데, 백엔드가 실패 사유를 `AUTH_TOKEN_MISSING`/`AUTH_TOKEN_INVALID`/`AUTH_TOKEN_EXPIRED`로 세분화하면서 실제로는 깨져 있던 걸 발견해 이 네 코드를 전부 인식하도록 고침)로 개별 감지해서 재로그인으로 유도하는 패턴을 갖고 있고 나머지(`property`, `user`)는 전부 일반 에러 문구로만 처리됩니다. 세션에 오래 머무는 화면일수록 실제로 겪을 확률이 높아, 반복될수록 공통 처리로 끌어올리라는 `http.ts`의 기존 주석대로 가는 게 맞아 보입니다 — 지금 2곳이 같은 패턴을 반복 중이라 다음에 하나 더 생기면 그때 훅으로 뽑아내는 걸 고려할 만함.

### 3. 파일/이미지 업로드가 어느 도메인에도 실제로 구현되어 있지 않음

- `user`: 프로필 사진 — `<input type="url">`로 URL 문자열만 입력받음(파일 업로드 아님)
- `property`: 매물 사진 — 입력 UI 자체가 없음(표시 준비는 되어 있는데 넣을 방법이 없음)
- `contract-analysis`: 계약서 이미지 — 드래그앤드롭 영역은 있지만 `onDrop`이 파일을 실제로 처리하지 않음(장식만 있음)

세 도메인 다 "이미지 형식/크기 검증" 요구사항이 있는데, 검증 로직이 없는 이유가 셋 다 같습니다 — 애초에 업로드 자체가 없어서 검증할 대상이 없는 것입니다. 파일 업로드 컴포넌트를 하나 만들어 공통으로 쓸 수 있는 지점이라, 세 도메인 중 어디를 먼저 만들든 나머지에 재사용할 수 있어 보입니다.

### 4. market-data 미구현의 흔적이 다른 도메인에 남아있음 (risk-analysis는 2026-07-31 해소됨)

Backend 문서의 같은 패턴이 FE에도 그대로 나타났었는데, risk-analysis 쪽은 도메인 연동이 끝나면서 해소됐습니다.

- ~~`property` 상세 카드의 위험 신호/보증금 안전성이 항상 "준비 중"~~ ✅ **해결(2026-07-31)** — `PropertyDetailClient`가 `riskSignals`/`depositSafety` 실데이터를 받는 구조로 바뀜(다만 옛 `PropertyDetail.checkSignalCount`/`jeonseRatio` 필드 자체는 여전히 안 채워짐 — 카드가 그 필드 대신 새 props를 직접 보게 만들었기 때문. 필드 자체를 정리할지는 범위 밖으로 남겨둠)
- ~~`checklist`의 소유권취득일 항목에 risk-analysis 연계를 표시할 자리 자체가 없음~~ ✅ **해결(2026-07-31)** — `recentOwnershipChangeWarning`이 risk-analysis 화면에 표시됨(`checklist-design.md` 참고)
- `property` **목록**(`GET /properties`)과 `home` 화면의 "확인 필요 신호" 섹션은 여전히 `checkSignalCount`가 항상 `undefined`라 "준비 중" — 이번 작업은 매물 **상세** 페이지만 다뤘고, 목록/홈은 다른 API(`PropertySummaryDto`)를 쓰는 별도 지점이라 스코프 밖이었음
- `contract-analysis`의 "보증금" 탭이 여전히 완전 정적 데이터(전세가율 82% 등 하드코딩) — `getDepositSafety()` 서비스 함수는 이제 존재하니, 이 탭을 다음에 손볼 때 바로 연동 가능

남은 두 개(매물 목록/홈, contract-analysis 보증금 탭)는 `market-data`와 같은 원인이라기보다, **이미 있는 risk-analysis 연동 지점을 다른 화면에도 마저 연결 안 한 것**에 가깝습니다 — 이제는 새 도메인 연동이 아니라 기존 서비스 함수를 더 쓰기만 하면 되는 문제로 성격이 바뀌었습니다.

### 5. 체크리스트 라우트 마이그레이션(`/checklist` → `/properties/[id]/checklist`) 흔적이 여러 파일에 흩어져 남아있음

이번에 "내 체크리스트 목록" 작업을 하면서 하드코딩된 링크를 3곳 고쳤는데(`navigation.ts`, `dashboard.ts`, 그리고 오늘 발견한 `getPriorityAction()`), 도메인 문서를 쓰면서 **같은 종류의 누락이 최소 2곳 더** 나왔습니다.

- `app/lib/priorityAction.ts`의 `ctaHref: '/checklist'`(단수, id 없음) — `user-design.md` 이슈 3번
- `app/(main)/contract/result/ContractResultClient.tsx`의 `<Link href="/properties/1/checklist">`(id 하드코딩) — `contract-analysis-design.md` 이슈 3번, 처음부터 알고 있었지만 이번에도 스코프 밖으로 유지하기로 함

한 파일을 고칠 때 다른 파일도 같은 문제를 갖고 있을 가능성이 높다는 걸 보여주는 사례라, 나중에 다시 라우트를 옮길 일이 있으면 `grep -r "properties/1\|/checklist['"]"` 같은 걸로 전수 조사부터 하는 게 안전해 보입니다.

**(2026-07-30 추가)** 위 예시가 "출구"(분석 결과 → 체크리스트) 쪽 하드코딩이라면, "입구"(매물 상세/체크리스트 → 분석) 쪽도 같은 근본 원인(propertyId 미전달)을 갖고 있다는 게 확인됐습니다 — `PropertyDetailClient.tsx`의 "특약사항 분석하기" 버튼과 `ChecklistClient.tsx`의 CTA 둘 다 `/contract/upload`로 갈 때 propertyId를 안 넘기고, `/contract/upload` 자체도 그 값을 받는 파라미터가 없습니다. 그래서 입구에서 잃어버린 정보를 출구에서 복구할 방법이 없어 하드코딩이 남아있는 구조입니다. 분석 결과를 propertyId에 묶어 DB에 저장하는 방안(체크리스트에서 "이미 분석한 결과 보기" 연결)도 함께 논의했지만, 새 테이블·API가 필요한 별도 스코프라 오늘은 결정을 보류했습니다(`checklist-design.md` 남은 이슈 9번 참고).

### 6. "성공 후 이동 목적지"가 요구사항과 실제 구현에서 다른 사례가 반복됨

- `user`: 프로필 등록 성공 시 요구사항은 "홈 화면"이지만 실제론 `/mypage`로 이동(`user-design.md` 이슈 5번)
- `property`: 매물 등록 성공 시 상세 화면이 나와야 자연스러워 보이는데 실제론 목록(`/properties`)으로 이동, 코드 주석은 "상세 API가 아직 실제 응답 형태에 안 맞아서"라고 되어 있음(`property-design.md` 이슈 2번)

둘 다 "예전에 그 화면이 아직 준비 안 됐을 때 임시로 다른 곳으로 보내둔 게 그대로 남아있다"는 같은 유형의 문제로 보입니다. 특히 `property` 쪽은 상세 화면이 이미 실제 API에 맞춰져 있는 것처럼 보여서, 주석이 낡았을 가능성이 있습니다.

### 7. 판정 결과의 실패/판정불가 사유를 구분해서 담을 수 있는 API 계약이 부족함

`market-data-design.md`에서 확인된 문제(`MarketComparisonDto.status`가 `AVAILABLE`/`UNAVAILABLE` 두 값뿐이라 요구사항이 원하는 판정불가 3종/실패 4종을 FE가 구분할 방법이 없음)를, `risk-analysis-design.md`를 쓰면서 아직 구현되지도 않은 도메인에 **미리 반복하지 않도록 사유 필드를 계약에 넣자고 제안**해뒀습니다. 이 둘은 사실 같은 교훈의 두 사례입니다 — "성공/실패" 이분법 상태값만으로는 사용성 요구사항(판정불가 사유 안내 등)을 절대 충족할 수 없다는 것을, 뒤늦게 하나(market-data)에서 확인했고 다른 하나(risk-analysis)는 설계 단계에서 미리 반영한 셈입니다.

## 참고: 각 도메인 문서의 "남은 이슈" 개수

| 도메인            | 확인 필요 항목 수                 |
| ----------------- | --------------------------------- |
| auth              | 1개 (2026-07-28 갱신, 위 표 참고) |
| user              | 7개                               |
| property          | 6개                               |
| market-data       | 4개                               |
| checklist         | 1개 (2026-07-31 갱신, 위 표 참고) |
| contract-analysis | 5개                               |
| risk-analysis     | 4개 (2026-07-31 갱신, 위 표 참고) |
