'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowLeft, HelpCircle, ImageOff } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { apiStatusToneClassMap, getJeonseRatioTone, riskSignalTypeMeta } from '../../../../data/risk-analysis';
import { cn } from '../../../../lib/cn';
import { formatIntegerInput } from '../../../../lib/numberFormat';
import { recalculateDepositSafety } from '../../../../services/risk-analysis';
import { type DepositSafetyCheck, type PropertyDetail, type RiskSignalList } from '../../../../types/domain';
import { Badge } from '../../../../ui/Badge';
import { Modal } from '../../../../ui/Modal';
import { NoticeBox } from '../../../../ui/NoticeBox';

type RiskAnalysisClientProps = {
  propertyId: number;
  riskSignals?: RiskSignalList;
  depositSafety?: DepositSafetyCheck;
  loadError?: string;
  property?: PropertyDetail;
};

const statusLabelMap: Record<'success' | 'undeterminable' | 'failed', string> = {
  success: '확인 완료',
  undeterminable: '판정 불가',
  failed: '확인 실패',
};

export function RiskAnalysisClient({
  propertyId,
  riskSignals,
  depositSafety: initialDepositSafety,
  loadError,
  property,
}: RiskAnalysisClientProps) {
  // 재계산 결과로 화면을 갱신해야 해서 prop을 그대로 안 쓰고 로컬 state로 옮겨 담는다.
  const [depositSafety, setDepositSafety] = useState(initialDepositSafety);
  // 이전에 재계산이 적용된 결과라면(seniorDepositApplied), 새로고침 후에도 입력창이 빈 값으로
  // 보이지 않도록 이미 반영된 값으로 초기화한다 - 안 그러면 사용자가 "반영이 안 됐나?" 하고
  // 같은 값을 또 입력하거나, 이미 반영된 근저당 채권최고액을 빼먹고 재계산해버릴 수 있다.
  const [seniorDeposit, setSeniorDeposit] = useState(() =>
    initialDepositSafety?.seniorDepositApplied && initialDepositSafety.seniorDeposit !== null
      ? formatIntegerInput(String(initialDepositSafety.seniorDeposit))
      : '',
  );
  const [maxClaimAmount, setMaxClaimAmount] = useState(() =>
    initialDepositSafety?.seniorDepositApplied && initialDepositSafety.maxClaimAmount !== null
      ? formatIntegerInput(String(initialDepositSafety.maxClaimAmount))
      : '',
  );
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalculateError, setRecalculateError] = useState<string | null>(null);
  const [isSeniorDepositHelpOpen, setIsSeniorDepositHelpOpen] = useState(false);

  async function handleRecalculate() {
    setRecalculateError(null);
    const seniorDepositNumber = Number(seniorDeposit.replace(/,/g, ''));
    if (!seniorDeposit || Number.isNaN(seniorDepositNumber) || seniorDepositNumber < 0) {
      setRecalculateError('선순위보증금을 올바르게 입력해주세요.');
      return;
    }

    const maxClaimAmountNumber = maxClaimAmount ? Number(maxClaimAmount.replace(/,/g, '')) : undefined;
    if (maxClaimAmountNumber !== undefined && (Number.isNaN(maxClaimAmountNumber) || maxClaimAmountNumber < 0)) {
      setRecalculateError('근저당 채권최고액을 올바르게 입력해주세요.');
      return;
    }

    setIsRecalculating(true);
    try {
      const updated = await recalculateDepositSafety(propertyId, {
        seniorDeposit: seniorDepositNumber,
        maxClaimAmount: maxClaimAmountNumber,
      });
      setDepositSafety(updated);
    } catch {
      setRecalculateError('재계산에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsRecalculating(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="container mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link href={`/properties/${propertyId}`} className="-ml-2 p-2 text-slate-500 hover:text-slate-950">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-950">위험 신호 분석</h1>
            {property && (
              <p className="text-xs text-slate-500">
                {property.type} · {property.title} · {property.address}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-6">
        {loadError && (
          <div className="ansim-card mb-6 border-red-100 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
        )}

        {property &&
          (property.images.length > 0 ? (
            <div className="relative mb-6 h-40 w-full overflow-hidden rounded-2xl">
              <Image
                src={property.images[0].imageUrl}
                alt={property.title}
                fill
                sizes="(min-width: 768px) 640px, 100vw"
                className="object-cover"
              />
            </div>
          ) : (
            <div className="mb-6 flex h-40 w-full flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 text-slate-400">
              <ImageOff className="h-8 w-8" />
              <p className="text-sm">등록된 사진이 없어요</p>
            </div>
          ))}

        {riskSignals && (
          <div className="ansim-card mb-6 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">허위매물 의심 신호</h2>
              <Badge className="bg-orange-100 px-3 text-orange-700">{riskSignals.signalCount}개 발견</Badge>
            </div>
            <div className="space-y-6">
              {riskSignals.signals.map((signal) => {
                const meta = riskSignalTypeMeta[signal.signalType];
                const SignalIcon = meta.icon;
                const hasRisk = signal.status === 'success' && signal.description !== null;
                return (
                  <div key={signal.signalType} className="flex gap-4">
                    <div
                      className={cn(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        hasRisk ? meta.iconBoxClass : 'bg-slate-100',
                      )}
                    >
                      <SignalIcon className={cn('h-5 w-5', hasRisk ? meta.iconClass : 'text-slate-400')} />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-950">{meta.title}</p>
                        <Badge className="bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">
                          {statusLabelMap[signal.status]}
                        </Badge>
                      </div>
                      <p className="text-xs leading-relaxed text-slate-500">
                        {signal.description ?? signal.reasonText ?? '확인된 리스크가 없어요.'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {depositSafety && (
          <div className="ansim-card mb-6 bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">보증금 안전성</h2>
              {depositSafety.status === 'calculated' && depositSafety.jeonseRatio !== null ? (
                <Badge
                  className={
                    apiStatusToneClassMap[
                      getJeonseRatioTone(depositSafety.jeonseRatio, depositSafety.cautionFrom, depositSafety.warnTo)
                    ]
                  }
                >
                  전세가율 {depositSafety.jeonseRatio}%
                </Badge>
              ) : (
                <Badge className={apiStatusToneClassMap.slate}>판정 불가</Badge>
              )}
            </div>

            {depositSafety.status === 'calculated' ? (
              <>
                <p className="mb-4 text-sm leading-relaxed text-slate-600">{depositSafety.explanation}</p>
                {depositSafety.referenceDate && (
                  <p className="mb-1 text-xs text-slate-400">기준일: {depositSafety.referenceDate}</p>
                )}
                {typeof depositSafety.sampleCount === 'number' && typeof depositSafety.radiusMeters === 'number' && (
                  <p className="mb-1 text-xs text-slate-400">
                    인근 매매 실거래가 {depositSafety.sampleCount}건(반경 {depositSafety.radiusMeters}m) 기준으로
                    계산했어요.
                  </p>
                )}
                {typeof depositSafety.cautionFrom === 'number' &&
                  typeof depositSafety.warnFrom === 'number' &&
                  typeof depositSafety.warnTo === 'number' && (
                    <p className="mb-4 text-[10px] text-slate-400">
                      판정 기준: {depositSafety.cautionFrom}% 미만 안전 · {depositSafety.cautionFrom}~
                      {depositSafety.warnFrom}% 주의 · {depositSafety.warnFrom}~{depositSafety.warnTo}% 위험 ·{' '}
                      {depositSafety.warnTo}% 초과 재확인 필요
                    </p>
                  )}
                {depositSafety.recentOwnershipChangeWarning && (
                  <NoticeBox icon={AlertTriangle} iconClassName="text-orange-500" className="mb-4">
                    최근 소유권이 바뀐 매물이에요 — 더 꼼꼼히 확인하세요.
                  </NoticeBox>
                )}

                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex items-center gap-1">
                    <p className="text-xs font-bold text-slate-700">
                      선순위보증금을 반영하면 더 정확하게 계산할 수 있어요
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsSeniorDepositHelpOpen(true)}
                      aria-label="선순위보증금·근저당 채권최고액 설명 보기"
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </div>
                  {depositSafety.seniorDepositApplied && (
                    <p className="mb-2 text-[10px] text-teal-600">
                      이미 반영된 값이에요 — 값을 바꾸고 다시 계산하면 갱신돼요.
                    </p>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">선순위보증금 (원)</span>
                      <input
                        value={seniorDeposit}
                        onChange={(event) => setSeniorDeposit(formatIntegerInput(event.target.value))}
                        inputMode="numeric"
                        disabled={isRecalculating}
                        className="ansim-input disabled:opacity-60"
                        placeholder="예: 50,000,000"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-slate-500">근저당 채권최고액 (원, 선택)</span>
                      <input
                        value={maxClaimAmount}
                        onChange={(event) => setMaxClaimAmount(formatIntegerInput(event.target.value))}
                        inputMode="numeric"
                        disabled={isRecalculating}
                        className="ansim-input disabled:opacity-60"
                        placeholder="예: 30,000,000"
                      />
                    </label>
                  </div>
                  {recalculateError && <p className="mt-2 text-xs text-red-600">{recalculateError}</p>}
                  <button
                    type="button"
                    onClick={() => void handleRecalculate()}
                    disabled={isRecalculating}
                    className="ansim-button-secondary mt-3 w-full py-2 text-sm disabled:opacity-60"
                  >
                    {isRecalculating ? '재계산 중...' : '반영해서 다시 계산하기'}
                  </button>
                </div>
              </>
            ) : (
              <p className="mb-4 text-sm text-slate-500">{depositSafety.reasonText ?? '확인할 수 없어요.'}</p>
            )}
          </div>
        )}

        {(riskSignals?.disclaimer || depositSafety?.disclaimer) && (
          <p className="text-center text-[10px] leading-relaxed text-slate-400">
            {riskSignals?.disclaimer ?? depositSafety?.disclaimer}
          </p>
        )}
      </div>

      <Modal open={isSeniorDepositHelpOpen} onClose={() => setIsSeniorDepositHelpOpen(false)}>
        <h3 className="mb-3 text-base font-bold text-slate-950">선순위보증금·근저당 채권최고액이 뭔가요?</h3>
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          <span className="font-bold">선순위보증금</span>은 나보다 먼저 전입신고와 확정일자를 받은 다른 세입자가 있다면,
          그 사람의 보증금이에요. 집이 경매나 매매로 넘어가면 이 돈이 내 보증금보다 먼저 변제돼요.
        </p>
        <p className="mb-3 text-sm leading-relaxed text-slate-600">
          <span className="font-bold">근저당 채권최고액</span>은 등기부등본(을구)에서 확인할 수 있는, 은행 등이 이 집에
          설정해둔 담보의 최대 금액이에요. 보통 실제 대출금보다 110~130% 크게 잡혀 있고, 이 금액도 내 보증금보다 먼저
          변제될 수 있어요.
        </p>
        <p className="mb-4 text-xs text-slate-500">
          두 값 모두 등기부등본에서 확인하거나 임대인에게 직접 요청해서 알 수 있어요.
        </p>
        <button
          type="button"
          onClick={() => setIsSeniorDepositHelpOpen(false)}
          className="ansim-button-secondary w-full py-2 text-sm"
        >
          확인
        </button>
      </Modal>
    </div>
  );
}
