import { useMockData } from '../config/dataSource';
import { requestJson } from '../lib/api/http';
import { mapDepositSafetyCheckDto, mapRiskSignalListDto } from '../mappers/risk-analysis';
import { getMockDepositSafety, getMockRiskSignals } from '../repositories/riskAnalysisRepository';
import {
  type DepositSafetyCheckDto,
  type DepositSafetyRecalculateRequestDto,
  type RiskAnalysisSummaryDto,
  type RiskSignalListDto,
} from '../types/api';
import { type DepositSafetyCheck, type RiskSignalList } from '../types/domain';

function authHeaders(cookieHeader?: string) {
  return cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined;
}

// 신호 4종을 판정·저장한다. 몇 번을 불러도 결과가 같은 upsert 구조(Backend 주석 참고)라 매물 상세
// 진입마다 호출해도 안전하다. 응답은 요약(signalCount)뿐이라 화면 렌더링엔 안 쓰고 트리거 용도로만 쓴다.
export async function checkRiskSignals(propertyId: number, cookieHeader?: string): Promise<RiskAnalysisSummaryDto> {
  if (useMockData) {
    const signals = getMockRiskSignals();
    return {
      propertyId,
      signalCount: signals.signalCount,
      policyVersion: 'mock',
      calculatedAt: new Date().toISOString(),
    };
  }

  return requestJson<RiskAnalysisSummaryDto>(`/properties/${propertyId}/risk-analysis`, {
    method: 'POST',
    ...authHeaders(cookieHeader),
  });
}

export async function getRiskSignals(propertyId: number, cookieHeader?: string): Promise<RiskSignalList> {
  if (useMockData) {
    return getMockRiskSignals();
  }

  const dto = await requestJson<RiskSignalListDto>(`/properties/${propertyId}/risk-signals`, authHeaders(cookieHeader));
  return mapRiskSignalListDto(dto);
}

export async function getDepositSafety(propertyId: number, cookieHeader?: string): Promise<DepositSafetyCheck> {
  if (useMockData) {
    return getMockDepositSafety();
  }

  const dto = await requestJson<DepositSafetyCheckDto>(
    `/properties/${propertyId}/deposit-safety`,
    authHeaders(cookieHeader),
  );
  return mapDepositSafetyCheckDto(dto);
}

// 사용자가 입력한 선순위보증금(+근저당 채권최고액)을 반영해 전세가율을 다시 계산한다. 클라이언트
// 컴포넌트(RiskAnalysisClient)에서 폼 제출 시에만 호출하는 뮤테이션이라 SSR 로더용 cookieHeader
// 파라미터는 두지 않는다 - deleteProperty/reportProperty와 동일한 패턴.
export async function recalculateDepositSafety(
  propertyId: number,
  request: DepositSafetyRecalculateRequestDto,
): Promise<DepositSafetyCheck> {
  if (useMockData) {
    return getMockDepositSafety();
  }

  const dto = await requestJson<DepositSafetyCheckDto>(`/properties/${propertyId}/deposit-safety/recalculate`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
  return mapDepositSafetyCheckDto(dto);
}
