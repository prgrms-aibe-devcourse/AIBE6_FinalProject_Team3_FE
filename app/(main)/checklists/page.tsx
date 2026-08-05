'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api/http';
import { getMyChecklistOverviews } from '../../services/checklist';
import { type ChecklistOverview } from '../../types/domain';
import { ChecklistOverviewClient } from './ChecklistOverviewClient';

export default function Page() {
  const [overviews, setOverviews] = useState<ChecklistOverview[]>([]);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyChecklistOverviews()
      .then((result) => {
        if (!cancelled) setOverviews(result);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load checklist overviews', error);
        // 세션 확인 자체(자동 refresh 시도)가 네트워크/CORS 문제로 실패한 경우 - 배포 직후 설정
        // 오류를 일반 로드 실패와 구분해 진단하기 쉽게 한다.
        setLoadError(
          error instanceof ApiError && error.sessionRefreshOutcome === 'unreachable'
            ? '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : '체크리스트 목록을 불러오지 못했습니다. API 설정을 확인해 주세요.',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return <ChecklistOverviewClient overviews={overviews} loadError={loadError} />;
}
