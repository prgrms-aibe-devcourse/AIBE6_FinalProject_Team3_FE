# 계약 문구 분석(contract-analysis) 도메인 — Frontend 구현 현황 정리

## 배경 / 성격

다른 도메인 문서와 같은 성격의 **요구사항 명세서 대비 실제 구현 대조 문서**입니다.

**(2026-08-07 갱신)** 이전 버전은 이 화면이 정적 목업(static mockup) 단계일 때 쓴 스냅샷이었습니다. 그 사이 Backend 4단계 파이프라인(입력 제출 → OCR → 마스킹 → AI 분석)이 실제로 연결됐고, 조항별 추가 질문(미니 채팅) 기능도 새로 붙었습니다. 이번 갱신은 그 시점 기준입니다.

**(2026-08-19 갱신)** `upload` → `result` 화면 간 마스킹 결과 전달 방식이 base64url query string에서 `sessionStorage`로 바뀌었습니다. `result/page.tsx`도 이제 서버 컴포넌트가 아니라 클라이언트 컴포넌트입니다(아래 참고).

**범위**: `app/(main)/contract/upload`, `app/(main)/contract/result`, `app/services/contract-analysis.ts`, `app/mappers/contract-analysis.ts`, `app/lib/contractResultStorage.ts`만 다룹니다.

## 핵심 요약: 입력 → 분석 파이프라인이 실제로 연결됨

이전 버전에서 가장 크게 지적했던 문제("무엇을 입력하든 항상 같은 하드코딩된 문장이 분석됨")는 해소됐습니다.

- `app/(main)/contract/upload/page.tsx`의 "직접 입력" `<textarea>`는 이제 완전한 controlled component입니다(`value`/`onChange`로 `text` state 관리).
- 이미지 드래그앤드롭/파일 선택(`<input type="file" accept="image/*">`)이 실제로 파일을 받아 `File` 객체로 저장하고, `URL.createObjectURL`로 썸네일 미리보기까지 보여줍니다. JPG/PNG 타입만 허용(`ACCEPTED_IMAGE_TYPES`), 아니면 에러 메시지.
- "특약사항 분석하기" 버튼 클릭 시 실제로 `submitContractInput` → (이미지면) `extractOcrText` → `maskContractText`를 순차 호출합니다. 각 단계 진행 상태가 로딩 배너로 표시됩니다.
- 마스킹된 결과(`maskedText`/`maskedCount`/`uncertainFields`/`shortTextWarning`/`propertyId`)는 서버에 저장하지 않는 정책이라, `sessionStorage`에 잠깐 담아둔 뒤 데이터 없이 순수하게 `/contract/result`로 이동합니다(`app/lib/contractResultStorage.ts`의 `saveContractMaskingReview`). `result` 페이지는 마운트되자마자 `readAndClearContractMaskingReview()`로 읽고 바로 지워서, 새로고침/뒤로가기로 재방문해도 이전 데이터가 남지 않습니다. `sessionStorage`는 브라우저 전용 API라 `result/page.tsx`도 서버 컴포넌트에서 클라이언트 컴포넌트로 바뀌었고, 읽기 전 짧은 로딩 스피너를 거칩니다.
- `/contract/result`는 그 마스킹 결과를 화면 상단에 고정 표시하고, 사용자가 "이대로 분석 진행"을 눌러야 `analyzeContract`가 호출됩니다 — **페이지 이동 없이 같은 화면 아래로 결과가 이어서 렌더링**됩니다.

즉 입력(텍스트/이미지) → OCR → 마스킹 → AI 분석까지 사용자가 실제로 입력한 값이 그대로 흘러갑니다. `demoSpecialTermsText` 같은 하드코딩된 데모 문자열은 더 이상 없습니다.

