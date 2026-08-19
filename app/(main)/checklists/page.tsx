'use client';

import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api/http';
import { parsePageParam } from '../../lib/pageParam';
import { getMyChecklistOverviews } from '../../services/checklist';
import { type ChecklistOverviewPage } from '../../types/domain';
import { ChecklistOverviewClient } from './ChecklistOverviewClient';

// BE 기본값(20)과 별개로, 목록 화면 UI상 한 페이지에 보여줄 카드 개수는 FE가 정한다
// (properties/page.tsx의 PAGE_SIZE와 동일 패턴).
const PAGE_SIZE = 5;

const emptyPage: ChecklistOverviewPage = {
  items: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
};

function ChecklistsPageContent() {
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get('page') ?? undefined);

  const [checklistPage, setChecklistPage] = useState<ChecklistOverviewPage>(emptyPage);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // page가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과 동일) -
    // 페이지 변경 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    getMyChecklistOverviews({ page, size: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setChecklistPage(result);
          setLoadError(undefined);
        }
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
  }, [page]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return <ChecklistOverviewClient checklistPage={checklistPage} loadError={loadError} />;
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <ChecklistsPageContent />
    </Suspense>
  );
}
