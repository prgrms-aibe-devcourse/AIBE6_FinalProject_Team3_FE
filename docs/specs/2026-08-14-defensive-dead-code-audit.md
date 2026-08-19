# 방어적/미사용 코드(YAGNI 위반) 전수 감사 — Frontend — 2026-08-14

## 배경

Backend `User.emailVerified` 필드를 "나중에 재확인 정책이 추가될 때를 대비"라는 이유로 추가했다가,
실제로는 어디서도 읽지 않는 write-only 필드임이 드러나 제거했다. 이 계기로 같은 패턴("일단
만들어뒀지만 실제로는 아무 데도 쓰이지 않는 코드")이 다른 곳에도 있는지 8개 도메인(auth/user/
property/checklist/market-data/risk-analysis/contract-analysis/admin) + 공용 코드 전체를 병렬
에이전트로 감사했다. 이 문서는 그중 **frontend(TypeScript/React) 코드에 해당하는 항목만** 추린
것이다 — 백엔드 대응 항목은 `backend/docs/specs/2026-08-14-defensive-dead-code-audit.md`에 별도로
정리되어 있고, 서로 얽힌 항목은 아래에서 상대 문서를 명시적으로 가리켰다.

**방법**: 각 필드/props/exported 함수/타입에 대해 실제 `grep`으로 사용처(import/렌더링 지점)를
추적했고, eslint(미사용 변수 검출)도 함께 활용했다. 감으로 판단한 항목은 없음 — "확실함"과
"애매함"을 구분해 표시했다. 코드 수정은 하지 않았고 보고만 했다.

**주의**: 이 문서는 코드가 실제로 바뀌면 낡은 스냅샷이 된다. 판단이 필요할 때는 항상 지금의 소스를
다시 확인할 것.

---

## 요약 — 도메인별 확실한(CONFIRMED) 발견 건수 (frontend 기준)

| 도메인 | 확실한 죽은 코드 | 특이사항 |
|---|---|---|
| auth | 1건 | |
| user | 0건 | ~~**실제 버그 1건 발견**(WOLSE/MONTHLY_RENT 매핑 불일치 — 수정 필요)~~ — ✅ **(2026-08-14 해결)** |
| property | 1건 | |
| checklist | 0건 | 가장 깨끗한 도메인 |
| market-data/risk-analysis | 4건+ | 백엔드가 내려주는 값을 매퍼가 버리는 패턴 다수 |
| contract-analysis | 1건 | |
| admin | 0건 | 백엔드가 내려주는 필드를 화면에서 렌더링만 안 함(여러 건) |
| 공용(global) | 2건 | **실제 프로덕션 버그 1건**(존재하지 않는 백엔드 엔드포인트 호출) |

---

## 1. Auth 도메인

1. **`API_BASE_URL` export**(`app/lib/api/http.ts:3`) — 다른 모든 파일이 `getApiBaseUrl()`을 통해서만 접근, export 자체가 불필요.

**정리 결과 (2026-08-14, `fix/auth-token-admin-dead-code-cleanup`)**: 1번 삭제 완료 — `export const` → 파일 내부 `const`로 변경.

**애매함(팀이 이미 의도적으로 남긴 것)**:
- `account_blocked` 에러 매핑(`app/login/page.tsx:24`) — "혹시 과거 배포본이 이 코드를 여전히 보내는 경우를 대비해 매핑 자체는 남겨둔다"고 명시적으로 남겨둔 케이스. 현재 backend(`CustomOAuth2UserService`)는 이 코드를 절대 안 보냄(계정 존재 여부 비노출 원칙으로 `oauth_login_failed`에 통일). 100% 죽은 분기이지만 팀이 이미 검토·정당화한 것.
- **`MeResponseDto.email`** — `/auth/me` 등 응답에 backend가 항상 포함시키지만(backend 문서 참고), `getCurrentUser()`를 쓰는 모든 곳(`(main)/layout.tsx`, `MainLayoutGate.tsx`, `mypage/page.tsx`, `oauth/callback/page.tsx`)이 `nickname`/`profileImageUrl`/`role`/`userId`만 읽고 `.email`은 안 읽음.

---

## 2. User 도메인 — 확실한 죽은 코드 없음

**⚠️ 감사 중 발견한 실제 버그(수정 필요)**:
백엔드 `TransactionType` enum은 `JEONSE, MONTHLY_RENT`(backend 문서 참고, backend는 정상)인데,
frontend의 `UserTransactionTypeDto`(`app/types/api.ts:235`)는 `'JEONSE' | 'WOLSE'`로, `app/mappers/
user.ts:10-18`의 매핑 테이블도 `WOLSE` 키만 갖고 있다. 코드 주석(`types/api.ts:233`)은 "표기가 다르다
('WOLSE' vs 'MONTHLY_RENT')"라고 설명하지만, 실제 백엔드가 보내는 값은 `MONTHLY_RENT`다.

