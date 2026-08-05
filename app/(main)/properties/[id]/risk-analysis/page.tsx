'use client';

import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPropertyById } from '../../../../services/properties';
import { getDepositSafety, getRiskSignals } from '../../../../services/risk-analysis';
import { type DepositSafetyCheck, type PropertyDetail, type RiskSignalList } from '../../../../types/domain';
import { RiskAnalysisClient } from './RiskAnalysisClient';

export default function Page() {
  const params = useParams<{ id: string }>();
  const propertyId = Number(params.id);

  const [riskSignals, setRiskSignals] = useState<RiskSignalList | undefined>(undefined);
  const [depositSafety, setDepositSafety] = useState<DepositSafetyCheck | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [property, setProperty] = useState<PropertyDetail | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // params.id가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과
    // 동일) - 다른 매물로 이동 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([getRiskSignals(propertyId), getDepositSafety(propertyId)])
      .then(([signals, safety]) => {
        if (!cancelled) {
          setRiskSignals(signals);
          setDepositSafety(safety);
          setLoadError(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('위험 신호 정보를 불러오지 못했습니다. API 설정을 확인해 주세요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // 매물 정보는 헤더 표시용 부가 정보라, 조회 실패해도 본문은 그대로 보여준다.
    getPropertyById(propertyId)
      .then((result) => {
        if (!cancelled) setProperty(result);
      })
      .catch(() => {
        if (!cancelled) setProperty(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <RiskAnalysisClient
      propertyId={propertyId}
      riskSignals={riskSignals}
      depositSafety={depositSafety}
      loadError={loadError}
      property={property}
    />
  );
}
