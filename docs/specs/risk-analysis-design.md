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
| `POST /properties/{propertyId}/deposit-safety/recalculate` | 선순위보증금 반영 재계산 — **FE 미연동**(아래 "남은 이슈" 참고)                             |

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
| 150% 초과 시 "입력값을 다시 확인해주세요" 경고        | ⚠️ **부분 구현.** 실제 `DepositSafetyCheckResponse`엔 이 경고 전용 필드(예: `exceedsRecommendedRatio`)가 없다 — `jeonseRatio` 자체가 150% 이상이면 톤 배지가 red로 바뀌긴 하지만, "입력값 오류일 수 있다"는 별도 안내 문구는 없음. Backend에 값 검증/경고 필드가 추가되면 다시 볼 필요 있음 |
| 선순위보증금/근저당 채권최고액 입력                   | ❌ **이번 스코프에서 제외.** `POST /deposit-safety/recalculate` 자체를 호출하지 않음. 전용 페이지에 "선순위보증금을 반영하면 더 정확하게 계산할 수 있어요 (곧 지원 예정)" placeholder 카드만 있음                                                                                           |

## 요구사항에 없던 추가 구현

- **전용 페이지 `/properties/[id]/risk-analysis`** — 요구사항엔 없는 화면. 매물 상세 카드는 미리보기(신호 2개, 보증금 안전성 요약)만 보여주기로 설계해서, 전체 내용(신호 4종 전체, 보증금 설명/기준일 등)을 볼 별도 진입점이 필요해 추가함
- **전세가율 4단계(안전/주의/경고) → FE 3색 톤으로 축소** — Backend `RiskPolicyConfig`는 80/100/150 기준선(4단계)을 두지만, FE의 기존 `ApiStatusTone`이 4색뿐이고 그중 slate는 "판정 불가"로 이미 쓰고 있어서 주의·경고 2단계를 orange 하나로 합침(`app/data/risk-analysis.ts` 참고)

## 남은 이슈 / 확인 필요 총정리

1. **`POST /deposit-safety/recalculate`(선순위보증금 입력 → 정밀 재계산) 미연동** — 화면엔 비활성 placeholder만 있고 실제 입력 폼/호출이 없음. 다음 라운드 작업 대상
2. **150% 초과 시 "입력값을 다시 확인해주세요" 전용 경고 문구 없음** — Backend 응답에 이 판단을 위한 필드 자체가 없어서, 추가하려면 Backend 계약 변경이 선행되어야 함
3. **`/contract/result`("특약사항 분석") 화면의 "보증금" 탭이 여전히 완전 정적 데이터** — `contract-analysis-design.md`에서 이미 지적된 문제. 이번 작업으로 실제 보증금 안전성 데이터 소스(`getDepositSafety`)는 준비됐지만, 그 탭에 실제로 연결하는 작업은 이번 스코프에 포함하지 않음 — 다음에 이 탭을 손볼 때 자연스러운 연동 지점
4. **`app/data/property-detail.ts`의 정적 `riskSummaries`가 죽은 코드로 남음** — 매물 상세 카드가 실데이터로 바뀌면서 더 이상 아무 데서도 참조되지 않지만, 이번 계획 범위 밖이라 삭제하지 않고 그대로 둠
