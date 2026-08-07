# 위험도 분석(risk-analysis) 도메인 — Frontend 구현 현황 정리

## 배경 / 성격

이 문서는 원래 "Backend도 아직 구현 전"이라는 전제로 쓰여진 **제안 문서**였다. `docs/superpowers/specs/2026-07-31-risk-analysis-ui-design.md`를 브레인스토밍하면서 Backend 소스(`com.algogyeyak.riskanalysis.**`)를 직접 확인해보니 이미 API가 전부 구현되어 있었고, 그 스펙을 기준으로 FE 작업(`docs/superpowers/plans/2026-07-31-risk-analysis-ui.md`)을 완료했다. 이 문서는 그 결과를 다른 도메인 문서(`auth-design.md`, `checklist-design.md` 등)와 같은 성격의 **요구사항 대비 실제 구현 대조 문서**로 다시 정리한 것이다.

**범위**: `app/(main)/properties/[id]/PropertyDetailClient.tsx`의 위험 신호/보증금 안전성 부분, `app/(main)/properties/[id]/risk-analysis/**`, `app/services/risk-analysis.ts`, `app/mappers/risk-analysis.ts`, `app/data/risk-analysis.ts`만 다룬다.

## 실제 Backend API

| 메서드/경로                                                | 설명                                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `POST /properties/{propertyId}/risk-analysis`              | 신호 4종을 판정·저장하고 요약(`signalCount`)만 반환. 몇 번을 불러도 결과가 같은 upsert 구조 |
| `GET /properties/{propertyId}/risk-signals`                | 신호 4종의 현재 상태 전체 목록                                                              |
| `GET /properties/{propertyId}/deposit-safety`              | 보증금 안전성(전세가율) 조회                                                                |
| `POST /properties/{propertyId}/deposit-safety/recalculate` | 선순위보증금 반영 재계산 — **(2026-08-07 갱신) FE 연동 완료**(`RiskAnalysisClient.tsx`)      |

## 주요 화면 / 파일

| 파일                                                                           | 역할                                                                                                   |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `app/(main)/properties/[id]/PropertyDetailClient.tsx`                          | 매물 상세의 "확인 필요 신호" 카드(신호 미리보기 2개) + "보증금 안전성" 미니 섹션                       |
| `app/(main)/properties/[id]/risk-analysis/page.tsx` + `RiskAnalysisClient.tsx` | 신호 4종 전체 + 보증금 안전성 전체를 보여주는 전용 화면 (요구사항엔 없는 화면 — 아래 "추가 구현" 참고) |
| `app/services/risk-analysis.ts`                                                | `POST /risk-analysis`, `GET /risk-signals`, `GET /deposit-safety` 호출                                 |
| `app/mappers/risk-analysis.ts`                                                 | DTO → 도메인 변환, `reason` enum → 한글 안내 문구 변환                                                 |
| `app/data/risk-analysis.ts`                                                    | 신호 타입별 아이콘/제목, 사유별 안내 문구, 전세가율 톤 매핑                                            |

## 위험 신호 판정 — 요구사항 대비

| 요구사항                                              | 실제 구현                                                                                                                                                                                            |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 매물 상세에서 허위매물 의심 신호 확인                 | ✅ 매물 상세 카드에 상위 2개 미리보기, 전용 페이지에서 4종 전체 확인 가능                                                                                                                            |
| "확인 필요 신호 N개 발견" 요약                        | ✅ `GET /risk-signals`의 `signalCount`를 배지로 그대로 표시                                                                                                                                          |
| 판정 불가 사유 안내                                   | ✅ `UNDETERMINABLE`/`FAILED` 상태의 `reason`을 FE 로컬 매핑(`riskCheckReasonCopy`)으로 한글 문구 변환해서 보여줌(예: "주소 정보가 부족해 확인할 수 없어요")                                          |
| 동일 계정 다수 등록 탐지 활성화/비활성화(정책 플래그) | Backend 책임(`RiskPolicyConfig.multiAccountDetectionEnabled`) — FE는 신호 목록에 `SAME_ACCOUNT_MULTIPLE`이 오면 그대로 보여주는 구조라, 이 플래그를 껐다 켰다 해도 FE 코드 변경 없이 자동으로 반영됨 |

## 보증금 안전성 — 요구사항 대비

