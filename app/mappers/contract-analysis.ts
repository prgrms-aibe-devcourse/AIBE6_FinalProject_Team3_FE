import { type ContractAnalysisResult, type ContractClause, type ContractHistoryItem } from '../types/domain';
import {
  type ContractAnalysisResultDto,
  type ContractClauseDto,
  type ContractHistoryClauseDto,
  type ContractHistoryItemDto,
} from '../types/api';
import { formatDateText } from './property';

function mapClauseLevel(riskFlag: boolean): Pick<ContractClause, 'levelLabel' | 'levelColor'> {
  return riskFlag
    ? { levelLabel: '확인 필요', levelColor: 'text-orange-700 bg-orange-50 border-orange-100' }
    : { levelLabel: '참고', levelColor: 'text-slate-600 bg-slate-50 border-slate-100' };
}

export function mapContractClauseDto(dto: ContractClauseDto): ContractClause {
  return {
    originalText: dto.originalText,
    riskFlag: dto.riskFlag,
    explanation: dto.explanation,
    question: dto.question,
    suggestedText: dto.suggestedText,
    ...mapClauseLevel(dto.riskFlag),
  };
}

// 이력 상세(ContractHistoryClauseDto)는 originalText가 없다 - ContractClause.originalText가
// optional인 이유가 이 경로 때문이다.
export function mapContractHistoryClauseDto(dto: ContractHistoryClauseDto): ContractClause {
  return {
    riskFlag: dto.riskFlag,
    explanation: dto.explanation,
    question: dto.question,
    suggestedText: dto.suggestedText,
    ...mapClauseLevel(dto.riskFlag),
  };
}

export function mapContractAnalysisResultDto(dto: ContractAnalysisResultDto): ContractAnalysisResult {
  return {
    clauses: dto.clauses.map(mapContractClauseDto),
    summary: dto.summary,
    aiGeneratedNotice: dto.aiGeneratedNotice,
    disclaimer: dto.disclaimer,
  };
}

export function mapContractHistoryItemDto(dto: ContractHistoryItemDto): ContractHistoryItem {
  return {
    id: dto.id,
    inputType: dto.inputType,
    summary: dto.summary,
    clauseCount: dto.clauseCount,
    riskCount: dto.riskCount,
    createdAt: formatDateText(dto.createdAt),
  };
}
