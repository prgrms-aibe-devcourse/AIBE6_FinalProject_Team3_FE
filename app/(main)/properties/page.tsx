'use client';

import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ApiError } from '../../lib/api/http';
import { getProperties, type GetPropertiesParams } from '../../services/properties';
import { type PropertyTransactionTypeDto, type PropertyTypeDto } from '../../types/api';
import { type PropertyListPage } from '../../types/domain';
import { PropertiesClient, type PropertiesFilter } from './PropertiesClient';

// BE 기본값(20)과 별개로, 목록 화면 UI상 한 페이지에 보여줄 카드 개수는 FE가 정한다.
const PAGE_SIZE = 5;

const emptyPage: PropertyListPage = {
  items: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
};

const VALID_TRANSACTION_TYPES: PropertyTransactionTypeDto[] = ['JEONSE', 'MONTHLY_RENT'];
const VALID_PROPERTY_TYPES: PropertyTypeDto[] = ['OFFICETEL', 'MULTI_FAMILY', 'DETACHED_HOUSE'];
// BE가 허용하는 정렬 필드는 createdAt/deposit/area 뿐이다(PageableUtils.validateSort 참고).
// createdAt,desc(최신순)는 BE 기본값이라 굳이 명시적으로 보낼 값 목록에 넣지 않았다 - sort를
// 생략해도 동일한 결과가 나온다.
const VALID_SORT_VALUES = ['deposit,asc', 'deposit,desc', 'area,asc', 'area,desc'];

function parsePositiveNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function PropertiesPageContent() {
  const searchParams = useSearchParams();
  const notice = searchParams.get('notice') ?? undefined;
  const region = searchParams.get('region') ?? undefined;
  const minArea = searchParams.get('minArea') ?? undefined;
  const maxArea = searchParams.get('maxArea') ?? undefined;
  const transactionTypeParam = searchParams.get('transactionType') ?? undefined;
  const propertyTypeParam = searchParams.get('propertyType') ?? undefined;
  const minDeposit = searchParams.get('minDeposit') ?? undefined;
  const maxDeposit = searchParams.get('maxDeposit') ?? undefined;
  const minMonthlyRent = searchParams.get('minMonthlyRent') ?? undefined;
  const maxMonthlyRent = searchParams.get('maxMonthlyRent') ?? undefined;
  const sortParam = searchParams.get('sort') ?? undefined;
  const pageParam = searchParams.get('page') ?? undefined;

  // 잘못되거나 없는 page 값은 0페이지로 취급 - URL을 직접 건드려도 안전하게 첫 페이지를 보여준다.
  const parsedPage = Number(pageParam);
  const page = Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : 0;

  // URL 쿼리로 넘어온 enum 값이 BE가 허용하지 않는 값이면(직접 URL 조작 등) 조건 자체를 무시한다.
  const filter: PropertiesFilter = {
    region: region?.trim() ? region.trim() : undefined,
    minArea: parsePositiveNumber(minArea),
    maxArea: parsePositiveNumber(maxArea),
    transactionType: VALID_TRANSACTION_TYPES.includes(transactionTypeParam as PropertyTransactionTypeDto)
      ? (transactionTypeParam as PropertyTransactionTypeDto)
      : undefined,
    propertyType: VALID_PROPERTY_TYPES.includes(propertyTypeParam as PropertyTypeDto)
      ? (propertyTypeParam as PropertyTypeDto)
      : undefined,
    minDeposit: parsePositiveNumber(minDeposit),
    maxDeposit: parsePositiveNumber(maxDeposit),
    minMonthlyRent: parsePositiveNumber(minMonthlyRent),
    maxMonthlyRent: parsePositiveNumber(maxMonthlyRent),
    sort: sortParam && VALID_SORT_VALUES.includes(sortParam) ? sortParam : undefined,
  };

  const [propertyPage, setPropertyPage] = useState<PropertyListPage>(emptyPage);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    let cancelled = false;
    // page/filterKey가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과
    // 동일) - 필터/페이지 변경 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const requestParams: GetPropertiesParams = { page, size: PAGE_SIZE, ...filter };

    getProperties(undefined, requestParams)
      .then((result) => {
        if (!cancelled) {
          setPropertyPage(result);
          setLoadError(undefined);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Failed to load properties', error);
        const errorBody = error instanceof ApiError ? error.body : null;
        if (errorBody && errorBody.code === 'PROPERTY_INVALID_SEARCH_CONDITION') {
          setLoadError(errorBody.message);
        } else if (error instanceof ApiError && error.sessionRefreshOutcome === 'unreachable') {
          // 세션 확인 자체(자동 refresh 시도)가 네트워크/CORS 문제로 실패한 경우 - 배포 직후
          // 설정 오류를 "매물 정보 없음"과 구분해 진단하기 쉽게 한다.
          setLoadError('서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.');
        } else {
          setLoadError('매물 정보를 불러오지 못했습니다. API 설정을 확인해 주세요.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterKey]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return <PropertiesClient propertyPage={propertyPage} loadError={loadError} notice={notice} filter={filter} />;
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
      <PropertiesPageContent />
    </Suspense>
  );
}