**영향**:
- 월세(`MONTHLY_RENT`)로 등록된 유저는 마이페이지에서 관심 거래가 "미설정"으로 조용히 빠짐(`transactionTypeDtoToDomain['MONTHLY_RENT']` → `undefined`).
- 프로필 등록/수정 폼에서 "월세"를 선택해 저장하면 `"WOLSE"`를 백엔드로 보내는데, 이 값은 `TransactionType` enum에 없는 상수라 Jackson 역직렬화 실패로 **저장 자체가 깨질 가능성이 높음**.

**수정 방향**: `UserTransactionTypeDto`와 매핑 테이블의 월세 키를 `'WOLSE'`에서 `'MONTHLY_RENT'`로 맞추면 됨(백엔드는 수정 불필요).

✅ **(2026-08-14 해결)** 위 수정 방향대로 `UserTransactionTypeDto`(`app/types/api.ts`)와 `app/mappers/user.ts`의 매핑 테이블, `app/mocks/init/user.ts`의 mock 데이터까지 `'WOLSE'` → `'MONTHLY_RENT'`로 맞춤. 두 타입이 표기가 다르다던 기존 주석도 "현재 값은 동일하다"로 정정함(`user-design.md`/`cross-domain-summary.md`에도 반영).

부수 발견: `UserProfileResponse.status`(backend가 계산해 내려줌)를 `mapUserProfileDto()`가 안 읽음(backend 문서 참고 — 값 자체가 항상 `"ACTIVE"`라 애초에 분기할 필요가 없음).

---

## 3. Property 도메인

1. **`riskSummaries` / `PropertyRiskSummary`**(`app/data/property-detail.ts:4-26`, `app/types/domain.ts:116-122`) — risk-analysis API 연동 전에 만든 정적 목업 데이터(위험 신호 카드 3개, 아이콘/문구 포함)로, 실제 risk-analysis API 연동 이후에도 지워지지 않고 남음. `grep`으로 import하는 곳 0건 — 프로젝트에서 emailVerified와 가장 유사한 사례.

**애매함**:
- `CreatePropertyResponseDto.marketComparison`/`.address`/`.status`/`.propertyId`(`app/types/api.ts:377-383`) — `createProperty()`가 이 값들을 전부 반환하지만 유일한 호출부(`properties/register/page.tsx:82-98`)는 `response.notice`만 읽음. 코드 자체 주석(94-96행)이 "매물 상세는 아직 이 응답 형태에 안 맞춰져 있어 별도 이슈로 미뤄뒀다"고 이미 인지하고 있는 의도적·임시적 갭.
- `RiskAnalysisSummaryDto`(`propertyId`/`signalCount`/`policyVersion`/`calculatedAt`, `app/types/api.ts:671-678`) — 주석 자체가 "판정 트리거 호출의 반환 타입을 명시하기 위해서일 뿐, 렌더링용이 아니다"라고 명시. 두 호출부 모두 `.then(() => ...)`로 값 자체를 버림 — 의도된 설계.
- `AdminPropertyReportDetailResponse.deposit`/`.monthlyRent`/`.reviewerId`/`.propertyId` — admin 도메인 항목과 중복(아래 "7. Admin" 참고).

---

## 4. Checklist 도메인 — 확실한 발견 없음

`app/(main)/checklists`, `app/(main)/properties/[id]/checklist`, `app/(main)/admin/checklists` 전체를
확인한 결과, `applicablePropertyTypes`/`guideText`/`code` 등 최근 추가된 필드까지 전부 실제
렌더링/폼 로직에 연결되어 있음. `AdminCurrentUserContext`/체크박스 다중선택/일괄처리 상태도 전부
실사용 확인.

**애매함**: `ChecklistResponse.status`/`ChecklistDto.status`(`app/types/api.ts:65`) — backend가 매번
계산해서 내려주지만 `mapChecklistDto()`(`app/mappers/checklist.ts:59-65`)가 버림. `app/types/
domain.ts:151-152`에 "FE가 items로부터 직접 계산하는 summary로 대체되므로 domain 타입엔 보관하지
않는다"는 의도적 설계 코멘트가 있어, 완전한 dead code는 아니고 의도된 설계로 판단됨.

---

## 5. Market-data / Risk-analysis 도메인

