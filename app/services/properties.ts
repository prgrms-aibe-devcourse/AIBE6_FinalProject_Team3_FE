import { useMockData } from '../config/dataSource';
import { requestJson } from '../lib/api/http';
import {
  mapPropertyDetailResponseDto,
  mapPropertyListItemDto,
  mapPropertySummaryToMockDetail,
} from '../mappers/property';
import { getMockProperties, getMockPropertyById } from '../repositories/propertyRepository';
import {
  type CreatePropertyRequestDto,
  type CreatePropertyResponseDto,
  type PageResponseDto,
  type PropertyDetailResponseDto,
  type PropertyListItemDto,
  type PropertyReportResponseDto,
  type PropertyTransactionTypeDto,
  type PropertyTypeDto,
  type ReportPropertyRequestDto,
  type UpdatePropertyRequestDto,
} from '../types/api';
import { type PropertyDetail, type PropertyListPage, type PropertySummary } from '../types/domain';

export type GetPropertiesParams = {
  page?: number;
  size?: number;
  // BE가 허용하는 정렬 필드는 createdAt/deposit/area 뿐이다 (PageableUtils.validateSort 참고).
  sort?: string;
  // 아래 6개는 전부 선택값 - BE PropertySearchCondition과 1:1 대응. region은 도로명/지번주소
  // 부분일치(LIKE) 검색이다.
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
};

// mock 모드는 페이지 개념이 없어 전체 목록을 크기 1짜리 단일 페이지로 감싼다 - 호출부가
// 실제 API/mock 모드를 구분하지 않고 동일한 PropertyListPage 형태로 다룰 수 있게 하기 위함.
function wrapAsSinglePage(items: PropertySummary[]): PropertyListPage {
  return { items, page: 0, size: items.length, totalElements: items.length, totalPages: 1, hasNext: false };
}

export async function getProperties(cookieHeader?: string, params?: GetPropertiesParams): Promise<PropertyListPage> {
  if (useMockData) {
    return wrapAsSinglePage(getMockProperties());
  }

  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.size !== undefined) query.set('size', String(params.size));
  if (params?.sort) query.set('sort', params.sort);
  if (params?.region) query.set('region', params.region);
  if (params?.minArea !== undefined) query.set('minArea', String(params.minArea));
  if (params?.maxArea !== undefined) query.set('maxArea', String(params.maxArea));
  if (params?.transactionType) query.set('transactionType', params.transactionType);
  if (params?.propertyType) query.set('propertyType', params.propertyType);
  if (params?.minDeposit !== undefined) query.set('minDeposit', String(params.minDeposit));
  if (params?.maxDeposit !== undefined) query.set('maxDeposit', String(params.maxDeposit));
  if (params?.minMonthlyRent !== undefined) query.set('minMonthlyRent', String(params.minMonthlyRent));
  if (params?.maxMonthlyRent !== undefined) query.set('maxMonthlyRent', String(params.maxMonthlyRent));
  const queryString = query.toString();

  const page = await requestJson<PageResponseDto<PropertyListItemDto>>(
    queryString ? `/properties?${queryString}` : '/properties',
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );
  return {
    items: page.content.map(mapPropertyListItemDto),
    page: page.page,
    size: page.size,
    totalElements: page.totalElements,
    totalPages: page.totalPages,
    hasNext: page.hasNext,
  };
}

export async function getPropertyById(id: number, cookieHeader?: string): Promise<PropertyDetail | undefined> {
  if (useMockData) {
    const property = getMockPropertyById(id);
    return property ? mapPropertySummaryToMockDetail(property) : undefined;
  }

  const dto = await requestJson<PropertyDetailResponseDto>(
    `/properties/${id}`,
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );
  return mapPropertyDetailResponseDto(dto);
}

export async function createProperty(request: CreatePropertyRequestDto): Promise<CreatePropertyResponseDto> {
  if (useMockData) {
    return {
      propertyId: Date.now(),
      status: 'ACTIVE',
      address: {
        roadAddress: request.address,
        jibunAddress: request.address,
        latitude: 0,
        longitude: 0,
      },
      marketComparison: {
        status: 'UNAVAILABLE',
        referencePrice: null,
        differenceRate: null,
        sampleCount: null,
        referenceDate: null,
        radiusMeters: null,
        areaErrorRate: null,
        lookbackMonths: null,
        message: '모의 데이터 모드라 시세 비교를 제공하지 않아요.',
      },
      notice: null,
    };
  }

  return requestJson<CreatePropertyResponseDto>('/properties', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateProperty(id: number, request: UpdatePropertyRequestDto): Promise<PropertyDetail> {
  if (useMockData) {
    const property = getMockPropertyById(id);
    if (!property) {
      throw new Error('매물을 찾을 수 없습니다.');
    }
    return mapPropertySummaryToMockDetail(property);
  }

  const dto = await requestJson<PropertyDetailResponseDto>(`/properties/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
  return mapPropertyDetailResponseDto(dto);
}

export async function deleteProperty(id: number): Promise<void> {
  if (useMockData) {
    return;
  }

  await requestJson<void>(`/properties/${id}`, { method: 'DELETE' });
}

// mock 모드에는 신고 이력을 저장할 저장소가 없어 매번 성공만 반환한다 - 중복신고(409) 같은
// 에러 케이스는 실제 API 모드에서만 재현 가능하다.
export async function reportProperty(
  id: number,
  request: ReportPropertyRequestDto,
): Promise<PropertyReportResponseDto> {
  if (useMockData) {
    return {
      reportId: Date.now(),
      propertyId: id,
      reason: request.reason,
      detail: request.reason === 'ETC' ? (request.detail ?? null) : null,
      status: 'RECEIVED',
      createdAt: new Date().toISOString(),
    };
  }

  return requestJson<PropertyReportResponseDto>(`/properties/${id}/reports`, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}
