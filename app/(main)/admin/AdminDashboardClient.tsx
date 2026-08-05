'use client';

import { FileWarning, Home, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { type AdminDashboardStatsDto, type PropertyReportReasonDto } from '../../types/api';
import { SummaryCard } from '../../ui/SummaryCard';

type AdminDashboardClientProps = {
  stats?: AdminDashboardStatsDto;
  loadError?: string;
  startDate: string;
  endDate: string;
};

// dataviz 스킬의 기본 검증 팔레트(references/palette.md) 슬롯 순서를 그대로 따른다 - 인접 쌍
// CVD 대비가 이미 검증된 순서라 임의로 골라 쓰지 않는다.
const CHART_BLUE = '#2a78d6';
const CHART_ORANGE = '#eb6834';
const CHART_AQUA = '#1baf7a';
const CHART_YELLOW = '#eda100';
const CHART_MAGENTA = '#e87ba4';

const REGISTRATION_LABEL: Record<'true' | 'false', string> = { true: '매물 등록자', false: '미등록자' };
const REASON_LABEL: Record<PropertyReportReasonDto, string> = {
  ALREADY_CONTRACTED: '이미 계약된 매물',
  PRICE_MISMATCH: '실제 가격과 다름',
  INFO_MISMATCH: '매물 정보 불일치',
  DUPLICATE: '중복 등록',
  ETC: '기타',
};
const REASON_COLOR: Record<PropertyReportReasonDto, string> = {
  ALREADY_CONTRACTED: CHART_BLUE,
  PRICE_MISMATCH: CHART_ORANGE,
  INFO_MISMATCH: CHART_AQUA,
  DUPLICATE: CHART_YELLOW,
  ETC: CHART_MAGENTA,
};

function formatDate(dateString: string): string {
  const [, month, day] = dateString.split('-');
  return `${month}/${day}`;
}

export function AdminDashboardClient({ stats, loadError, startDate, endDate }: AdminDashboardClientProps) {
  const router = useRouter();
  const [rangeStart, setRangeStart] = useState(startDate);
  const [rangeEnd, setRangeEnd] = useState(endDate);

  // 날짜 입력의 로컬 state는 useState(startDate/endDate)로 최초 1회만 seed되므로, 브라우저
  // 뒤로/앞으로가기로 startDate/endDate props만 바뀌는 경우엔 반영되지 않아 차트는 새 기간을
  // 보여주는데 입력창은 이전 값을 계속 보여주는 것처럼 어긋난다. props가 바뀔 때마다 로컬
  // state를 다시 맞춰준다.
  useEffect(() => {
    // startDate/endDate가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시
    // 초기값과 동일).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRangeStart(startDate);
    setRangeEnd(endDate);
  }, [startDate, endDate]);

  function handleRangeSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!rangeStart || !rangeEnd) return;
    const query = new URLSearchParams({ startDate: rangeStart, endDate: rangeEnd });
    router.push(`/admin?${query.toString()}`);
  }

  const rangeForm = (
    <form onSubmit={handleRangeSubmit} className="mb-6 flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
        시작일
        <input
          type="date"
          required
          value={rangeStart}
          max={rangeEnd}
          onChange={(event) => setRangeStart(event.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs font-bold text-slate-500">
        종료일
        <input
          type="date"
          required
          value={rangeEnd}
          min={rangeStart}
          onChange={(event) => setRangeEnd(event.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
      </label>
      <button type="submit" className="ansim-button-primary px-5 py-2.5 text-sm">
        조회
      </button>
    </form>
  );

  if (loadError) {
    return (
      <div>
        <h1 className="ansim-page-title mb-6">대시보드</h1>
        {rangeForm}
        <div className="ansim-card border-red-100 bg-red-50 p-6 text-sm text-red-700">{loadError}</div>
      </div>
    );
  }
  if (!stats) {
    return null;
  }

  const trendData = stats.trends.signups.map((point, index) => ({
    date: formatDate(point.date),
    가입자: point.count,
    매물등록: stats.trends.propertyRegistrations[index]?.count ?? 0,
  }));

  const registrationData = stats.distributions.byPropertyRegistration.map((item) => ({
    name: REGISTRATION_LABEL[item.registered ? 'true' : 'false'],
    value: item.count,
    color: item.registered ? CHART_ORANGE : CHART_BLUE,
  }));

  const reasonData = stats.distributions.byReportReason.map((item) => ({
    name: REASON_LABEL[item.reason],
    value: item.count,
    color: REASON_COLOR[item.reason],
  }));

  return (
    <div>
      <h1 className="ansim-page-title mb-6">대시보드</h1>

      {rangeForm}

      <p className="mb-4 text-xs text-slate-400">
        아래 통계는 {formatDate(startDate)}~{formatDate(endDate)} 기간 기준입니다.
      </p>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="신규 가입자" value={`${stats.summary.totalUsers.toLocaleString()}명`} icon={Users} />
        {/* 아래 추이 차트의 "매물등록"은 삭제된 매물도 등록 발생 자체로 집계하지만(백엔드
            PropertyRepository.findCreatedAtBetween 참고), 이 카드는 활성 상태만 센다(countByStatus
            AndCreatedAtBetween) - 같은 화면에서 두 숫자가 다른 기준으로 안 맞아 보이는 걸 막기 위해
            라벨에 "활성"임을 명시한다. */}
        <SummaryCard label="신규 활성 매물" value={`${stats.summary.totalProperties.toLocaleString()}건`} icon={Home} />
        <SummaryCard
          label="신규 대기 신고"
          value={`${stats.summary.pendingReports.toLocaleString()}건`}
          icon={FileWarning}
          tone={stats.summary.pendingReports > 0 ? 'orange' : 'default'}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="ansim-card p-5">
          <h2 className="mb-4 text-sm font-bold text-slate-700">
            {formatDate(startDate)}~{formatDate(endDate)} 가입자 / 매물등록 추이
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} />
              <YAxis tick={{ fontSize: 12, fill: '#898781' }} axisLine={{ stroke: '#c3c2b7' }} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="가입자" stroke={CHART_BLUE} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="매물등록" stroke={CHART_ORANGE} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="ansim-card p-5">
          <h2 className="text-sm font-bold text-slate-700">신고 사유별 분포</h2>
          <p className="mb-4 text-xs text-slate-400">선택한 기간에 접수된 신고 기준</p>
          {reasonData.every((item) => item.value === 0) ? (
            <p className="flex h-[260px] items-center justify-center text-sm text-slate-400">신고 데이터가 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={reasonData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: '#898781' }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#52514e' }} width={100} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} label={{ position: 'right', fontSize: 12 }}>
                  {reasonData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="ansim-card p-5 lg:w-2/3">
        <h2 className="text-sm font-bold text-slate-700">매물 등록 여부별 유저 분포</h2>
        <p className="mb-4 text-xs text-slate-400">선택한 기간에 가입한 사람 중, 매물을 등록한 사람 vs 등록하지 않은 사람</p>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
            <Pie
              data={registrationData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={90}
              label={({ name, value }) => `${name} ${value}`}
            >
              {registrationData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
