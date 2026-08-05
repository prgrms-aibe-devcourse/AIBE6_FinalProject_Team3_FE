'use client';

import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPropertyById } from '../../../services/properties';
import { checkRiskSignals, getDepositSafety, getRiskSignals } from '../../../services/risk-analysis';
import { type DepositSafetyCheck, type PropertyDetail, type RiskSignalList } from '../../../types/domain';
import { PropertyDetailClient } from './PropertyDetailClient';

export default function Page() {
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<PropertyDetail | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [riskSignals, setRiskSignals] = useState<RiskSignalList | undefined>(undefined);
  const [depositSafety, setDepositSafety] = useState<DepositSafetyCheck | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // params.id가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과
    // 동일) - 다른 매물로 이동 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const propertyId = Number(params.id);

    getPropertyById(propertyId)
      .then((result) => {
        if (!cancelled) {
          setProperty(result);
          setLoadError(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('매물 정보를 불러오지 못했습니다. API 설정을 확인해 주세요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // 위험 신호/보증금 안전성은 매물 상세의 부가 정보라, 조회 실패해도 매물 본문은 그대로 보여준다.
    checkRiskSignals(propertyId)
      .then(() => getRiskSignals(propertyId))
      .then((signals) => {
        if (!cancelled) setRiskSignals(signals);
      })
      .catch(() => {
        if (!cancelled) setRiskSignals(undefined);
      });
    getDepositSafety(propertyId)
      .then((safety) => {
        if (!cancelled) setDepositSafety(safety);
      })
      .catch(() => {
        if (!cancelled) setDepositSafety(undefined);
      });

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <PropertyDetailClient
      property={property}
      loadError={loadError}
      riskSignals={riskSignals}
      depositSafety={depositSafety}
    />
  );
}
