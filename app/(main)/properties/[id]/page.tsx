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
    // 한 번도 계산된 적 없는 매물만 POST /risk-analysis로 트리거한다(risk-analysis/page.tsx와 동일한
    // 이유 - checkAndSave가 매번 선순위보증금 없이 재계산해서, 이미 계산된 매물을 매번 재트리거하면
    // 사용자가 recalculate로 입력해둔 선순위보증금이 이 페이지를 다시 볼 때마다 지워진다). 신호/보증금
    // 안전성은 checkAndSave(property) 한 트랜잭션에서 항상 같이 upsert되므로, depositSafety.status가
    // notChecked인지로 "둘 다 한 번도 계산된 적 없음"을 판별한다.
    Promise.all([getRiskSignals(propertyId), getDepositSafety(propertyId)])
      .then(([signals, safety]) => {
        if (safety.status === 'notChecked') {
          return checkRiskSignals(propertyId).then(() =>
            Promise.all([getRiskSignals(propertyId), getDepositSafety(propertyId)]),
          );
        }
        return [signals, safety] as const;
      })
      .then(([signals, safety]) => {
        if (!cancelled) {
          setRiskSignals(signals);
          setDepositSafety(safety);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRiskSignals(undefined);
          setDepositSafety(undefined);
        }
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
