'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { parsePageParam } from '../../../lib/pageParam';
import { resolveErrorMessage } from '../../../lib/resolveErrorMessage';
import { getAdminPropertyReports } from '../../../services/admin';
import { type AdminPropertyReportListItemDto, type PageResponseDto } from '../../../types/api';
import { AdminReportsClient } from './AdminReportsClient';

// status 쿼리파라미터가 아예 없는 최초 진입(북마크/새로고침 포함)은 대기중(RECEIVED) 신고를
// 우선 보여준다. 사용자가 명시적으로 "전체"를 고르면 status=ALL로 남겨 다음 새로고침에서도
// 그 선택이 유지되게 한다(그냥 파라미터를 지우면 다시 RECEIVED로 되돌아가버린다).
function AdminReportsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get('page') ?? undefined);
  const selectedStatus = searchParams.get('status') ?? 'RECEIVED';
  const apiStatus = selectedStatus === 'ALL' ? undefined : selectedStatus;
  const reason = searchParams.get('reason') ?? undefined;

  // 신고 처리(조치완료/반려)로 필터에 맞는 항목이 하나 줄면, 지금 보고 있던 페이지가 더 이상
  // 존재하지 않게 될 수 있다(예: 2페이지에 1건 남아있던 걸 처리 → 2페이지는 빈 목록). 목록
  // 갱신 없이는 Pagination 자체가 사라져(totalPages<=1) 되돌아갈 UI 수단이 없으므로, 응답의
  // totalPages를 기준으로 유효 범위를 벗어나면 자동으로 마지막 유효 페이지로 되돌린다.
  const clampToValidPage = useCallback(
    (totalPages: number) => {
      const validPage = totalPages > 0 ? Math.min(page, totalPages - 1) : 0;
      if (validPage === page) return false;
      const query = new URLSearchParams(searchParams.toString());
      if (validPage) {
        query.set('page', String(validPage));
      } else {
        query.delete('page');
      }
      router.replace(`/admin/reports${query.toString() ? `?${query.toString()}` : ''}`);
      return true;
    },
    [page, router, searchParams],
  );

  const [data, setData] = useState<PageResponseDto<AdminPropertyReportListItemDto> | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // 이 화면 전체가 client component라 router.refresh()가 다시 가져올 Server Component 데이터가
  // 없다 - AdminReportsClient가 신고 처리에 성공한 뒤 목록을 다시 그리려면 이 fetch를 직접 다시
  // 호출해야 한다.
  //
  // requestIdRef: 필터를 빠르게 바꾸면 이전 필터의 느린 응답이 최신 필터의 빠른 응답보다 늦게
  // 도착할 수 있다 - 매 호출마다 순번을 매겨서, 응답이 왔을 때 그게 여전히 최신 호출인지 확인한
  // 뒤에만 state를 쓴다. useEffect의 cancelled 플래그는 loading만 지켜줄 뿐 이 함수 내부 쓰기는
  // 못 막는다(onMutated로 effect 밖에서도 호출되므로 더더욱 그렇다).
  const requestIdRef = useRef(0);
  const reloadReports = useCallback(() => {
    const requestId = ++requestIdRef.current;
    return getAdminPropertyReports({ page, status: apiStatus, reason })
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        // 지금 페이지가 이 결과 기준으로 더 이상 유효하지 않으면, 빈 목록을 잠깐 보여주는 대신
        // 유효한 페이지로 리다이렉트한다(그 리다이렉트가 URL을 바꿔 이 effect를 다시 실행시킨다).
        if (clampToValidPage(result.totalPages)) return;
        setData(result);
        setLoadError(undefined);
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        // data를 그대로 두면 에러 배너 아래 이전(어쩌면 다른 필터의) 목록이 최신인 것처럼 계속
        // 보인다 - 실패했으면 화면에는 에러만 남긴다.
        setData(undefined);
        setLoadError(resolveErrorMessage(error, '신고 목록을 불러오지 못했습니다.'));
      });
  }, [page, apiStatus, reason, clampToValidPage]);

  useEffect(() => {
    let cancelled = false;
    // page/status/reason이 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시
    // 초기값과 동일) - 필터 변경 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    reloadReports().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadReports]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <AdminReportsClient
      data={data}
      loadError={loadError}
      filters={{ status: selectedStatus, reason: reason ?? '' }}
      onMutated={reloadReports}
    />
  );
}

export default function AdminReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <AdminReportsPageContent />
    </Suspense>
  );
}
