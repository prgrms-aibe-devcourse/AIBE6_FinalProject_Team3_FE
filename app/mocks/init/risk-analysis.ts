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
      // 참고: 실제 backend는 이 신호를 아직 계산하지 않는다(multi-account-detection-enabled
      // 플래그가 false) — 이 mock은 목업/데모 화면 확인용으로 "정상 판정된 것처럼" 값을
      // 채워둔 것일 뿐, 이 값을 보고 기능이 이미 활성화됐다고 오해하지 않도록 주의.
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
  sampleCount: 5,
  radiusMeters: 300,
  reason: null,
  calculatedAt: '2026-07-30T09:00:00',
  disclaimer: '확정 판단이 아닌 참고용 정보이며, 법률·등기 검토를 대체하지 않습니다.',
  recentOwnershipChangeWarning: true,
  cautionFrom: 80,
  warnFrom: 100,
  warnTo: 150,
};