1. **`DepositSafetyCheckDto.seniorDepositApplied`/`.seniorDeposit`/`.maxClaimAmount`**(`app/types/api.ts:693-695`) — backend가 응답에 포함하고(backend 문서 참고) mock도 값을 채우지만(`app/mocks/init/risk-analysis.ts:46-48`), `mapDepositSafetyCheckDto()`(`app/mappers/risk-analysis.ts:56-73`)가 domain 객체로 옮길 때 전부 버림. `domain.ts`의 `DepositSafetyCheck` 타입에는 이 필드들 자체가 없음.
2. **`RiskSignal.checkedAt`**(`app/types/domain.ts:318`) — 매퍼가 값을 채워 넣지만(`mappers/risk-analysis.ts:37`) 어떤 컴포넌트도 렌더링 안 함.
3. **`DepositSafetyCheck.calculatedAt`**(`domain.ts:339`) — 마찬가지로 매퍼가 채우지만 렌더링하는 곳 없음.
4. **`RiskSignalList.propertyId` / `DepositSafetyCheck.propertyId`**(`domain.ts:322,331`) — 컴포넌트들이 이미 `propertyId`를 별도 prop/URL 파라미터로 받고 있어, risk 객체에 실린 이 필드는 완전히 중복이고 어디서도 안 읽음.
5. **`riskSummaries`**(`app/data/property-detail.ts`) — 위 "3. Property" 항목과 동일 파일, market-data 관점에서도 독립적으로 발견됨(같은 발견).

**애매함**:
- `mapRiskSignalDto`(`mappers/risk-analysis.ts:31`)가 export되어 있지만 외부 호출부 0건 — 같은 파일 내부에서 `.map(mapRiskSignalDto)`로만 쓰임. 죽은 건 아니고 불필요하게 export된 것.
- mock 데이터(`mocks/init/risk-analysis.ts`)가 `FAILED`/`UNAVAILABLE`류 enum 분기와 `depositSafetyReasonCopy`/`riskCheckReasonCopy`의 reason 문구 대부분(6종 중 5종, 5종 중 4종)을 실제로는 만들어내지 않음 — 실 backend API에서는 나올 수 있어(backend 쪽은 현재 어댑터 구현상 도달 불가로 확인됨, backend 문서 참고) "죽은 코드"는 아니고 "mock/demo 모드로는 검증 안 됨"에 가까움. QA 커버리지 관점에서만 참고.

---

## 6. Contract-analysis 도메인

1. **`ContractInputRequestDto`**(`app/types/api.ts:109-113`) — 주석 자체가 "문서화 용도"라고 명시(실제 요청은 FormData라 이 타입을 쓸 수 없음). `submitContractInput`은 별도의 인라인 유니온 타입(`SubmitContractInputParams`)을 씀. 정의된 순간부터 어디서도 import되지 않는 죽은 타입.

**애매함**:
- **`ContractAnalysisAnalyzeRequest.propertyId`** — frontend(`services/contract-analysis.ts:106`, `ContractResultClient.tsx:265`)가 실제로 채워서 보내지만, backend `ContractAnalysisAnalyzeService.analyze()`가 완전히 무시함(backend 문서의 보안 갭 항목 참고 — frontend 코드 자체는 정상, backend 검증 로직이 빠진 것).
- **`userConfirmed`** — 정식 UI 호출부(`ContractResultClient.tsx:265`)는 항상 리터럴 `true`로만 호출해 사실상 이 경로에서 `false`가 전달될 일이 없음. 다만 backend가 이 값을 실제로 검사하므로(API 직접 호출 시나리오 대비), "미래 대비 죽은 코드"라기보다 "정상 UI에서는 도달 불가능한 방어적 검증"에 가까움.
- **`readyForNextStep`/`requiresUserConfirmation`/`editable`/`confidence`(OCR 평균 신뢰도)** — backend가 전부 계산해서 내려주지만(대부분 backend 쪽에서 "항상 true"로 확인됨, backend 문서 참고) frontend 소비 함수(`extractOcrText`/`maskContractText`)가 필요한 필드만 꺼내 쓰고 이들은 버림.

---

## 7. Admin 도메인 — 확실한 죽은 코드 없음(백엔드 필드 미렌더링 다수)

체크리스트 템플릿 CRUD, 일괄처리(bulk) API 2종, `AdminCurrentUserContext` 등은 전부 backend↔frontend
전 구간 실사용 확인. 아래는 **backend가 응답에 포함하지만 frontend가 렌더링하지 않는** 필드들 —
backend 문서에도 동일 항목이 있으니 참고.

