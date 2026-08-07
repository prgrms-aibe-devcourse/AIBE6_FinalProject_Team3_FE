'use client';

import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getPropertyById } from '../../../../services/properties';
import { checkRiskSignals, getDepositSafety, getRiskSignals } from '../../../../services/risk-analysis';
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

    // 이 페이지는 매물 상세 화면을 거치지 않고 직접 진입(북마크/새로고침 등)할 수도 있어서, 한 번도
    // 계산된 적 없는 매물이면 POST /risk-analysis로 먼저 판정·저장을 트리거해야 한다(PropertyDetailClient의
    // page.tsx와 동일한 패턴). 다만 이미 계산된 적 있는 매물까지 매번 재트리거하면 안 된다 - checkAndSave가
    // 선순위보증금 없이 보증금 안전성을 재계산해서, 사용자가 recalculate로 입력해둔 선순위보증금을
    // 새로고침할 때마다 지워버리는 문제가 있다. depositSafety.status가 null(=notChecked)인지로
    // "한 번도 계산된 적 없음"을 판별한다 - 신호 4종과 보증금 안전성은 checkAndSave(property) 한
    // 트랜잭션에서 항상 같이 upsert되므로, 보증금 안전성이 notChecked면 신호도 마찬가지로 미계산 상태다.
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
