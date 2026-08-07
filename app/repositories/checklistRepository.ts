import { mapChecklistDto, mapChecklistItemDto, mapChecklistResultDto } from '../mappers/checklist';
import { formatDateText } from '../mappers/property';
import { initChecklistItemDtos } from '../mocks/init/checklist';
import { getMockProperties } from './propertyRepository';
import { type ChecklistItemUpdateRequestDto, type ChecklistStatusDto } from '../types/api';
import { type Checklist, type ChecklistItem, type ChecklistOverviewPage } from '../types/domain';
import { type ChecklistSummary } from '../lib/checklistSummary';

const MOCK_CHECKLIST_ID = 1;
const MOCK_TEMPLATE_VERSION = 1;

let mockChecklistItemDtos = initChecklistItemDtos.map((dto) => ({ ...dto }));

export function getMockChecklist(propertyId: number): Checklist {
  return mapChecklistDto({
    id: MOCK_CHECKLIST_ID,
    propertyId,
    templateVersion: MOCK_TEMPLATE_VERSION,
    status: 'IN_PROGRESS',
    items: mockChecklistItemDtos,
  });
}

export function updateMockChecklistItem(itemId: number, request: ChecklistItemUpdateRequestDto): ChecklistItem {
  mockChecklistItemDtos = mockChecklistItemDtos.map((item) => {
    if (item.id !== itemId) {
      return item;
    }
    if ('checked' in request) {
      return { ...item, checked: request.checked, userNote: null, issueFound: false };
    }
    if ('userNote' in request) {
      return { ...item, checked: true, userNote: request.userNote, issueFound: true };
    }
    return { ...item, value: request.value, checked: true };
  });

  const updated = mockChecklistItemDtos.find((item) => item.id === itemId);
  if (!updated) {
    throw new Error(`Mock checklist item ${itemId} not found.`);
  }

  return mapChecklistItemDto(updated);
}

// Backend Checklist.refreshStatus()와 동일한 규칙을 mock에서도 그대로 흉내낸다.
function deriveMockChecklistStatus(): ChecklistStatusDto {
  const checkedCount = mockChecklistItemDtos.filter((item) => item.checked).length;
  if (checkedCount === 0) {
    return 'NOT_STARTED';
  }
  const allRequiredChecked = mockChecklistItemDtos
    .filter((item) => item.importance === 'REQUIRED')
    .every((item) => item.checked);
  return allRequiredChecked ? 'COMPLETED' : 'IN_PROGRESS';
}

// Backend Checklist.computeResult()와 동일한 규칙을 mock에서도 그대로 흉내낸다.
export function getMockChecklistResult(): ChecklistSummary {
  const totalCount = mockChecklistItemDtos.length;
  const checkedCount = mockChecklistItemDtos.filter((item) => item.checked).length;
  const requiredMissingCount = mockChecklistItemDtos.filter(
    (item) => item.importance === 'REQUIRED' && !item.checked,
  ).length;
  const issueCount = mockChecklistItemDtos.filter((item) => item.issueFound).length;
  const status = deriveMockChecklistStatus();

  return mapChecklistResultDto({
    status,
    checkedCount,
    totalCount,
    requiredMissingCount,
    issueCount,
    message: status === 'NOT_STARTED' ? '체크리스트를 시작해보세요' : undefined,
    // Backend가 상태와 무관하게 항상 내려주는 고정 문구(ChecklistResultResponse.SAFETY_DISCLAIMER)와 동일하게 맞춘다.
    disclaimer: '이 결과는 매물의 안전을 보장하지 않습니다.',
  });
}

// mock 매물 20개를 실 Backend 기본 페이지 크기(20)보다 작게 나눠야 이전/다음 UI를 mock에서도
// 눈으로 확인할 수 있어, 화면 페이지 크기와 무관한 mock 전용 값을 쓴다.
const MOCK_CHECKLIST_PAGE_SIZE = 5;

// mock 모드에는 매물별로 분리된 체크리스트 저장소가 없고 전역 mockChecklistItemDtos 하나뿐이라,
// 목록의 모든 매물이 같은 진행 상태를 공유한다 (실제 API 모드에서는 매물마다 실제로 다르게 나온다).
export function getMockChecklistOverviews(page = 0): ChecklistOverviewPage {
  const status = deriveMockChecklistStatus();
  // mock에는 매물/체크리스트 각각의 실제 수정 시각이 없어, Backend의 "체크리스트 없으면 매물
  // 수정시각으로 대체" 규칙을 흉내내는 대신 조회 시점을 그대로 쓴다.
  const lastCheckedAt = formatDateText(new Date().toISOString());

  const allItems = getMockProperties().map((property) => ({
    propertyId: property.id,
    checklistId: status === 'NOT_STARTED' ? null : MOCK_CHECKLIST_ID,
    address: property.address,
    propertyTitle: property.title,
    tradeType: property.type,
    status,
    lastCheckedAt,
  }));

  const totalElements = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / MOCK_CHECKLIST_PAGE_SIZE));
  const start = page * MOCK_CHECKLIST_PAGE_SIZE;
  const items = allItems.slice(start, start + MOCK_CHECKLIST_PAGE_SIZE);

  return {
    items,
    page,
    size: MOCK_CHECKLIST_PAGE_SIZE,
    totalElements,
    totalPages,
    hasNext: page + 1 < totalPages,
  };
}
