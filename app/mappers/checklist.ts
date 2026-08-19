import {
  type ChecklistCategoryDto,
  type ChecklistDto,
  type ChecklistImportanceDto,
  type ChecklistItemDto,
  type ChecklistItemTypeDto,
  type ChecklistOverviewDto,
  type ChecklistResultDto,
} from '../types/api';
import {
  type Checklist,
  type ChecklistCategoryId,
  type ChecklistImportance,
  type ChecklistItem,
  type ChecklistItemType,
  type ChecklistOverview,
} from '../types/domain';
import { type ChecklistSummary } from '../lib/checklistSummary';
import { formatDateText, propertyTransactionTypeLabelMap } from './property';

// Backend enum은 JSON에 대문자로 내려온다(예: "INDOOR"). 기존 화면 코드(카테고리 탭 아이콘 등)는
// 소문자를 쓰고 있어서 그 쪽을 고치는 대신 여기서만 변환한다.
const categoryMap: Record<ChecklistCategoryDto, ChecklistCategoryId> = {
  INDOOR: 'indoor',
  NOISE: 'noise',
  SAFETY: 'safety',
  DOCUMENTS: 'documents',
  AREA: 'area',
};

const itemTypeMap: Record<ChecklistItemTypeDto, ChecklistItemType> = {
  CHECK: 'check',
  YES_NO: 'yesNo',
  DATE: 'date',
  DOCUMENT_REQUEST: 'documentRequest',
  MULTIPLE_CHOICE: 'multipleChoice',
};

const importanceMap: Record<ChecklistImportanceDto, ChecklistImportance> = {
  REQUIRED: 'required',
  GENERAL: 'general',
};

export function mapChecklistItemDto(dto: ChecklistItemDto): ChecklistItem {
  return {
    id: dto.id,
    category: categoryMap[dto.category],
    content: dto.content,
    guideText: dto.guideText,
    helperText: dto.helperText,
    importance: importanceMap[dto.importance],
    itemType: itemTypeMap[dto.itemType],
    checked: dto.checked,
    issueFound: dto.issueFound,
    value: dto.value,
    userNote: dto.userNote,
    images: dto.images,
    options: dto.options,
  };
}

export function mapChecklistDto(dto: ChecklistDto): Checklist {
  return {
    id: dto.id,
    propertyId: dto.propertyId,
    items: dto.items.map(mapChecklistItemDto),
  };
}

export function mapChecklistResultDto(dto: ChecklistResultDto): ChecklistSummary {
  const progressPercent = dto.totalCount > 0 ? Math.round((dto.checkedCount / dto.totalCount) * 100) : 0;

  return {
    progressPercent,
    missingRequiredCount: dto.requiredMissingCount,
    cautionCount: dto.issueCount,
    hasStarted: dto.status !== 'NOT_STARTED',
    message: dto.message,
    disclaimer: dto.disclaimer,
  };
}

export function mapChecklistOverviewDto(dto: ChecklistOverviewDto): ChecklistOverview {
  return {
    propertyId: dto.propertyId,
    checklistId: dto.checklistId,
    address: dto.roadAddress ?? dto.jibunAddress ?? '주소 정보 없음',
    propertyTitle: dto.title,
    tradeType: propertyTransactionTypeLabelMap[dto.transactionType],
    status: dto.status,
    lastCheckedAt: formatDateText(dto.lastCheckedAt),
    progressPercent: dto.progressPercent ?? undefined,
    cautionCount: dto.cautionCount ?? undefined,
  };
}
