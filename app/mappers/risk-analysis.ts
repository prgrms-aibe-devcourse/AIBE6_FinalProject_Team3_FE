import { depositSafetyReasonCopy, riskCheckReasonCopy } from '../data/risk-analysis';
import {
  type DepositSafetyCheckDto,
  type RiskCheckStatusDto,
  type RiskSignalDto,
  type RiskSignalListDto,
  type RiskSignalTypeDto,
} from '../types/api';
import {
  type DepositSafetyCheck,
  type DepositSafetyStatusId,
  type RiskCheckStatusId,
  type RiskSignal,
  type RiskSignalList,
  type RiskSignalTypeId,
} from '../types/domain';

const signalTypeMap: Record<RiskSignalTypeDto, RiskSignalTypeId> = {
  PRICE_ANOMALY: 'priceAnomaly',
  DUPLICATE_LISTING: 'duplicateListing',
  SAME_ACCOUNT_MULTIPLE: 'sameAccountMultiple',
  SHORT_TERM_RELISTING: 'shortTermRelisting',
};

const statusMap: Record<RiskCheckStatusDto, RiskCheckStatusId> = {
  SUCCESS: 'success',
  UNDETERMINABLE: 'undeterminable',
  FAILED: 'failed',
};

export function mapRiskSignalDto(dto: RiskSignalDto): RiskSignal {
  return {
    signalType: signalTypeMap[dto.signalType],
    status: statusMap[dto.status],
    reasonText: dto.reason ? riskCheckReasonCopy[dto.reason] : null,
    description: dto.description,
    checkedAt: dto.checkedAt,
  };
}

export function mapRiskSignalListDto(dto: RiskSignalListDto): RiskSignalList {
  return {
    propertyId: dto.propertyId,
    signalCount: dto.signalCount,
    signals: dto.signals.map(mapRiskSignalDto),
    disclaimer: dto.disclaimer,
  };
}

const depositSafetyStatusMap: Record<NonNullable<DepositSafetyCheckDto['status']>, DepositSafetyStatusId> = {
  CALCULATED: 'calculated',
  UNAVAILABLE: 'unavailable',
  FAILED: 'failed',
};

export function mapDepositSafetyCheckDto(dto: DepositSafetyCheckDto): DepositSafetyCheck {
  return {
    propertyId: dto.propertyId,
    status: dto.status ? depositSafetyStatusMap[dto.status] : 'notChecked',
    jeonseRatio: dto.jeonseRatio,
    seniorDepositApplied: dto.seniorDepositApplied,
    seniorDeposit: dto.seniorDeposit,
    maxClaimAmount: dto.maxClaimAmount,
    explanation: dto.explanation,
    referenceDate: dto.referenceDate,
    sampleCount: dto.sampleCount,
    radiusMeters: dto.radiusMeters,
    reasonText: dto.reason ? depositSafetyReasonCopy[dto.reason] : null,
    calculatedAt: dto.calculatedAt,
    disclaimer: dto.disclaimer,
    recentOwnershipChangeWarning: dto.recentOwnershipChangeWarning,
    cautionFrom: dto.cautionFrom,
    warnFrom: dto.warnFrom,
    warnTo: dto.warnTo,
  };
}