## 계약 문구 입력 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| 이미지 등록 또는 텍스트 직접 입력 | ✅ 텍스트 입력(controlled textarea), 이미지 업로드(드래그앤드롭 + 파일 선택 + 미리보기) 둘 다 실제로 값을 캡처. 단, 동시에 둘 다 입력한 경우는 나중에 입력한 쪽이 이전 선택을 자동으로 해제(상호 배타) |
| 선택적으로 매물 연결 | ❌ 여전히 미구현 — 매물을 선택/연결하는 UI 자체가 없음. `submitContractInput`/`analyzeContract` 요청 DTO엔 `propertyId?: number`가 optional로 이미 있지만, 화면에서 채울 방법이 없어 항상 보내지 않음(아래 "남은 이슈" 1번 참고) |
| 이미지 형식/크기 검증 | ⚠️ 형식 검증만 있음(`image/jpeg`, `image/png`만 허용, 아니면 에러 메시지). ~~**크기 제한 검증은 여전히 없음**~~ — ✅ **(2026-08-12 정정)** `upload/page.tsx` L12(`MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024`)/L61-64가 10MB 초과 파일을 클라이언트에서 막는다(아래 "전수조사 결과" 버그/정확성 1번 참고). 다만 이 10MB 한도는 서버 멀티파트 기본 한도(1MB)와 실제로 불일치함 |
| 텍스트 최소 조건 검증 | ⚠️ 빈 문자열만 막음(trim 후 길이 0이면 제출 버튼 비활성화). 최소 글자 수 같은 세부 조건은 없음 |
| 매물 소유 확인 | N/A — 매물 연결 기능 자체가 없음(위와 동일) |
| 실패 사유 6종 제공 | ⚠️ `submitError` 문구 하나로 뭉뚱그림(다른 도메인과 같은 pass-through 패턴, `cross-domain-summary.md` 패턴 1 참고) |

## OCR 텍스트 추출 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| 이미지 → OCR API 호출 → 텍스트 추출 | ✅ `extractOcrText()`가 `POST /contract-analysis/ocr`(multipart)을 호출해 `extractedText`를 받음 |
| 추출된 텍스트를 사용자가 수정 가능하게 제공 | ⚠️ **의도적으로 화면 흐름을 바꿈** — 이전엔 OCR 결과를 별도 확인 화면에서 사용자가 검토/수정하게 했는데, 지금은 OCR → 마스킹까지 자동으로 이어서 처리하도록 요구사항이 바뀌었습니다(사용자 지시로 확인 단계 제거). 대신 마스킹된 최종 결과를 `/contract/result`에서 확인/수정("수정하기" 버튼)할 수 있음 |
| OCR 실패 시 직접 입력 안내 | N/A — Backend가 OCR 신뢰도가 낮아도 더 이상 422로 거부하지 않고 항상 200 + `uncertainFields`(신뢰도 낮은 구간)로 응답하도록 정책이 바뀜. FE는 이 `uncertainFields`를 마스킹 확인 화면에 "이 부분들은 인식이 애매했어요" 안내로 표시(자동으로 막지는 않음) |

## 개인정보 마스킹 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| 전화번호/주민등록번호/계좌번호 등을 시스템이 정규식·라벨 기반으로 마스킹 | ✅ `maskContractText()`가 `POST /contract-analysis/masking`을 호출해 실제 마스킹 처리(`maskedText`, `maskedCount` 응답) |
| 사용자가 마스킹 결과를 확인 | ✅ `/contract/result` 진입 시 마스킹된 텍스트를 화면 상단에 고정 표시(스크롤 가능한 200px 박스 + "전체 보기" 토글). 표시 전 짧은 줄 병합/빈 괄호 제거 등 가독성 정리를 거치지만, 실제 분석에는 원본 그대로 전송 |
| 마스킹 결과는 서버 저장 없이 프론트에서만 확인 시점까지 보관 | ✅ 서버는 아무 것도 저장하지 않는 정책이고, FE도 마스킹 결과를 `sessionStorage`에 잠깐만 담아두고 `result` 화면이 읽는 즉시 지움(탭을 닫아도 자동 소멸, `localStorage` 같은 영구 저장소는 안 씀) |
| 마스킹 확인 안 하면 AI 분석 요청 안 함 | ✅ "이대로 분석 진행" 버튼을 눌러야만 `analyzeContract`가 호출됨. 그 전엔 `maskedText`만 화면에 있을 뿐 분석 요청 자체가 안 나감 |

기존에 있던 "특약사항만 올렸어요"/"개인정보 가렸어요"/"동의합니다" 자가 체크 3개는 그대로 남아있고, 여전히 입력 단계(업로드 화면)에서 제출 전 게이트로 쓰입니다 — 다만 이제는 그 뒤에 **실제 시스템 마스킹과 확인 화면이 이어지므로**, 이 체크박스는 "자가 신고"가 마스킹을 대체하던 예전과 달리 마스킹 이전 단계의 보조 확인 장치 역할로 성격이 바뀌었습니다.