- **`GET /admin/users/{userId}`** — backend 엔드포인트는 있지만(backend 문서 참고), `app/services/admin.ts`/`adminActions.ts` 어디에도 이 GET을 호출하는 함수(`getAdminUserDetail` 등)가 없음.
- **`AdminPropertyReportDetailDto.deposit`/`.monthlyRent`/`.reviewerId`** — `AdminReportsClient.tsx`의 상세 모달 렌더링은 `propertyAddress`/`propertyType`/`transactionType`/`reporterNickname`/`reporterEmail`/`reason`/`detail`/`reviewedAt`/`reviewMemo`만 렌더링, 이 3개 필드는 테스트 픽스처(`AdminReportsClient.test.tsx`)에만 존재.
- **`AdminBulkActionResponse.Failure.errorCode`** — `AdminUsersClient.tsx`/`AdminReportsClient.tsx` 둘 다 실패 목록에서 `message`만 보여주고 `errorCode`는 테스트 픽스처에만 존재.
- **`AdminChecklistItemTemplateResponse.version`** — 테이블 컬럼/폼(`AdminChecklistTemplatesClient.tsx`)에 참조 0건. 다만 backend 내부 버전 정합성 로직에는 실사용되므로 완전한 dead code는 아님(backend 문서 참고).
- **`AdminPropertyReportListItemResponse.detail`** — 목록 응답에 포함되지만 목록 테이블 컬럼엔 없음(상세는 별도 API로 다시 받아옴) — 불필요한 페이로드 전송이지만 심각하지 않음.

**정리 결과 (2026-08-14, `fix/auth-token-admin-dead-code-cleanup`)**: 위 목록 중 GET 미호출/deposit·monthlyRent·reviewerId/errorCode 3건 삭제 완료 — `AdminPropertyReportDetailDto`에서 `propertyId`/`deposit`/`monthlyRent`/`reviewerId` 제거, `AdminBulkActionResponseDto.failures[].errorCode` 제거(mock 레포지토리·mock 초기 데이터·테스트 픽스처 전부 갱신). `version`/`AdminPropertyReportListItemResponse.detail`은 "애매함"으로 분류돼 있어 이번 범위에서 건드리지 않음.

---

## 8. 공용(global) 코드

1. **`Table` 컴포넌트의 `onRowClick` prop**(`app/ui/Table.tsx:26`) — 클릭 핸들러 + `cursor-pointer` 스타일까지 구현돼 있는데, 실제 사용처 3곳(`AdminChecklistTemplatesClient.tsx`, `AdminReportsClient.tsx`, `AdminUsersClient.tsx`) 전부 `selection`/`columns`만 넘기고 `onRowClick`은 안 넘김.
2. ~~**`decodeBase64Url()`**(`app/lib/base64Url.ts:14`) — `encodeBase64Url`과 대칭으로 만들었지만, 실제 디코드 쪽 소비처(`(main)/contract/result/page.tsx:14`, 서버 컴포넌트)는 Node `Buffer.from(data, 'base64url').toString('utf-8')`을 직접 써서 이 함수를 안 부름.~~ — ✅ **(2026-08-19 해결)** `upload`→`result` 전달 방식을 base64url query string에서 `sessionStorage`로 바꾸면서 `app/lib/base64Url.ts` 파일 전체(`encodeBase64Url` 포함)를 삭제함. `result/page.tsx`도 Server Component에서 Client Component로 바뀜(`app/lib/contractResultStorage.ts` 참고).

**⚠️ 감사 중 발견한 실제 프로덕션 버그**: **`ActivityHistoryItemDto`**(`app/types/api.ts:208`)와 그
소비 경로 전체 — `app/services/activityHistory.ts:19`가 `GET /users/me/activity-history`를
호출하는데, **backend에 이 엔드포인트 자체가 없음**(backend 문서 참고, `UserController` 전체 확인
결과 매핑 없음). 호출부(`(main)/home/page.tsx`, `(main)/mypage/page.tsx`)가 try/catch로 감싸 빈
배열로 폴백해 에러가 겉으로 안 드러날 뿐, **실서비스에서 "최근 활동 내역"/"분석한 특약사항 수" 등
이 데이터에 의존하는 화면은 항상 빈 상태로만 보임**. 이미 알려진 "이메일 인증/비밀번호 재설정
누락"처럼 사용자가 인지하고 의도적으로 미룬 스코프일 가능성도 있어 별도 확인 필요.

---

## 다음 단계 제안

- **`app/data/property-detail.ts`의 `riskSummaries`**(완전한 dead code)와 **`Table.onRowClick`**은 바로 제거해도 안전해 보임. ~~`app/lib/base64Url.ts`의 `decodeBase64Url()`~~은 위 8번 항목대로 이미 파일째 제거됨(2026-08-19).
- ~~**User 도메인의 WOLSE/MONTHLY_RENT 매핑 불일치는 실제 저장 실패로 이어질 수 있는 버그라 우선순위 있게 수정 권장**(`app/types/api.ts:235`, `app/mappers/user.ts:10-18`).~~ — ✅ **(2026-08-14 해결)**
- **`GET /users/me/activity-history` 미구현**은 backend와 함께 실사용 여부부터 확인(backend에 구현할지, 이 frontend 호출을 뺄지 결정).
- admin 관련 미렌더링 필드들(`deposit`/`monthlyRent`/`reviewerId`/`errorCode`/`version` 등)은 심각하지 않은 정리 항목이라 여유 있을 때 처리해도 무방.
