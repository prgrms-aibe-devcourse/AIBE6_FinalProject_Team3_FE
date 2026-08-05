import { mapDepositSafetyCheckDto, mapRiskSignalListDto } from '../mappers/risk-analysis';
import { initDepositSafetyCheckDto, initRiskSignalListDto } from '../mocks/init/risk-analysis';
import { type DepositSafetyCheck, type RiskSignalList } from '../types/domain';

// mock 모드엔 매물별로 분리된 저장소가 없고 전역 고정 데이터 하나뿐이라, 목록의 모든 매물이 같은
// 신호/보증금 안전성 결과를 공유한다 (실제 API 모드에서는 매물마다 실제로 다르게 나온다).
export function getMockRiskSignals(): RiskSignalList {
  return mapRiskSignalListDto(initRiskSignalListDto);
}

export function getMockDepositSafety(): DepositSafetyCheck {
  return mapDepositSafetyCheckDto(initDepositSafetyCheckDto);
}
