import { type DepositSafetyCheckDto, type RiskSignalListDto } from '../../types/api';

export const initRiskSignalListDto: RiskSignalListDto = {
  propertyId: 1,
  signalCount: 2,
  signals: [
    {
      signalType: 'PRICE_ANOMALY',
      status: 'SUCCESS',
      reason: null,
      description: '주변 시세보다 15% 낮은 가격으로 등록되어 있어요.',
      checkedAt: '2026-07-30T09:00:00',
    },
    {
      signalType: 'DUPLICATE_LISTING',
      status: 'SUCCESS',
      reason: null,
      description: '동일한 주소로 등록된 다른 매물이 있어요.',
      checkedAt: '2026-07-30T09:00:00',
    },
    {
      signalType: 'SAME_ACCOUNT_MULTIPLE',
      status: 'SUCCESS',
      reason: null,
      description: null,
      checkedAt: '2026-07-30T09:00:00',
    },
    {
      signalType: 'SHORT_TERM_RELISTING',
      status: 'UNDETERMINABLE',
      reason: 'ADDRESS_INFO_MISSING',
      description: null,
      checkedAt: '2026-07-30T09:00:00',
    },
  ],
  disclaimer: '확정 판단이 아닌 참고용 정보이며, 법률·등기 검토를 대체하지 않습니다.',
};

export const initDepositSafetyCheckDto: DepositSafetyCheckDto = {
  propertyId: 1,
  status: 'CALCULATED',
  jeonseRatio: 85,
  seniorDepositApplied: false,
  seniorDeposit: null,
  maxClaimAmount: null,
  explanation: '전세가율이 80%를 넘어 보증금 반환에 다소 주의가 필요해요.',
  referenceDate: '2026-07-28',
  reason: null,
  calculatedAt: '2026-07-30T09:00:00',
  disclaimer: '확정 판단이 아닌 참고용 정보이며, 법률·등기 검토를 대체하지 않습니다.',
  recentOwnershipChangeWarning: true,
};
