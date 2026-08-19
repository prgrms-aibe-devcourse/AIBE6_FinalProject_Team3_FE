import {
  mapContractAnalysisResultDto,
  mapContractHistoryClauseDto,
  mapContractHistoryItemDto,
} from '../mappers/contract-analysis';
import {
  initContractAnalysisResultDto,
  initContractHistoryClauseDtos,
  initContractHistoryItemDtos,
} from '../mocks/init/contract-analysis';
import { type ContractAnalysisResult, type ContractClause, type ContractHistoryPage } from '../types/domain';

const mockContractAnalysisResult: ContractAnalysisResult = mapContractAnalysisResultDto(initContractAnalysisResultDto);

export function getMockContractAnalysisResult(): ContractAnalysisResult {
  return mockContractAnalysisResult;
}

// checklistRepository.ts의 getMockChecklistOverviews와 동일한 패턴 - mock은 정렬/페이지네이션을
// 그 자리에서 직접 슬라이싱해 흉내낸다(Backend는 항상 createdAt 최신순 고정).
export function getMockContractHistoryPage(page = 0, size = 5): ContractHistoryPage {
  const allItems = initContractHistoryItemDtos.map(mapContractHistoryItemDto);
  const totalElements = allItems.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / size));
  const start = page * size;
  const items = allItems.slice(start, start + size);

  return {
    items,
    page,
    size,
    totalElements,
    totalPages,
    hasNext: page + 1 < totalPages,
  };
}

const mockContractHistoryClauses: ContractClause[] = initContractHistoryClauseDtos.map(mapContractHistoryClauseDto);

// getMockContractAnalysisResult와 동일하게, id와 무관하게 항상 같은 mock 조항 목록을 돌려준다.
export function getMockContractHistoryClauses(): ContractClause[] {
  return mockContractHistoryClauses;
}
