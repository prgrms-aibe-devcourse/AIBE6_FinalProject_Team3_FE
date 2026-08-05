import { AlertTriangle, Copy, RefreshCw, Users, type LucideIcon } from 'lucide-react';
import { type ApiStatusTone, type DepositSafetyCheckReasonDto, type RiskCheckReasonDto } from '../types/api';
import { type RiskSignalTypeId } from '../types/domain';

export const riskSignalTypeMeta: Record<
  RiskSignalTypeId,
  { icon: LucideIcon; title: string; iconBoxClass: string; iconClass: string }
> = {
  priceAnomaly: {
    icon: AlertTriangle,
    title: '시세 이상 가격',
    iconBoxClass: 'bg-orange-50',
    iconClass: 'text-orange-600',
  },
  duplicateListing: {
    icon: Copy,
    title: '중복 등록 의심',
    iconBoxClass: 'bg-red-50',
    iconClass: 'text-red-600',
  },
  sameAccountMultiple: {
    icon: Users,
    title: '동일 계정 다수 등록',
    iconBoxClass: 'bg-amber-50',
    iconClass: 'text-amber-600',
  },
  shortTermRelisting: {
    icon: RefreshCw,
    title: '짧은 주기 재등록',
    iconBoxClass: 'bg-blue-50',
    iconClass: 'text-blue-600',
  },
};

// UNDETERMINABLE/FAILED 사유를 화면에 바로 쓸 한글 문구로 변환 - 매퍼(app/mappers/risk-analysis.ts)가 사용한다.
// 내부 오류 계열(POLICY_CALCULATION_ERROR/DATA_FETCH_FAILURE/INTERNAL_ERROR)은 사용자가 구분해서 알
// 필요가 없어 같은 문구로 통일한다.
export const riskCheckReasonCopy: Record<RiskCheckReasonDto, string> = {
  NO_COMPARABLE_TRANSACTION: '비교할 수 있는 실거래 데이터가 없어요',
  ADDRESS_INFO_MISSING: '주소 정보가 부족해 확인할 수 없어요',
  PROPERTY_TYPE_UNSUPPORTED: '이 매물 유형은 아직 지원하지 않아요',
  POLICY_CALCULATION_ERROR: '일시적인 오류로 확인하지 못했어요',
  DATA_FETCH_FAILURE: '일시적인 오류로 확인하지 못했어요',
  INTERNAL_ERROR: '일시적인 오류로 확인하지 못했어요',
};

export const depositSafetyReasonCopy: Record<DepositSafetyCheckReasonDto, string> = {
  ESTIMATED_PRICE_MISSING: '추정 시세 정보가 부족해요',
  DEPOSIT_INFO_MISSING: '보증금 정보가 부족해요',
  TRANSACTION_TYPE_UNSUPPORTED: '월세 매물은 전세가율을 계산하지 않아요',
  CALCULATION_DATA_INVALID: '일시적인 오류로 계산하지 못했어요',
  INTERNAL_ERROR: '일시적인 오류로 계산하지 못했어요',
};

// Backend RiskPolicyConfig 기준선(80/100/150)을 참고하되, FE 톤 타입이 4색뿐이고 slate는 "판정
// 불가"로 이미 예약돼 있어서 주의(80~100%)·경고(100~150%) 2단계를 orange 하나로 의도적으로 합친다.
export function getJeonseRatioTone(jeonseRatio: number): ApiStatusTone {
  if (jeonseRatio >= 150) {
    return 'red';
  }
  if (jeonseRatio >= 80) {
    return 'orange';
  }
  return 'emerald';
}

export const apiStatusToneClassMap: Record<ApiStatusTone, string> = {
  emerald: 'bg-emerald-100 text-emerald-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-500',
};