## AI 계약 문구 분석 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| 확인된 마스킹 텍스트만 AI로 전송 | ✅ `/contract/result`에서 사용자가 확인한(또는 "수정하기"로 고친 뒤 다시 확인한) `maskedText`가 그대로 `analyzeContract(maskedText, true)`에 전송됨 |
| 위험 여부/이유/쉬운 설명/확인 질문/수정 예시 제공 | ✅ `ContractClause`가 `originalText`/`riskFlag`/`explanation`/`question`/`suggestedText`를 담고, 아코디언 카드로 전부 표시(접었을 땐 원문+뱃지만, 펼치면 나머지) |
| "AI가 생성한 결과입니다" 고지 상시 포함 | ⚠️ **의도적으로 조항 단위가 아니라 페이지 단위로 통합** — `aiGeneratedNotice`+`disclaimer`를 페이지 상단(요약카드 근처)에 한 번만 명확하게 표시. 사용자 지시로 "조항/답변마다 반복 표시하지 않고 한 번만" 보여주도록 확정됨(요구사항 문구를 엄격히 따지면 조항 단위였지만, 실사용성 관점에서 페이지 단위로 재설계) |
| 법적 효력 없는 참고 정보 안내 | ✅ 위 통합 고지에 `disclaimer` 포함 |
| 수정 요청 문구에 "법률적 정답 아닌 협의용 예시" 안내 | ⚠️ 개별 문구 옆이 아니라 여전히 페이지 공통 고지 하나로 대체(위와 같은 이유) |
| AI 응답 구조/입력에 없는 내용 포함 여부 서버 검증 | Backend 책임, FE 범위 밖 |
| 실패 사유 6종 제공 | ⚠️ `analysisError` 문구 하나로 뭉뚱그림(다른 도메인과 동일 패턴) |

## AI 조항별 채팅 (요구사항 문서에 없던 신규 기능)

각 조항 아코디언 카드를 펼치면 "더 궁금한 점이 있으신가요?" 미니 채팅이 있습니다.

- `sendContractClauseQuestion(clause, question, history?)`가 `POST /contract-analysis/chat`을 호출. `clause`(originalText/riskFlag/explanation)와 그 조항 안에서의 대화 이력을 매번 같이 실어 보냄(서버 무저장 정책과 동일한 이유).
- 조항 index별로 완전히 독립된 대화 상태 — 다른 조항 카드와 안 섞임.
- 질문 전송 시 응답을 기다리지 않고 질문 말풍선을 즉시 추가(낙관적 렌더링)하고, 그 자리에 로딩 표시 후 응답이 오면 답변으로 교체.
- "답변은 AI가 생성한 참고용 정보입니다" 고지를 채팅 섹션 상단에 1회만 표시(응답마다 반복 안 함).
- 재분석("이대로 분석 진행" 재클릭)하면 이전 clauses index에 묶여있던 채팅 이력은 초기화됨(새 조항 내용과 안 섞이게).

## 비기능 요구사항 — 대조