| 요구사항                                              | 실제 구현                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 보증금 안전성(전세가율) 확인                          | ✅ 매물 상세 미니 섹션(퍼센트 + 톤 배지) + 전용 페이지(설명, 기준일까지 전체)                                                                                                                                                                                                               |
| 판정불가/실패 사유 구분                               | ✅ `UNAVAILABLE`/`FAILED`의 `reason`을 FE 로컬 매핑(`depositSafetyReasonCopy`)으로 변환                                                                                                                                                                                                     |
| "전세만 대상, 월세는 판정불가" 명확 안내              | ✅ `TRANSACTION_TYPE_UNSUPPORTED` 사유가 오면 "월세 매물은 전세가율을 계산하지 않아요"로 표시                                                                                                                                                                                               |
| checklist 소유권취득일 + 높은 전세가율 조합 보조 신호 | ✅ **해결됨** — Backend `DepositSafetyCheckResponse.recentOwnershipChangeWarning`을 그대로 받아서, 보증금 안전성 섹션에 "최근 소유권이 바뀐 매물이에요" 경고 배너로 표시. `checklist-design.md` 남은 이슈 4번("화면에 자리 자체가 없음")이 이걸로 해소됨                                    |
| 150% 초과 시 "입력값을 다시 확인해주세요" 경고        | ✅ **(2026-08-07 정정, 실제로는 이미 구현되어 있었음)** 별도 boolean 필드는 없지만, `DepositSafetyCheckService.buildExplanation()`이 150% 초과 구간에서 "매우 높은 수치라 입력값을 다시 확인해보시는 게 좋아요"를 `explanation` 문장에 직접 포함해서 내려주고, FE `RiskAnalysisClient.tsx`가 그 `explanation`을 그대로 렌더링하고 있어 화면에 이미 뜨고 있음. 이전 버전 문서가 "전용 필드가 없다"를 "문구 자체가 없다"로 잘못 결론 낸 것으로 확인됨 |
| 선순위보증금/근저당 채권최고액 입력                   | ✅ **(2026-08-07 해결)** `RiskAnalysisClient.tsx`에 선순위보증금·근저당 채권최고액 입력 폼(검증 + 로딩/에러 처리 포함)이 구현되어 `POST /deposit-safety/recalculate`를 실제로 호출함. 재계산 결과로 화면이 즉시 갱신됨                                                                       |
| 매물 정보 변경 시 위험 신호/전세가율 최신화           | ✅ **(2026-08-07 확인)** Backend `RiskRecalculationService`가 매물 수정(`PropertyUpdatedEvent`) 커밋 이후 자동으로 신호를 재계산해 DB에 저장(REST 엔드포인트가 아니라 내부 이벤트 리스너). FE는 매물 상세/전용 페이지 진입마다 `GET /risk-signals`·`GET /deposit-safety`를 항상 새로 호출하고 있어 별도 연동 코드 없이 최신값이 자동 반영됨 |

## 요구사항에 없던 추가 구현

- **전용 페이지 `/properties/[id]/risk-analysis`** — 요구사항엔 없는 화면. 매물 상세 카드는 미리보기(신호 2개, 보증금 안전성 요약)만 보여주기로 설계해서, 전체 내용(신호 4종 전체, 보증금 설명/기준일 등)을 볼 별도 진입점이 필요해 추가함
- **전세가율 4단계(안전/주의/경고) → FE 3색 톤으로 축소** — Backend `RiskPolicyConfig`는 80/100/150 기준선(4단계)을 두지만, FE의 기존 `ApiStatusTone`이 4색뿐이고 그중 slate는 "판정 불가"로 이미 쓰고 있어서 주의·경고 2단계를 orange 하나로 합침(`app/data/risk-analysis.ts` 참고)

## 남은 이슈 / 확인 필요 총정리

1. ~~`POST /deposit-safety/recalculate`(선순위보증금 입력 → 정밀 재계산) 미연동~~ ✅ **해결됨(2026-08-07 문서 갱신, 실제 구현은 그 이전 라운드에 완료됨)** — `RiskAnalysisClient.tsx`에 입력 폼과 API 연동이 이미 되어 있었는데 이 문서가 그 뒤로 갱신이 안 돼 있었음. 아울러 위험 신호 쪽도 Backend `RiskRecalculationService`가 매물 수정 시 자동 재계산하도록 이미 구현되어 있어(내부 이벤트 리스너, FE 연동 불필요), risk-analysis 도메인의 "재계산" 관련 항목은 전부 해결된 상태로 확인됨
2. ~~150% 초과 시 "입력값을 다시 확인해주세요" 전용 경고 문구 없음~~ ✅ **해결됨(2026-08-07 정정)** — Backend 응답에 별도 필드는 없지만 `explanation` 문장 자체에 이미 그 문구가 포함되어 내려오고 FE도 그대로 표시 중임을 코드로 확인함(위 "보증금 안전성" 표 참고). Backend 계약 변경 불필요
3. **`/contract/result`("특약사항 분석") 화면의 "보증금" 탭이 여전히 완전 정적 데이터** — `contract-analysis-design.md`에서 이미 지적된 문제. 이번 작업으로 실제 보증금 안전성 데이터 소스(`getDepositSafety`)는 준비됐지만, 그 탭에 실제로 연결하는 작업은 이번 스코프에 포함하지 않음 — 다음에 이 탭을 손볼 때 자연스러운 연동 지점
4. **`app/data/property-detail.ts`의 정적 `riskSummaries`가 죽은 코드로 남음** — 매물 상세 카드가 실데이터로 바뀌면서 더 이상 아무 데서도 참조되지 않지만, 이번 계획 범위 밖이라 삭제하지 않고 그대로 둠
