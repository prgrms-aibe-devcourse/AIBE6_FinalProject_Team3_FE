'use client';

import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { getAdminDashboardStats } from '../../services/admin';
import { type AdminDashboardStatsDto } from '../../types/api';
import { AdminDashboardClient } from './AdminDashboardClient';

const DEFAULT_RANGE_DAYS = 14;

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// "지금 한국 날짜가 며칠인지"만 필요해서, UTC 시각에 9시간을 더한 뒤 toISOString()으로 날짜만
// 뽑는다 - Asia/Seoul 캘린더 날짜를 구하는 방식이다.
function defaultDateRange(): { startDate: string; endDate: string } {
  const end = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const start = new Date(end.getTime() - (DEFAULT_RANGE_DAYS - 1) * 86_400_000);
  return { startDate: toIsoDate(start), endDate: toIsoDate(end) };
}

function AdminPageContent() {
  const searchParams = useSearchParams();
  const defaults = defaultDateRange();
  const startDate = searchParams.get('startDate')?.trim() || defaults.startDate;
  const endDate = searchParams.get('endDate')?.trim() || defaults.endDate;

  const [stats, setStats] = useState<AdminDashboardStatsDto | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // startDate/endDate가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시
    // 초기값과 동일) - 조회 기간 변경 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getAdminDashboardStats({ startDate, endDate })
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setLoadError(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('통계를 불러오지 못했습니다. 조회 기간을 확인해주세요.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return <AdminDashboardClient stats={stats} loadError={loadError} startDate={startDate} endDate={endDate} />;
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
