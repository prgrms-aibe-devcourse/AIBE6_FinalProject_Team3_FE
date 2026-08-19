# 도메인 전체 구현 현황 — 요약 (Frontend)

## 배경

`auth-design.md`, `user-design.md`, `property-design.md`, `market-data-design.md`, `checklist-design.md`, `contract-analysis-design.md`, `risk-analysis-design.md` 7개 문서를 도메인별로 작성하면서 반복적으로 나타난 패턴을 모았습니다. Backend `docs/specs/cross-domain-summary.md`와 같은 목적의 문서이며, 여기서는 **화면/클라이언트 관점에서 반복된 문제**만 다룹니다.

## 도메인별 구현 상태 한눈에

| 도메인              | 상태                            | 비고                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `auth`              | 거의 완전 구현                  | **(2026-07-28 갱신)** 확인 필요 1개로 축소 — matcher 누락/비밀번호 정책 중복 해결, 에러 메시지 pass-through는 의도된 설계로 재분류됨. 남은 1개(클라이언트 사이드 자동 재발급 미구현)는 브라우저-side refresh-retry 흐름 미구현 상태로 보류                                                                                                                                  |
| `checklist`         | 거의 완전 구현                  | **(2026-08-14 갱신)** `GET /checklists` 페이지네이션·매물명 표시 수정에 이어, Backend가 문항별 참고 이미지(`ChecklistItemTemplateImage`)와 새 문항 타입 `MULTIPLE_CHOICE`(선택지 응답)를 추가한 것에 대응 완료 — FE는 이미지 썸네일/확대 모달, 선택지 버튼 렌더링까지 반영. **관리자용 CRUD도 같은 날 마저 완료**: Backend가 이미지 관리 API(`GET/POST/DELETE /admin/checklist-templates/{id}/images`)와 선택지(`options`) 관리 API를 모두 추가하면서, FE `AdminChecklistTemplatesClient.tsx`의 생성/수정 모달에 선택지 입력란 + 이미지 목록/추가/삭제 섹션을 구현함 — `checklist-design.md` 참고. 기존 "확인 필요 2개"(에러 코드 구분 미반영, 특약사항 분석 여정 연결)는 그대로 남아있음 |
| `user`              | 대부분 구현                     | **(2026-08-14 갱신)** 이미지 업로드(`feat/profile-s3-fe`), 회원 탈퇴 연결(`feat/withdraw-connect`), 닉네임 형식 검증(`feat/user-nickname-format`, PR #135) 전부 `dev`에 머지되어 실제 배포됨 ✅. 팀원 전수조사로 발견된 버그 3건(프로필 저장 시 이미지만 반영되고 필드 저장은 실패하는 문제, 홈 화면 체크리스트 위젯 `Promise.all` 전체 실패, 홈 화면 "새로고침" CTA 무효)도 `fix/user-domain-complete`(PR #144)로 수정해 `dev`에 머지됨. **(2026-08-19 갱신)** 위젯 재배치 방향은 결정됨 — 진행 스텝퍼 방향을 시도했으나 체크리스트 반복성/특약사항 분석 신호 부재 문제로 폐기하고, 온보딩 안내 모달(`OnboardingIntroModal`)로 대체 구현 완료(`user-design.md` 참고). 남은 건 "취업 여부" 요구사항 모호함 1건뿐 |
| `property`          | 부분 구현, 명세보다 크게 좁음   | 검색/정렬/페이지네이션 없음, 사진 업로드 없음, 시세·위험신호·신고이력·체크리스트진행 표시 전무                                                                                                                                                                                                                                                                              |
| `contract-analysis` | 대부분 구현 | **(2026-08-07 갱신)** 입력→OCR→마스킹→AI 분석→조항별 채팅까지 파이프라인 전체 연동 완료. 남은 건 propertyId 연결(입구/출구 둘 다 미해결)과 보증금/누락항목 탭 정적 데이터 정도 — 자세한 건 `contract-analysis-design.md` 참고                                                                                                                                                                                                                                                                                                             |
| `market-data`       | ~~표시 로직 미흡~~ → 대부분 구현 | ~~응답에 있는 필드 대부분(기준일/표본수/대표시세)을 화면에 안 옮김~~ — ✅ **(2026-08-12 정정)** `mapMarketComparisonDto`/`PropertyDetailClient.tsx`가 `referencePrice`/`differenceRate`/`sampleCount`/`referenceDate`/`radiusMeters`를 전부 옮겨 상세화면에 표시한다(`market-data-design.md` 참고). 상태 2분류(`AVAILABLE`/`UNAVAILABLE`)라 코드로 사유를 분기할 수 없다는 한계는 여전히 남아있지만 `message` 문구로 사유는 사용자에게 보여짐. 목록 카드는 여전히 판정불가 사유를 "연동 예정"으로 뭉뚱그리는 별도 문제가 있음(`market-data-design.md` 전수조사 결과 코드품질 1번 참고)                                                                                                                                                                                                                                                                               |
| `risk-analysis`     | 거의 완전 구현                      | **(2026-08-18 갱신)** 위험 신호 4종 + 보증금 안전성(전세가율) + 선순위보증금 재계산까지 연동 완료, `contract-analysis` "보증금" 탭 연동도 이미 되어 있었음(문서만 안 갱신됨). 이번에 전수조사 재검증하며 버그 2건(선순위보증금 재계산 값이 새로고침 시 사라짐, 월세 판정불가 문구가 Backend 값 세분화 이후에도 FE가 안 따라감) + 코드 품질 1건(전세가율 색상 판정 기준 하드코딩)을 마저 수정 완료. 남은 건 `property-detail.ts`의 죽은 코드(`riskSummaries`) 정리 정도 — `risk-analysis-design.md` 참고                                                                                                                                                                                                                                                                                                                         |

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

**(2026-08-07 정정)** `contract-analysis`는 이미지 업로드(드래그앤드롭/파일선택/미리보기, JPG·PNG 형식 검증)가 실제로 구현됐습니다. **(2026-08-12 추가 정정)** `user`도 이제 해당됩니다 — `feat/profile-s3-fe`가 `dev`에 머지되어 S3 presign/confirm 기반 실제 파일 업로드가 배포됨(아래 참고). 같은 날 별도로 재확인한 결과 `contract-analysis`의 "여전히 크기 제한 검증이 없다"는 서술도 더 이상 사실이 아닙니다 — `upload/page.tsx`에 이미 `MAX_IMAGE_SIZE_BYTES`(10MB) 클라이언트 검증이 구현돼 있습니다(`contract-analysis-design.md` 전수조사 결과 참고). 아래는 이제 `property` 하나로만 좁혀졌습니다.

- ~~`user`: 프로필 사진 — `<input type="url">`로 URL 문자열만 입력받음(파일 업로드 아님)~~ ✅ **해결됨(2026-08-03~04, `feat/profile-s3-fe` — `dev` 머지되어 배포됨)** — S3 presign/confirm 2단계로 실제 파일 업로드 구현, JPG/PNG·5MB 검증도 presign/confirm 양쪽에서 이뤄짐
- `property`: 매물 사진 — 입력 UI 자체가 없음(표시 준비는 되어 있는데 넣을 방법이 없음)
- ~~`contract-analysis`: 계약서 이미지 — 드래그앤드롭 영역은 있지만 `onDrop`이 파일을 실제로 처리하지 않음(장식만 있음)~~ ✅ **해결됨(2026-08-07)** — 실제 파일 캡처/미리보기/OCR 연동 완료

이제 "이미지 형식/크기 검증 로직이 없다"는 문제가 남아있는 건 `property` 하나뿐입니다 — `contract-analysis`/`user` 둘 다 이미 구현해둔 파일 선택/미리보기/검증 UI를 재사용할 여지가 있어 보입니다.

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
- ~~`app/(main)/contract/result/ContractResultClient.tsx`의 `<Link href="/properties/1/checklist">`(id 하드코딩)~~ ✅ **하드코딩 자체는 해결됨(2026-08-07)** — 이제 `propertyId`를 optional prop으로 받아서 없으면 버튼을 숨기도록 고침. 다만 아래 2026-07-30 항목에서 보듯 애초에 이 prop을 채워줄 방법이 없어서, 결과적으로 이 버튼은 지금 항상 안 보이는 상태(근본 원인은 안 풀림) — `contract-analysis-design.md` 남은 이슈 1번 참고

한 파일을 고칠 때 다른 파일도 같은 문제를 갖고 있을 가능성이 높다는 걸 보여주는 사례라, 나중에 다시 라우트를 옮길 일이 있으면 `grep -r "properties/1\|/checklist['"]"` 같은 걸로 전수 조사부터 하는 게 안전해 보입니다.

**(2026-08-14, 위 예측이 실제로 맞아떨어짐)** `app/data/dashboard.ts`의 홈 화면 빠른 실행 카드 "위험 신호 확인"도 `to: '/properties/1'`로 하드코딩돼 있던 걸 발견했습니다(체크리스트 라우트 마이그레이션과는 무관한 별개의 하드코딩이지만, 정확히 위에서 예측한 `properties/1` grep 패턴에 걸리는 사례) — 로그인한 사용자가 누구든 항상 매물 1번으로 이동해, 본인 소유가 아니거나 존재하지 않는 매물로 갈 수 있는 버그였습니다. 매물/신호 개수에 따라 동적으로 연결하는 방향(`getRiskCheckHref()`, 매물 0개→등록, 신호 매물 정확히 1개→그 매물 위험분석, 그 외→목록)까지 만들어봤으나, 매물 목록 화면에 "신호 있는 매물만" 걸러보는 필터가 아직 없어 신호 매물이 2개 이상인 경우엔 실효성이 애매하다고 판단해 되돌렸습니다 — 지금은 `to: '/properties'`(매물 목록)로 단순 고정. 그 필터 기능이 추가되면 동적 라우팅을 다시 검토할 예정입니다.

**(2026-07-30 추가)** 위 예시가 "출구"(분석 결과 → 체크리스트) 쪽 하드코딩이라면, "입구"(매물 상세/체크리스트 → 분석) 쪽도 같은 근본 원인(propertyId 미전달)을 갖고 있다는 게 확인됐습니다 — `PropertyDetailClient.tsx`의 "특약사항 분석하기" 버튼과 `ChecklistClient.tsx`의 CTA 둘 다 `/contract/upload`로 갈 때 propertyId를 안 넘기고, `/contract/upload` 자체도 그 값을 받는 파라미터가 없습니다. 그래서 입구에서 잃어버린 정보를 출구에서 복구할 방법이 없어 하드코딩이 남아있는 구조입니다. 분석 결과를 propertyId에 묶어 DB에 저장하는 방안(체크리스트에서 "이미 분석한 결과 보기" 연결)도 함께 논의했지만, 새 테이블·API가 필요한 별도 스코프라 오늘은 결정을 보류했습니다(`checklist-design.md` 남은 이슈 9번 참고). **(2026-08-07 기준)** 이 근본 원인은 아직 그대로입니다 — 출구 쪽 하드코딩만 안전하게(버튼 숨김으로) 고쳤을 뿐, 입구에서 propertyId를 넘기는 작업 자체는 손대지 않았습니다.

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
| user              | 2개 (2026-08-19 갱신, 13개 중 11개 해결/결정 완료 — 욕설/금칙어 필터링은 구현하지 않기로, 위젯 재배치는 온보딩 안내 모달(`OnboardingIntroModal`) 채택으로 각각 결정 완료됨. 남은 건 "취업 여부" 요구사항 모호함 1건 + property/checklist 세션 리다이렉트(스코프 밖) 1건 — `user-design.md` 참고) |
| property          | 6개                               |
| market-data       | 4개                               |
| checklist         | 2개 (2026-07-31 갱신, 위 표 참고) |
| contract-analysis | 6개 (2026-08-07 갱신, 위 표 참고) |
| risk-analysis     | 2개 (2026-08-07 갱신, 위 표 참고) |

## 공통/인프라 코드 전수조사 결과 (2026-08-12)

이 절은 특정 도메인 패키지에 속하지 않는 공통 코드(`app/ui`, `app/config`, `app/data`, `app/types`, `app/mocks/init`)를 대상으로 한다. 개별 도메인 코드는 각 `{도메인}-design.md`의 "전수조사 결과" 섹션을 참고. Backend 쪽 발견(특히 S3 presign 관련 보안 이슈)은 `backend/docs/specs/cross-domain-summary.md`에 정리했다.

### 버그/정확성

1. ~~`app/types/api.ts`의 `ChecklistItemDto.helperText` 주석("Backend checklist_item_template.helper_text 컬럼(예정)")이 실제 구현 상태보다 낡았다.~~ — ✅ **(2026-08-12 해결)** "(예정)" 문구를 제거해 이미 구현된 컬럼임을 정확히 반영.
2. ~~`app/mocks/init/risk-analysis.ts`의 `initRiskSignalListDto`가 `SAME_ACCOUNT_MULTIPLE` 신호를 `status: 'SUCCESS'`(신호 발견됨)로 채워두고 있는데, 실제 backend는 이 신호를 아직 계산하지 않는다(`multi-account-detection-enabled: false`) — 이 mock만 보고 화면을 만들면 이 신호가 이미 살아있는 것으로 오해하기 쉽다.~~ — ✅ **(2026-08-12 해결)** 해당 항목 위에 "실제 backend는 아직 계산하지 않으며, 이 값은 목업/데모 확인용일 뿐"이라는 주석을 추가.

### 보안

1. 특별히 발견된 이슈 없음. `app/ui/**` 공유 컴포넌트 중 `dangerouslySetInnerHTML`을 쓰는 곳이 없고(전부 React의 기본 텍스트 이스케이프에 의존), `KakaoMap.tsx`도 카카오 SDK 스크립트 URL에 빌드타임 `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`만 넣을 뿐 사용자 입력이나 서버 응답 값을 URL/DOM에 직접 주입하는 지점이 없다. `app/config/*.ts`가 참조하는 환경변수(`NEXT_PUBLIC_CROSS_ORIGIN_AUTH`, `NEXT_PUBLIC_USE_MOCK_DATA`)와 `KakaoMap.tsx`의 `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`, `next.config.js`(원격 이미지 호스트 허용 목록만 정의, `env` 커스텀 노출 없음) 전부 `NEXT_PUBLIC_*` 규칙을 지키고 있어, 비공개 환경변수가 클라이언트 코드로 새는 패턴은 찾지 못했다.

### 코드 품질 (중복/구조/일관성)

1. ~~`app/types/api.ts`의 `ApiResponse<T>`가 `{ success: boolean; data: T; error?: ApiErrorBody | null }`로 정의되어 있어 `data`가 항상 존재하는 것처럼 타입이 잡힌다. 그런데 실제 backend `ApiResponse` record는 `@JsonInclude(NON_NULL)`이라 실패 응답에는 `data` 필드 자체가 JSON에서 빠진다 — 즉 실패 시 `body.data`는 런타임에 `undefined`인데 타입은 `T`라고 주장한다.~~ — ✅ **(2026-08-12 해결)** `{ success: true; data: T; error?: null } | { success: false; data?: undefined; error: ApiErrorBody }` 판별 유니온으로 변경. 사용처가 `app/types/api.ts`(정의)와 `app/lib/api/http.ts`(단일 통로) 2곳뿐이라 블라스트 반경이 작음을 먼저 확인한 뒤 반영 — `readApiResponse`의 실패 폴백에서 더 이상 `data: undefined as T` 같은 캐스팅이 필요 없어졌고, `finalizeResponse`에서 `!body.success` 분기 이후 `body.data`가 `T`로 정확히 좁혀져(narrowing) 타입 안전성이 실제로 개선됨.
2. ~~`UserTransactionTypeDto`(`'JEONSE' | 'WOLSE'`, `user` 도메인 선호 거래유형)와 `PropertyTransactionTypeDto`(`'JEONSE' | 'MONTHLY_RENT'`, `property` 도메인 실제 거래유형)가 같은 전세/월세 개념을 서로 다른 문자열로 표현한다.~~ — ⚠️ **(2026-08-12 당시엔 "의도된 표기 차이"로 오판)** Backend 계약을 통일하는 건 스코프가 커서, 대신 두 타입 선언부에 서로 다른 표기를 쓴다는 주석만 각각 추가했었음. ✅ **(2026-08-14 해결)** 팀원의 죽은 코드 감사(`2026-08-14-defensive-dead-code-audit.md`)로 확인한 결과, User 도메인 백엔드 `TransactionType` enum이 원래 `WOLSE`였다가 Property 도메인과 표기를 맞추기 위해 `MONTHLY_RENT`로 통일된 것이었는데 프론트가 이 변경을 못 따라가서 계속 `'WOLSE'`를 보내고 있었음(단순한 "표기 차이"가 아니라 백엔드 enum 변경에 뒤처진 실제 버그 — "월세" 선택 후 저장 시 Jackson이 `WOLSE`를 역직렬화 못 해 실패). `UserTransactionTypeDto`를 `'JEONSE' | 'MONTHLY_RENT'`로 맞추고 `app/mappers/user.ts`/`app/mocks/init/user.ts`도 함께 수정, 두 타입 주석도 "현재 값은 같지만 서로 다른 백엔드 enum이라 독립적으로 바뀔 수 있다"로 정정함.
3. `app/mocks/init/**`의 구조 자체는 일관돼 있다 — 도메인마다 정확히 하나의 init 파일이 있고, 각각 대응하는 `app/repositories/{도메인}Repository.ts` 하나가 그 init 데이터를 소비하는 1:1 구조를 전 도메인이 동일하게 따른다(`admin.ts`→`adminRepository.ts`, `checklist.ts`→`checklistRepository.ts` 등). 별도의 공용 인덱스/매니페스트 파일이 없는 점도 이 1:1 구조상 자연스러워 문제로 보지 않았다.

## 테스트 코드 품질 전수조사 결과 (2026-08-12)

이 절은 테스트 코드 자체의 품질(약한 assertion, 커버리지 공백, 과도한 mock 의존 등)을 대상으로 한다 — 애플리케이션 코드 자체의 결함은 각 도메인 spec 문서의 "전수조사 결과" 섹션 참고. 저장소 전체에서 `*.test.ts`/`*.test.tsx` 파일은 정확히 7개(`app/lib/api/http.refresh.test.ts`, `app/lib/devLoginKey.test.ts`, `app/lib/nextPath.test.ts`, `app/lib/pageParam.test.ts`, `app/lib/useLogout.test.ts`, `app/login/SessionRecoverRetryButton.test.tsx`, `app/(main)/admin/reports/AdminReportsClient.test.tsx`, `app/(main)/admin/users/AdminUsersClient.test.tsx`)이며, `frontend/vitest.config.ts`(jsdom 환경, `vitest.setup.ts` 전역 설정)로 전부 실행된다. 전체를 읽었다.

전반적인 인상: 7개 파일 전부 회귀 테스트로서의 목적이 뚜렷하고(테스트 상단에 "왜 이 테스트가 존재하는지" 회귀 배경 주석이 거의 빠짐없이 달려 있다), assertion도 구체적인 값을 검증한다 — `toBeInTheDocument()`/`not.toHaveBeenCalled()`류의 존재 여부 확인이 아니라 실제 호출 인자(`toHaveBeenCalledWith(1, { status: 'RESOLVED', memo: undefined })` 등)나 순서(`callOrder`)까지 확인하는 경우가 많다. 다만 각 파일이 다루는 범위가 좁게 잘려 있어(파일당 대부분 1~4개 테스트), 같은 컴포넌트/함수의 실패(catch) 경로가 통째로 비어 있는 경우가 여러 곳 있다.

### 커버리지 공백 (놓친 실제 버그와의 연관)

1. ~~**`useLogout.test.ts`에 로그아웃 실패(catch) 경로 테스트가 전혀 없다.**~~ — ✅ **(2026-08-12 해결)** 실패 시 `push`가 호출되지 않고 `logoutError`가 채워지며 `isLoggingOut`이 `false`로 복원되는지 확인하는 테스트 추가(mock 호출 이력이 테스트 간 누적되지 않도록 `beforeEach(vi.clearAllMocks)`도 함께 추가).
2. ~~**`SessionRecoverRetryButton.test.tsx`도 성공 경로만 다루고, `getCurrentUser()` 실패 시 분기를 전혀 검증하지 않는다.**~~ — ✅ **(2026-08-12 해결)** `isUnreachableError`로 판정되는 `ApiError`로 reject시켜, 페이지 이동 없이 버튼이 "다시 시도" 상태로 복원되는지 확인하는 테스트 추가.
3. ~~**`AdminUsersClient.test.tsx`는 "정지" 액션의 성공/실패 경로를 전혀 다루지 않는다.**~~ — ✅ **(2026-08-12 해결)** `updateAdminUserStatus`가 `(userId, {status:'SUSPENDED'})`로 호출되는지, 성공 시 모달이 닫히고 `onMutated`가 불리는지, 실패 시 모달이 유지되며 에러 메시지가 뜨는지 확인하는 테스트 2건 추가.

### 약한 assertion / 부실한 검증

특별히 심각한 사례는 찾지 못했다. 7개 파일 전부 `toBeInTheDocument()` 같은 존재 여부 확인 다음에는 대체로 `toHaveBeenCalledWith(...)`나 구체적인 문자열/경로 값 비교가 따라붙어, "통과하지만 아무것도 검증하지 않는" 수준의 assertion은 없었다.

### 기타 (비활성화된 테스트, 과도한 mock 의존, 플레이키 가능성)

1. **`.skip`/`xit`/`xdescribe`/`.only`로 비활성화된 테스트는 저장소 전체에 없다** (`*.test.ts`/`*.test.tsx` 7개 파일 전체 grep 기준).
2. ~~**7개 파일 중 6개가 서비스 계층(`services/auth`, `services/adminActions`)을 `vi.mock`으로 완전히 대체한다** — ... 두 계층 사이(예: 실제 `services/auth.ts`가 `http.ts`를 올바르게 호출하는지)를 잇는 테스트는 비어 있다.~~ — ✅ **(2026-08-12 부분 해결, auth 범위)** `app/services/auth.test.ts`를 신설해 `services/auth.ts`가 `http.ts`를 mock하지 않고 실제로 거치는 통합 테스트를 추가함 — `getCurrentUser()`/`login()`/`logout()`이 실제로 만드는 요청 경로·메서드·바디, 성공 응답의 `data` 언래핑, 401 실패 응답이 `ApiError`(코드/메시지 보존)로 던져지는지, `isLoggedIn()`이 `requestJson` 경로를 타지 않아 401에도 예외 없이 `false`를 반환하는지까지 확인. 다른 도메인의 서비스 계층(`services/adminActions` 등)은 이번 범위(Auth/Admin/공통) 밖이라 같은 공백이 남아있음.
3. **플레이키 가능성이 있는 시간/순서 의존 테스트는 발견하지 못했다** — `http.refresh.test.ts`가 `AbortController`/`vi.waitFor`로 비동기 순서를 다루지만 실제 타이머(`vi.useFakeTimers` 등)나 고정되지 않은 `sleep`에 의존하지 않고, pending Promise를 수동으로 resolve/reject하는 패턴(`resolveRefresh!(...)`)을 써서 타이밍 경쟁 없이 결정적으로 동작한다. 나머지 파일들도 `waitFor`/`findBy*`로 React 상태 업데이트를 기다릴 뿐 `setTimeout` 기반 로직을 테스트하는 곳은 없다.

## 홈 화면 및 공용 lib 유틸 전수조사 결과 (2026-08-12)

이 절은 어떤 도메인 조사에도 배정되지 않았던 `frontend/app/(main)/home/page.tsx`와 `frontend/app/lib/*.ts`(auth 관련 `http.ts`/`useLogout.ts`/`devLoginKey.ts` 3개 제외) 공용 유틸을 대상으로 한다. `home/page.tsx`와 `app/lib/priorityAction.ts`는 `user-design.md`가 "currentStage 기반 우선순위 카드" 관점에서 이미 한 차례 조사했으므로, 거기서 이미 다룬 내용(위젯 재배치 미구현, 조회 실패 처리 등)은 다시 다루지 않고 그 조사에서 놓친 각도만 다룬다. `activityHistory`가 백엔드 미구현 엔드포인트라 항상 실패하는 건 이미 알려진 제약이라 새 이슈로 세지 않았다 — `home/page.tsx`가 이를 조용히 빈 배열로 처리하는 것도 `user-design.md` 74번째 항목에서 이미 의도된 설계로 확인된 부분이라 재론하지 않는다.

### 버그/정확성

1. ~~**(신규 발견)**~~ **(2026-08-14 해결)** `home/page.tsx`의 진행 중 체크리스트 위젯 조회(`checklistProgressEntries`, `app/(main)/home/page.tsx:115-134`)가 `Promise.all`로 매물별 `getChecklistResult()`를 한꺼번에 묶어 호출하는데, 그중 단 하나만 실패해도 `catch`가 전체 배열을 빈 채로 남겨서 이미 성공적으로 받아온 다른 매물의 위젯까지 전부 사라진다. 주석("다른 위젯에는 영향 없음")은 홈 화면의 *다른* 섹션(요약 정보, 중요 확인사항 등)엔 영향이 없다는 뜻으로는 맞지만, 이 위젯 *자체* 안에서는 하나의 실패가 나머지 성공 건까지 함께 지워버린다. 같은 로직을 쓰는 `app/(main)/mypage/page.tsx:84-109`는 `checklistProgressByPropertyId`를 먼저 status만으로 채워두고(88번째 줄) 그다음에 `Promise.all`로 진행률/주의 개수를 "보강"하는 구조라, 보강이 실패해도 최소한 상태(status)는 매물마다 남는다 — 홈 화면엔 이 사전 채움 단계가 없어 실패 시 완전히 빈 위젯이 된다. 진행 중인 체크리스트가 여러 개인 사용자가 그중 하나의 조회만 일시적으로 실패해도 전부 안 보이게 되는 실제 시나리오라, `Promise.allSettled`로 바꾸거나 mypage처럼 status 우선 채움을 추가하는 쪽이 안전해 보인다. → `Promise.allSettled`로 교체해 실패한 항목만 개별적으로 빠지고 나머지는 그대로 보이도록 수정함(`fix/user-domain-complete`, PR #144).
2. ~~**(신규 발견)**~~ **(2026-08-14 해결)** `getPriorityAction()`(`app/lib/priorityAction.ts:18-24`, `47-52`)이 매물/체크리스트 조회 실패 시 안내하는 "새로고침" CTA가 `ctaHref: '/home'`으로 현재 페이지(`/home`) 자신을 가리키는데, `PriorityActionCard.tsx:23-28`는 이걸 그냥 `next/link`의 `<Link>`로 렌더링할 뿐이다. `home/page.tsx`의 데이터 조회는 `useEffect(() => {...}, [])`(60번째 줄, 마운트 시 1회만 실행)에 있고, 같은 라우트로의 클라이언트 사이드 네비게이션은 이미 마운트된 컴포넌트를 리마운트시키지 않으므로(URL이 그대로라 이 컴포넌트 트리도 다시 그려지지 않음) 이 "새로고침" 버튼을 눌러도 실제로는 아무 데이터도 다시 불러오지 않는다 — 사용자가 브라우저 자체를 새로고침(F5)해야만 실제로 재시도된다. 문구가 사용자에게 "누르면 다시 시도된다"고 약속하는데 실제로는 그렇지 않은 경우라 눈에 잘 안 띄는 회귀가 될 수 있다. → `PriorityAction`에 `onCtaClick?: () => void`를 추가하고, `PriorityActionCard`가 이 값이 있으면 `<Link>` 대신 `<button onClick>`으로 직접 재조회를 트리거하도록 수정. `home/page.tsx`는 데이터 조회를 `fetchHomeData`(순수 데이터 반환)로 분리해 마운트/재시도 둘 다 `fetchHomeData().then(setData)`로 호출하는 구조로 정리함(`fix/user-domain-complete`, PR #144).

### 보안

1. 특별히 발견된 이슈 없음. `home/page.tsx`가 화면에 그대로 옮기는 백엔드/활동내역 문자열(`property.signalSummary`, `item.status` 등, 277~294번째 줄)은 모두 JSX 중괄호 보간으로만 쓰여 React의 기본 이스케이프를 그대로 받고, `dangerouslySetInnerHTML`이나 수동 DOM 조작은 이 파일에도 조사 대상 `app/lib/*.ts` 어디에도 없다. `nextPath.ts`의 오픈 리다이렉트 방지(허용 프리픽스 화이트리스트 + 절대/프로토콜 상대 URL 차단)와 `pageParam.ts`의 입력 정규화도 테스트로 경계값까지 잘 커버되어 있어 별도 이슈로 잡지 않았다.

### 코드 품질 (중복/구조/일관성)

1. **(신규 발견)** `app/lib/jeonseRatio.ts`의 `getJeonseRatioDisplay()`는 전세가율 값을 `82%` 같은 순수 텍스트로만 돌려주고 색상 톤은 전혀 매기지 않는데, 이 함수를 쓰는 `app/ui/PropertyListItem.tsx:52`(매물 목록 카드)가 보여주는 값과 정확히 같은 개념(전세가율)을, `risk-analysis` 도메인은 매물 상세/전용 페이지에서 `app/data/risk-analysis.ts:57-65`의 `getJeonseRatioTone()`(80% 미만 emerald, 80~150% orange, 150% 이상 red — Backend `RiskPolicyConfig` 80/100/150 기준선을 3색으로 축약한 것, `risk-analysis-design.md` 참고)으로 색 배지까지 입혀서 보여준다. 즉 똑같은 전세가율 82%인 매물이라도 목록 카드에서는 안전한지 위험한지 알 수 있는 시각적 신호가 전혀 없고, 상세/전용 페이지로 들어가야만 색으로 구분된다 — 두 화면이 같은 값에 대해 서로 다른 수준의 정보를 주는 불일치다. `getJeonseRatioDisplay()`가 `getJeonseRatioTone()`을 그대로 재사용하도록 고치면 해소 가능해 보인다.
2. ~~**(신규 발견)** `app/lib/base64Url.ts`의 `decodeBase64Url()`(14~22번째 줄)은 코드베이스 전체에서 어디서도 호출되지 않는 죽은 코드다. 이 함수가 디코딩하려는 것과 동일한 데이터(계약서 마스킹 리뷰 payload)를 실제로 디코딩하는 곳은 `app/(main)/contract/result/page.tsx:13-14`인데, 여기는 Server Component라 `Buffer.from(data, 'base64url')`을 직접 쓴다 — `base64Url.ts` 파일 맨 위 주석("Buffer가 없는 브라우저 환경이라...")은 인코딩 쪽(클라이언트 컴포넌트인 `contract/upload/page.tsx`)에는 맞지만, 디코딩 쪽(서버 컴포넌트, Buffer 사용 가능)에는 처음부터 적용되지 않는 전제였던 것으로 보인다. 기능상 문제는 없지만(`Buffer.from(..., 'base64url')`도 패딩 없는 입력을 올바르게 처리함), 같은 인코딩의 짝이 되는 디코더가 결국 안 쓰이고 다른 곳에 같은 로직이 새로 생긴 셈이라 정리 대상이다.~~ — ✅ **(2026-08-19 해결)** `upload` → `result` 페이지 간 데이터 전달 방식 자체를 base64url query string에서 `sessionStorage`로 바꾸면서 `app/lib/base64Url.ts` 파일 전체(`encodeBase64Url`/`decodeBase64Url`)를 삭제했다. `result/page.tsx`도 더 이상 Server Component가 아니라 Client Component로 바뀌어 `sessionStorage`를 직접 읽는다(`app/lib/contractResultStorage.ts`).
3. ~~`app/(main)/mypage/profile/ProfileClient.tsx:256`은 `error instanceof ApiError ? error.message : '...'` 패턴을 직접 구현하는데, 이건 `app/lib/resolveErrorMessage.ts`가 이미 제공하고 `login`/`signup`/`admin/*` 등 나머지 폼 전체가 일관되게 쓰고 있는 것과 거의 동일한 로직이다(차이는 `instanceof ApiError`냐 `instanceof Error`냐뿐). 이 파일이 호출하는 `registerProfile`/`updateMyProfile`/`uploadProfileImage`/`resetProfileImage`는 mock 모드에서도 항상 `ApiError`만 던지거나 아예 실패하지 않아(`app/repositories/userRepository.ts`, `app/services/user.ts:99-114` 확인) 지금은 실제 동작 차이로 이어지지 않지만, 다른 곳처럼 `resolveErrorMessage`를 재사용했다면 이 중복 자체가 없었을 것이다.~~ — ✅ **(2026-08-14 해결)** `resolveErrorMessage`로 교체해 나머지 폼과 통일함(`fix/user-domain-complete`, PR #144).
