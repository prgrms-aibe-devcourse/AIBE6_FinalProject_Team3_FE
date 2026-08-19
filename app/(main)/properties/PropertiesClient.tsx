'use client';

import { type FormEvent, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { propertyTransactionTypeOptions, propertyTypeOptions } from '../../data/property-register';
import { cn } from '../../lib/cn';
import { type PropertyTransactionTypeDto, type PropertyTypeDto } from '../../types/api';
import { type PropertyListPage } from '../../types/domain';
import { Badge } from '../../ui/Badge';
import { NoticeBox } from '../../ui/NoticeBox';

export type PropertiesFilter = {
  region?: string;
  minArea?: number;
  maxArea?: number;
  transactionType?: PropertyTransactionTypeDto;
  propertyType?: PropertyTypeDto;
  minDeposit?: number;
  maxDeposit?: number;
  // 전세는 monthlyRent가 항상 null이라 사실상 월세 매물에만 적용된다.
  minMonthlyRent?: number;
  maxMonthlyRent?: number;
  // BE가 허용하는 정렬 필드는 createdAt/deposit/area 뿐이다(PageableUtils.validateSort 참고).
  // "field,direction" 형태의 Spring Pageable Sort 문법 그대로 사용한다. 생략하면 BE 기본값인
  // createdAt,desc(최신순)로 처리된다.
  sort?: string;
};

type SortOption = { label: string; value?: string };

const sortOptions: SortOption[] = [
  { label: '최신순' },
  { label: '보증금 낮은순', value: 'deposit,asc' },
  { label: '보증금 높은순', value: 'deposit,desc' },
  { label: '면적 좁은순', value: 'area,asc' },
  { label: '면적 넓은순', value: 'area,desc' },
];

type PropertiesClientProps = {
  propertyPage: PropertyListPage;
  loadError?: string;
  notice?: string;
  filter: PropertiesFilter;
};

const transactionTypePills: Array<{ label: string; value?: PropertyTransactionTypeDto }> = [
  { label: '전체' },
  ...propertyTransactionTypeOptions.map((option) => ({ label: option.label, value: option.value })),
];

export function PropertiesClient({ propertyPage, loadError, notice, filter }: PropertiesClientProps) {
  const { items: properties, page, totalPages, hasNext } = propertyPage;
  const router = useRouter();

  const [region, setRegion] = useState(filter.region ?? '');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [propertyType, setPropertyType] = useState<PropertyTypeDto | undefined>(filter.propertyType);
  const [minArea, setMinArea] = useState(filter.minArea !== undefined ? String(filter.minArea) : '');
  const [maxArea, setMaxArea] = useState(filter.maxArea !== undefined ? String(filter.maxArea) : '');
  // 보증금/월세 필터도 등록/수정 폼과 동일하게 만원 단위로 다룬다(#175) - filter(원 단위, URL
  // 쿼리 기반)를 화면 표시용 만원으로 나눠서 보여주고, 제출 시 buildQuery에서 다시 원 단위로 곱한다.
  const [minDeposit, setMinDeposit] = useState(
    filter.minDeposit !== undefined ? String(Math.round(filter.minDeposit / 10_000)) : '',
  );
  const [maxDeposit, setMaxDeposit] = useState(
    filter.maxDeposit !== undefined ? String(Math.round(filter.maxDeposit / 10_000)) : '',
  );
  const [minMonthlyRent, setMinMonthlyRent] = useState(
    filter.minMonthlyRent !== undefined ? String(Math.round(filter.minMonthlyRent / 10_000)) : '',
  );
  const [maxMonthlyRent, setMaxMonthlyRent] = useState(
    filter.maxMonthlyRent !== undefined ? String(Math.round(filter.maxMonthlyRent / 10_000)) : '',
  );

  // 월세 금액 범위는 전세 매물엔 의미가 없어(monthlyRent가 항상 null) 거래유형이 월세일 때만 보여준다.
  const isMonthlyRentFilter = filter.transactionType === 'MONTHLY_RENT';

  const hasActiveFilter =
    Boolean(filter.region) ||
    filter.minArea !== undefined ||
    filter.maxArea !== undefined ||
    Boolean(filter.transactionType) ||
    Boolean(filter.propertyType) ||
    filter.minDeposit !== undefined ||
    filter.maxDeposit !== undefined ||
    filter.minMonthlyRent !== undefined ||
    filter.maxMonthlyRent !== undefined ||
    Boolean(filter.sort);

  // 현재 폼 상태(+ overrides로 넘긴 값)를 쿼리파라미터로 직렬화한다. page는 여기서 다루지 않고
  // buildPageHref가 별도로 붙인다 - 필터가 바뀌면 항상 0페이지부터 다시 보는 게 맞기 때문.
  function buildQuery(overrides: Partial<PropertiesFilter> = {}) {
    const next: PropertiesFilter = {
      region,
      minArea: minArea ? Number(minArea) : undefined,
      maxArea: maxArea ? Number(maxArea) : undefined,
      transactionType: filter.transactionType,
      propertyType,
      // 입력은 만원 단위라 BE로 보내기 전에 원 단위로 환산한다.
      minDeposit: minDeposit ? Number(minDeposit) * 10_000 : undefined,
      maxDeposit: maxDeposit ? Number(maxDeposit) * 10_000 : undefined,
      minMonthlyRent: minMonthlyRent ? Number(minMonthlyRent) * 10_000 : undefined,
      maxMonthlyRent: maxMonthlyRent ? Number(maxMonthlyRent) * 10_000 : undefined,
      sort: filter.sort,
      ...overrides,
    };

    // 거래유형이 월세가 아니게 되면(전체/전세로 전환) 월세 범위 조건은 의미가 없어 같이 초기화한다.
    if (next.transactionType !== 'MONTHLY_RENT') {
      next.minMonthlyRent = undefined;
      next.maxMonthlyRent = undefined;
    }

    const params = new URLSearchParams();
    if (next.region) params.set('region', next.region);
    if (next.minArea !== undefined && !Number.isNaN(next.minArea)) params.set('minArea', String(next.minArea));
    if (next.maxArea !== undefined && !Number.isNaN(next.maxArea)) params.set('maxArea', String(next.maxArea));
    if (next.transactionType) params.set('transactionType', next.transactionType);
    if (next.propertyType) params.set('propertyType', next.propertyType);
    if (next.minDeposit !== undefined && !Number.isNaN(next.minDeposit))
      params.set('minDeposit', String(next.minDeposit));
    if (next.maxDeposit !== undefined && !Number.isNaN(next.maxDeposit))
      params.set('maxDeposit', String(next.maxDeposit));
    if (next.minMonthlyRent !== undefined && !Number.isNaN(next.minMonthlyRent))
      params.set('minMonthlyRent', String(next.minMonthlyRent));
    if (next.maxMonthlyRent !== undefined && !Number.isNaN(next.maxMonthlyRent))
      params.set('maxMonthlyRent', String(next.maxMonthlyRent));
    if (next.sort) params.set('sort', next.sort);
    return params;
  }

  function applyFilter(overrides: Partial<PropertiesFilter> = {}) {
    const queryString = buildQuery(overrides).toString();
    router.push(queryString ? `/properties?${queryString}` : '/properties');
  }

  function handleSearchSubmit(event: FormEvent) {
    event.preventDefault();
    applyFilter();
  }

  function handleReset() {
    setRegion('');
    setPropertyType(undefined);
    setMinArea('');
    setMaxArea('');
    setMinDeposit('');
    setMaxDeposit('');
    setMinMonthlyRent('');
    setMaxMonthlyRent('');
    router.push('/properties');
  }

  function buildPageHref(targetPage: number) {
    const params = buildQuery();
    params.set('page', String(targetPage));
    return `/properties?${params.toString()}`;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="border-b border-slate-200 bg-white py-10">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h1 className="ansim-page-title mb-3">매물 검증</h1>
              <p className="ansim-page-description">
                관심 매물을 등록하고 실거래가, 허위매물 의심 신호, 보증금 안전성 수치를 함께 확인하세요.
              </p>
            </div>
            <Link href="/properties/register" className="ansim-button-primary w-fit px-5 py-3">
              <Plus className="h-4 w-4" /> 매물 등록
            </Link>
          </div>

          <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="ansim-search-icon" />
              <input
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                placeholder="지역(도로명/지번주소)으로 검색하세요"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 text-slate-950 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600"
            >
              <SlidersHorizontal className="h-4 w-4" /> 상세 필터
            </button>
          </form>

          {showAdvanced && (
            <div className="mt-4 grid grid-cols-1 gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-600">매물 유형</span>
                <select
                  value={propertyType ?? ''}
                  onChange={(event) =>
                    setPropertyType(event.target.value ? (event.target.value as PropertyTypeDto) : undefined)
                  }
                  className="ansim-input"
                >
                  <option value="">전체</option>
                  {propertyTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-bold text-slate-600">전용면적 (㎡)</span>
                <div className="flex items-center gap-2">
                  <input
                    value={minArea}
                    onChange={(event) => setMinArea(event.target.value)}
                    inputMode="numeric"
                    placeholder="최소"
                    className="ansim-input"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    value={maxArea}
                    onChange={(event) => setMaxArea(event.target.value)}
                    inputMode="numeric"
                    placeholder="최대"
                    className="ansim-input"
                  />
                </div>
              </label>
              <label className="block sm:col-span-2 lg:col-span-2">
                <span className="mb-2 block text-xs font-bold text-slate-600">보증금 (만원)</span>
                <div className="flex items-center gap-2">
                  <input
                    value={minDeposit}
                    onChange={(event) => setMinDeposit(event.target.value)}
                    inputMode="numeric"
                    placeholder="최소"
                    className="ansim-input"
                  />
                  <span className="text-slate-400">~</span>
                  <input
                    value={maxDeposit}
                    onChange={(event) => setMaxDeposit(event.target.value)}
                    inputMode="numeric"
                    placeholder="최대"
                    className="ansim-input"
                  />
                </div>
              </label>
              {isMonthlyRentFilter && (
                <label className="block sm:col-span-2 lg:col-span-2">
                  <span className="mb-2 block text-xs font-bold text-slate-600">월세 (만원)</span>
                  <div className="flex items-center gap-2">
                    <input
                      value={minMonthlyRent}
                      onChange={(event) => setMinMonthlyRent(event.target.value)}
                      inputMode="numeric"
                      placeholder="최소"
                      className="ansim-input"
                    />
                    <span className="text-slate-400">~</span>
                    <input
                      value={maxMonthlyRent}
                      onChange={(event) => setMaxMonthlyRent(event.target.value)}
                      inputMode="numeric"
                      placeholder="최대"
                      className="ansim-input"
                    />
                  </div>
                </label>
              )}
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                <button type="button" onClick={() => applyFilter()} className="ansim-button-primary px-5 py-3 text-sm">
                  필터 적용
                </button>
                {hasActiveFilter && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600"
                  >
                    <X className="h-4 w-4" /> 초기화
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {transactionTypePills.map((pill) => (
              <button
                key={pill.label}
                onClick={() => applyFilter({ transactionType: pill.value })}
                className={cn(
                  'ansim-filter-pill',
                  filter.transactionType === pill.value ? 'bg-slate-950 text-white' : 'ansim-filter-pill-muted',
                )}
              >
                {pill.label}
              </button>
            ))}
          </div>
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-600">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
            <select
              value={filter.sort ?? ''}
              onChange={(event) => applyFilter({ sort: event.target.value || undefined })}
              className="ansim-input w-auto py-2 pr-8 text-sm"
            >
              {sortOptions.map((option) => (
                <option key={option.label} value={option.value ?? ''}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {notice && (
          <div className="ansim-card mb-4 border-teal-100 bg-teal-50 p-4 text-sm text-teal-700">
            매물이 등록됐어요. {notice}
          </div>
        )}

        {loadError && <div className="ansim-card border-red-100 bg-red-50 p-6 text-sm text-red-700">{loadError}</div>}

        {!loadError && properties.length === 0 && (
          <div className="ansim-card p-6 text-sm text-slate-500">조건에 맞는 매물이 없습니다.</div>
        )}

        <div className="grid grid-cols-1 gap-5">
          {properties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="ansim-card group block p-6 transition hover:border-teal-200"
            >
              <div>
                <div className="mb-4 flex gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-24">
                    {property.representativeImageUrl ? (
                      <Image
                        src={property.representativeImageUrl}
                        alt={property.title}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-300">
                        <ImageOff className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge className="bg-teal-50 text-teal-700">{property.type}</Badge>
                      {property.propertyType && (
                        <Badge className="bg-slate-100 text-slate-600">{property.propertyType}</Badge>
                      )}
                      {property.checkSignalCount !== undefined ? (
                        <Badge className={property.statusColor}>확인 필요 신호 {property.checkSignalCount}개</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500">신호 확인 준비 중</Badge>
                      )}
                      {property.jeonseRatio !== undefined ? (
                        <Badge className="bg-slate-100 text-slate-600">전세가율 {property.jeonseRatio}%</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500">전세가율 준비 중</Badge>
                      )}
                    </div>
                    <h2 className="mb-2 truncate text-xl font-bold text-slate-950 group-hover:text-teal-700">
                      {property.title}
                    </h2>
                    <p className="flex items-center gap-1 truncate text-sm text-slate-500">
                      <MapPin className="h-4 w-4 shrink-0" /> {property.address}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="mb-1 text-xs text-slate-400">보증금</p>
                    <p className="font-bold text-slate-950">{property.deposit}</p>
                    <p className="mt-1 text-xs text-slate-500">{property.maintenance ?? '관리비 정보 없음'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="mb-1 text-xs text-slate-400">시세 대비</p>
                    {property.marketDelta !== undefined ? (
                      <p
                        className={cn(
                          'font-bold',
                          property.marketDelta.startsWith('+') ? 'text-orange-600' : 'text-emerald-600',
                        )}
                      >
                        {property.marketDelta}
                      </p>
                    ) : (
                      <p className="font-bold text-slate-400">준비 중</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {property.marketDelta !== undefined ? '최근 실거래가 기준' : '실거래가 연동 예정'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4">
                    <p className="mb-1 text-xs text-slate-400">체크리스트</p>
                    {property.checklist !== undefined ? (
                      <p className="font-bold text-slate-950">{property.checklist}% 완료</p>
                    ) : (
                      <p className="font-bold text-slate-400">준비 중</p>
                    )}
                    <p className="mt-1 text-xs text-slate-500">
                      {property.checklist !== undefined ? '방문 확인 진행률' : '체크리스트 연동 예정'}
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!loadError && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-4">
            {page > 0 ? (
              <Link
                href={buildPageHref(page - 1)}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <ChevronLeft className="h-4 w-4" /> 이전
              </Link>
            ) : (
              <span className="flex items-center gap-1 rounded-xl border border-slate-100 px-4 py-2 text-sm font-bold text-slate-300">
                <ChevronLeft className="h-4 w-4" /> 이전
              </span>
            )}
            <span className="text-sm text-slate-500">
              {page + 1} / {totalPages} 페이지
            </span>
            {hasNext ? (
              <Link
                href={buildPageHref(page + 1)}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                다음 <ChevronRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="flex items-center gap-1 rounded-xl border border-slate-100 px-4 py-2 text-sm font-bold text-slate-300">
                다음 <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
        )}

        <NoticeBox icon={AlertTriangle} iconClassName="text-orange-500" className="mt-8">
          확인 필요 신호는 확정 판단이 아닌 참고용 정보입니다. 등기부등본, 보증보험 가능 여부, 실제 계약 조건은 별도로
          확인해야 합니다.
        </NoticeBox>
      </div>
    </div>
  );
}
