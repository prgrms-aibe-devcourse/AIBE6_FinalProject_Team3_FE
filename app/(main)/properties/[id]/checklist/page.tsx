'use client';

import { Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ApiError } from '../../../../lib/api/http';
import { createOrGetChecklist, getChecklistResult } from '../../../../services/checklist';
import { getPropertyById } from '../../../../services/properties';
import { type ChecklistSummary } from '../../../../lib/checklistSummary';
import { type Checklist, type PropertyDetail } from '../../../../types/domain';
import { ChecklistClient } from './ChecklistClient';

export default function Page() {
  const params = useParams<{ id: string }>();
  const propertyId = Number(params.id);

  const [checklist, setChecklist] = useState<Checklist | undefined>(undefined);
  const [summary, setSummary] = useState<ChecklistSummary | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [property, setProperty] = useState<PropertyDetail | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // propertyId가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과
    // 동일) - 다른 매물로 이동 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    async function load() {
      try {
        const loadedChecklist = await createOrGetChecklist(propertyId);
        const loadedSummary = await getChecklistResult(loadedChecklist.id);
        if (!cancelled) {
          setChecklist(loadedChecklist);
          setSummary(loadedSummary);
          setLoadError(undefined);
        }
      } catch (error) {
        if (cancelled) return;
        // 세션 확인 자체(자동 refresh 시도)가 네트워크/CORS 문제로 실패한 경우 - 배포 직후 설정
        // 오류를 일반 로드 실패와 구분해 진단하기 쉽게 한다 (checklists/page.tsx와 동일 패턴).
        console.error('Failed to load checklist', error);
        setLoadError(
          error instanceof ApiError && error.sessionRefreshOutcome === 'unreachable'
            ? '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : '체크리스트를 불러오지 못했습니다. API 설정을 확인해 주세요.',
        );
      }

      // 매물 정보는 헤더 표시용 부가 정보라, 조회 실패해도 체크리스트 본문은 그대로 보여준다.
      try {
        const loadedProperty = await getPropertyById(propertyId);
        if (!cancelled) setProperty(loadedProperty);
      } catch {
        if (!cancelled) setProperty(undefined);
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <ChecklistClient
      propertyId={propertyId}
      checklist={checklist}
      initialSummary={summary}
      loadError={loadError}
      property={property}
    />
  );
}
