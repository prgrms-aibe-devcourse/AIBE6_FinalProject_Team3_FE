import { useMockData } from '../config/dataSource';
import { ApiError, requestJson } from '../lib/api/http';
import { type ChecklistSummary } from '../lib/checklistSummary';
import {
  mapChecklistDto,
  mapChecklistItemDto,
  mapChecklistOverviewDto,
  mapChecklistResultDto,
} from '../mappers/checklist';
import {
  getMockChecklist,
  getMockChecklistOverviews,
  getMockChecklistResult,
  updateMockChecklistItem,
} from '../repositories/checklistRepository';
import {
  type ChecklistDto,
  type ChecklistItemDto,
  type ChecklistItemUpdateRequestDto,
  type ChecklistOverviewDto,
  type ChecklistResultDto,
  type PageResponseDto,
} from '../types/api';
import { type Checklist, type ChecklistItem, type ChecklistOverviewPage } from '../types/domain';

// GET으로 없으면 POST로 생성하는 흐름이라, 같은 propertyId로 동시에 두 번 호출되면(React
// StrictMode의 개발 모드 effect 이중 실행, 빠른 재방문 등) 둘 다 404를 보고 둘 다 생성을
// 시도해 하나는 유니크 제약 위반으로 실패한다. 진행 중인 요청을 propertyId별로 공유해 실제
// 생성 시도가 항상 한 번만 나가게 한다 - app/lib/api/http.ts의 refresh 중복 방지와 동일한 패턴.
const checklistRequestsInFlight = new Map<number, Promise<Checklist>>();

export async function createOrGetChecklist(propertyId: number, cookieHeader?: string): Promise<Checklist> {
  if (useMockData) {
    return getMockChecklist(propertyId);
  }

  const inFlight = checklistRequestsInFlight.get(propertyId);
  if (inFlight) {
    return inFlight;
  }

  const authHeaders = cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined;

  const request = (async () => {
    try {
      const dto = await requestJson<ChecklistDto>(`/properties/${propertyId}/checklists`, {
        method: 'GET',
        ...authHeaders,
      });
      return mapChecklistDto(dto);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        const dto = await requestJson<ChecklistDto>(`/properties/${propertyId}/checklists`, {
          method: 'POST',
          ...authHeaders,
        });
        return mapChecklistDto(dto);
      }
      throw error;
    }
  })().finally(() => {
    checklistRequestsInFlight.delete(propertyId);
  });

  checklistRequestsInFlight.set(propertyId, request);
  return request;
}

export async function getChecklistResult(checklistId: number, cookieHeader?: string): Promise<ChecklistSummary> {
  if (useMockData) {
    return getMockChecklistResult();
  }

  const dto = await requestJson<ChecklistResultDto>(
    `/checklists/${checklistId}/result`,
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );
  return mapChecklistResultDto(dto);
}

export async function updateChecklistItem(
  checklistId: number,
  itemId: number,
  request: ChecklistItemUpdateRequestDto,
): Promise<ChecklistItem> {
  if (useMockData) {
    return updateMockChecklistItem(itemId, request);
  }

  const dto = await requestJson<ChecklistItemDto>(`/checklists/${checklistId}/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
  return mapChecklistItemDto(dto);
}

export type GetChecklistOverviewsParams = {
  page?: number;
};

// size/sort는 안 보낸다 - Backend 기본 페이지 크기(20)를 그대로 쓰고, 정렬은 항상 최종 점검일
// 최신순으로 고정되어 있어(Backend PageableDefault) 보내도 무시된다.
export async function getMyChecklistOverviews(
  params?: GetChecklistOverviewsParams,
  cookieHeader?: string,
): Promise<ChecklistOverviewPage> {
  if (useMockData) {
    return getMockChecklistOverviews(params?.page);
  }

  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set('page', String(params.page));
  const queryString = query.toString();

  const page = await requestJson<PageResponseDto<ChecklistOverviewDto>>(
    queryString ? `/checklists?${queryString}` : '/checklists',
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );

  return {
    items: page.content.map(mapChecklistOverviewDto),
    page: page.page,
    size: page.size,
    totalElements: page.totalElements,
    totalPages: page.totalPages,
    hasNext: page.hasNext,
  };
}