| 항목 | 요구사항 | 실제 |
| --- | --- | --- |
| 이미지/마스킹 전 텍스트를 로그에 미기록 | O | ✅ FE에서 별도로 콘솔/서버에 로그를 남기지 않음 |
| 마스킹 확인 전 AI API로 미전송 | O | ✅ "이대로 분석 진행" 클릭 전엔 `analyzeContract` 호출 자체가 없음 |
| 외부 API 전달 데이터 최소화 | O | Backend 책임 |
| 이미지 원본 임시 저장 후 삭제 | O | FE 관점에선 `URL.createObjectURL`로 브라우저 메모리에만 잠깐 두고 선택 해제/언마운트 시 `revokeObjectURL`로 정리. 서버 임시저장/삭제는 Backend 책임 |
| 외부 API 인증키 클라이언트 미노출 | O | ✅ FE 코드/env 어디에도 OCR/AI API 키가 없음 |
| AI 결과가 입력 근거 기반 | O | 확인 불가 — AI 응답 품질 자체는 Backend/모델 영역 |
| 위험 분석 결과를 원문과 연결 | O | ✅ 각 `ContractClause`가 `originalText`를 담고 아코디언 헤더에 항상 표시 |
| 판단 이유·확인 방법 함께 제공 | O | ✅ `explanation`(설명)/`question`(확인 질문) 둘 다 표시 |
| AI 응답 구조를 서버가 검증 | O | Backend 책임 |
| OCR 결과를 AI 분석 전 사용자가 수정 가능 | O | ⚠️ OCR 결과 자체를 별도로 수정하는 단계는 없지만(위 참고), 마스킹된 최종 텍스트는 분석 전 `/contract/result`에서 "수정하기"로 고칠 수 있음 |
| 어려운 법률 용어를 쉽게 설명 | O | ✅ `explanation` 필드로 조항마다 설명 제공 |
| 수정 요청 문구가 협의용 예시임을 안내 | O | ⚠️ 페이지 공통 고지로만(위 참고) |
| 계약 조항 분석과 보증금 안전성 체크를 구분 표시 | O | ✅ 탭으로 분리(`risk`/`deposit`/`missing`) — **"deposit"/"missing" 탭은 여전히 `data/contract-analysis.ts`의 완전한 정적 목데이터**. market-data/risk-analysis 도메인이 아직 안 붙어서 그대로 둠(스코프 밖) |
| 분석 진행 중 로딩 상태 표시 | O | ✅ 입력 제출/OCR/마스킹 단계별 로딩 배너(업로드 화면), AI 분석 단계는 별도로 강조된 로딩 배너("최대 40초 정도 걸릴 수 있어요", result 화면) |
| OCR 실패 시 직접 입력 제공 | O | N/A — OCR이 더 이상 "실패"로 거부되지 않음(위 참고) |
| AI API 실패 시 무제한 재시도 금지 | O | Backend 책임. FE는 자동 재시도 로직 자체가 없고, 실패하면 에러 메시지만 보여주고 사용자가 직접 버튼을 다시 눌러야 함 |
| 동일 분석 요청 중복 제출 방지 | O | ✅ 이제 의미 있게 동작 — 처리 중(`processingStep`)엔 버튼이 비활성화되어 중복 클릭이 막힘 |
| 분석 실패 시 입력 내용이 즉시 사라지지 않음 | O | ✅ 마스킹된 텍스트는 화면에 계속 고정 표시되고, 분석 실패해도 사라지지 않음(재시도 가능) |
| OCR/AI 응답시간 제한, 이미지 크기 제한, 모니터링 | O | Backend/인프라 영역, FE 범위 밖 |

## 요구사항에 없던 추가 구현

- "보증금 안전성"/"누락 항목" 탭 — 요구사항 문서의 contract-analysis 섹션엔 없는 내용(risk-analysis/market-data 도메인에 가까움). 여전히 완전 정적 데이터
- AI 조항별 채팅 — 위 별도 섹션 참고. 요구사항 문서엔 없던 기능
- PDF 저장/결과 공유/전문가 상담 버튼 — 여전히 실제 기능 없음. 다만 예전처럼 조용히 죽은 버튼이 아니라, **명시적으로 `disabled` + "준비 중인 기능이에요" 툴팁**으로 바뀜(장식과 의도적 비활성화는 다름)
- 클립보드 복사(질문 문구/수정 문구) — 요구사항엔 없던 편의 기능. `navigator.clipboard.writeText()`로 실제 동작

## 남은 이슈 / 확인 필요 총정리

1. **propertyId 연결이 여전히 끊겨 있음** — "입구"(매물 상세/체크리스트 화면에서 `/contract/upload`로 이동할 때 propertyId 전달)와 "출구"(`/contract/result`에서 체크리스트로 돌아갈 때 그 propertyId 사용) 둘 다 아직 안 됨. 출구 쪽 하드코딩(`<Link href="/properties/1/checklist">`)은 제거하고 `propertyId` prop이 없으면 버튼 자체를 숨기도록 고쳤지만, 애초에 입구에서 propertyId를 받는 방법이 없어서 이 버튼은 사실상 항상 안 보이는 상태. `checklist-design.md`에서도 같은 이슈를 다른 방향에서 언급 중(브레인스토밍만 하고 미해결)
2. ~~**이미지 크기 제한 검증이 FE에 없음** — 형식(jpeg/png)만 확인하고 파일 크기는 확인 안 함~~ — ✅ **(2026-08-12 정정)** 해소됨. `upload/page.tsx` L12/L61-64에 10MB 클라이언트 검증이 이미 있다(아래 "전수조사 결과" 버그/정확성 1번 참고). 다만 서버 멀티파트 기본 한도(1MB)와 불일치해 FE 검증을 통과해도 서버에서 실패할 수 있는 문제는 남아있음
3. **매물 선택 UI 자체가 없음** — `propertyId`를 optional로 보낼 수 있는 요청 DTO는 이미 있지만 채울 UI가 없어 실질적으로 항상 비워둠(1번과 연결된 문제)
4. **"보증금 안전성"/"누락 항목" 탭이 여전히 완전 정적 데이터** — market-data/risk-analysis 도메인이 준비돼야 실제 데이터로 채울 수 있음
5. **"AI 생성 결과"/"협의용 예시" 고지가 조항/문구 단위가 아니라 페이지·섹션 단위로 통합됨** — 요구사항 문구를 엄격히 따지면 다르지만, 사용자 지시로 의도적으로 이렇게 확정함(반복 표시가 오히려 UX를 해친다고 판단)
6. **실패 사유가 여전히 단일 에러 메시지로 뭉뚱그려짐** — 입력 제출/OCR/마스킹/분석 각 단계 실패가 전부 `submitError`/`analysisError` 문구 하나로만 표시됨(다른 도메인과 같은 반복 패턴, `cross-domain-summary.md` 패턴 1 참고)

