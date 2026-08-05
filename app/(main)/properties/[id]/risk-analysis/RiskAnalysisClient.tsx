'use client';

import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { apiStatusToneClassMap, getJeonseRatioTone, riskSignalTypeMeta } from '../../../../data/risk-analysis';
import { cn } from '../../../../lib/cn';
import { type DepositSafetyCheck, type PropertyDetail, type RiskSignalList } from '../../../../types/domain';
import { Badge } from '../../../../ui/Badge';
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
  depositSafety,
  loadError,
  property,
}: RiskAnalysisClientProps) {
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
                <Badge className={apiStatusToneClassMap[getJeonseRatioTone(depositSafety.jeonseRatio)]}>
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
                  <p className="mb-4 text-xs text-slate-400">기준일: {depositSafety.referenceDate}</p>
                )}
                {depositSafety.recentOwnershipChangeWarning && (
                  <NoticeBox icon={AlertTriangle} iconClassName="text-orange-500" className="mb-4">
                    최근 소유권이 바뀐 매물이에요 — 더 꼼꼼히 확인하세요.
                  </NoticeBox>
                )}
              </>
            ) : (
              <p className="mb-4 text-sm text-slate-500">{depositSafety.reasonText ?? '확인할 수 없어요.'}</p>
            )}

            <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
              선순위보증금을 반영하면 더 정확하게 계산할 수 있어요 (곧 지원 예정)
            </div>
          </div>
        )}

        {(riskSignals?.disclaimer || depositSafety?.disclaimer) && (
          <p className="text-center text-[10px] leading-relaxed text-slate-400">
            {riskSignals?.disclaimer ?? depositSafety?.disclaimer}
          </p>
        )}
      </div>
    </div>
  );
}