## 전수조사 결과 (2026-08-12)

### 버그/정확성

1. **문서의 "이미지 크기 제한 검증은 여전히 없음"(입력 표 4번째 행, 남은 이슈 2번) 서술이 더 이상 사실과 다름.** 코드를 직접 확인한 결과 `app/(main)/contract/upload/page.tsx` L12(`MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024`)와 L61-64(`if (file.size > MAX_IMAGE_SIZE_BYTES) { setSubmitError('10MB 이하 이미지만 업로드 가능합니다.'); return; }`)에서 이미 클라이언트 측 크기 검증을 하고 있다. 2026-08-07 문서 작성 이후 코드가 추가된 것으로 보이며, 위 두 항목은 문서 최신화가 필요하다. 다만 이 FE 상수(10MB)는 backend 문서에 정리한 것처럼 실제 서버 멀티파트 기본 한도(파일당 1MB)와 불일치한다 — FE 검증을 통과한 1~10MB 사이 파일도 서버에서 500으로 실패할 수 있고, 사용자에게는 `getContractAnalysisErrorMessage`를 거친 뭉뚱그려진 `submitError` 문구("특약사항 분석에 실패했습니다...")만 노출되어 원인을 알기 어렵다(기존 "실패 사유가 단일 에러 메시지로 뭉뚱그려짐" 이슈의 구체적 사례).

### 보안

1. `dangerouslySetInnerHTML` 사용 여부를 포함해 `app/(main)/contract/**` 전체를 확인했으며, AI 응답 텍스트(`explanation`/`question`/`suggestedText`/채팅 `answer`)는 모두 JSX 텍스트 노드로만 렌더링되어 React가 자동으로 이스케이프한다 — 별도의 XSS 벡터는 발견되지 않음.
2. ~~(경미) 마스킹된 텍스트 전체가 `/contract/result?data=...` URL 쿼리 파라미터에 base64url로 담겨 전달된다(`upload/page.tsx`의 `navigateToMaskingReview`, `result/page.tsx`의 `decodeMaskingReviewPayload`). PII는 이미 서버 마스킹을 거친 상태라 심각도는 낮지만, 계약 특약사항 원문 자체는 그대로 URL에 노출되므로 브라우저 히스토리나 서버/CDN 액세스 로그에 남을 수 있다.~~ — ✅ **(2026-08-19 정정)** 해소됨. 전달 방식을 URL 쿼리 파라미터에서 `sessionStorage`로 바꿔서(`app/lib/contractResultStorage.ts`) 더 이상 계약 특약사항 원문이 URL에 노출되지 않는다. `result` 페이지가 마운트 직후 읽고 바로 `removeItem`하므로 브라우저 히스토리/서버·CDN 액세스 로그에도 남지 않는다.

### 코드 품질 (중복/구조/일관성)

1. 이미지 크기 상한(10MB) 상수가 FE(`upload/page.tsx` L12)와 BE(`ContractAnalysisInputService`/`ContractAnalysisOcrService`, 각각 10MB) 3곳에 독립적으로 하드코딩되어 있고, 그마저 서로 실제로 다른 한도(서버는 멀티파트 기본값 1MB에 막혀 시행되지 않음, 위 backend 문서 참고)로 동작한다 — 단일 정책 소스가 없어 FE만 보고는 실제 서버 동작을 예측할 수 없는 구조.
