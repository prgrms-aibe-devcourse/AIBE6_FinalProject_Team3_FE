import { useMockData } from '../config/dataSource';
import { requestJson } from '../lib/api/http';
import {
  mapContractAnalysisResultDto,
  mapContractHistoryClauseDto,
  mapContractHistoryItemDto,
} from '../mappers/contract-analysis';
import {
  getMockContractAnalysisResult,
  getMockContractHistoryClauses,
  getMockContractHistoryPage,
} from '../repositories/contractAnalysisRepository';
import {
  type ContractAnalysisResultDto,
  type ContractAnalyzeRequestDto,
  type ContractChatClauseContext,
  type ContractChatMessage,
  type ContractChatRequestDto,
  type ContractChatResponseDto,
  type ContractHistoryDetailDto,
  type ContractHistoryItemDto,
  type ContractInputResponseDto,
  type ContractInputType,
  type ContractMaskingRequestDto,
  type ContractMaskingResponseDto,
  type ContractOcrUncertainField,
  type OcrExtractResponseDto,
  type PageResponseDto,
} from '../types/api';
import { type ContractAnalysisResult, type ContractClause, type ContractHistoryPage } from '../types/domain';

// 서버는 분석 결과를 포함해 아무 것도 저장하지 않는 정책이라(이력 조회 목적 저장 없음),
// 이전 단계 응답값을 클라이언트가 들고 있다가 다음 단계 요청에 그대로 실어 보내는 구조다.
// mock 모드에서는 1~3단계를 입력값 그대로 통과시키고, 최종 분석 단계만 app/mocks/init 데이터를 반환한다.

export type SubmitContractInputParams =
  { inputType: 'TEXT'; text: string; propertyId?: number } | { inputType: 'IMAGE'; image: File; propertyId?: number };

export async function submitContractInput(params: SubmitContractInputParams): Promise<ContractInputResponseDto> {
  if (useMockData) {
    return params.inputType === 'IMAGE'
      ? { inputType: 'IMAGE', readyForNextStep: true, nextStep: 'OCR' }
      : { inputType: 'TEXT', readyForNextStep: true, nextStep: 'MASKING' };
  }

  // 이 엔드포인트는 TEXT/IMAGE 둘 다 multipart/form-data로 받는다(JSON 바디 아님).
  const formData = new FormData();
  formData.append('inputType', params.inputType);
  if (params.inputType === 'TEXT') {
    formData.append('text', params.text);
  } else {
    formData.append('image', params.image);
  }
  if (params.propertyId != null) {
    formData.append('propertyId', String(params.propertyId));
  }

  return requestJson<ContractInputResponseDto>('/contract-analysis/inputs', {
    method: 'POST',
    body: formData,
  });
}

export type ExtractOcrTextResult = {
  extractedText: string;
  // OCR이 신뢰도가 낮았던 구간. 더 이상 422로 거부되지 않고 항상 이 필드로 같이 내려온다 -
  // 사용자가 확인 단계에서 직접 검토할 수 있게 안내하는 용도로만 쓰고, 자동으로 막지는 않는다.
  uncertainFields: ContractOcrUncertainField[];
  // 인식된 텍스트 전체가 매우 짧을 때 true. uncertainFields(부분 구간)와 달리 결과 자체를
  // 신뢰하기 어렵다는 신호라 마스킹 확인 화면에서 더 강하게 안내한다.
  shortTextWarning: boolean;
};

// 이미지 입력 경로용(submitContractInput의 nextStep이 'OCR'일 때). 텍스트 직접 입력 화면에서는
// 호출되지 않지만, 이미지 업로드가 실제로 붙을 때 재사용할 수 있도록 스펙대로 구현해 둔다.
export async function extractOcrText(image: File): Promise<ExtractOcrTextResult> {
  if (useMockData) {
    return { extractedText: '', uncertainFields: [], shortTextWarning: false };
  }

  const formData = new FormData();
  formData.append('image', image);

  const dto = await requestJson<OcrExtractResponseDto>('/contract-analysis/ocr', {
    method: 'POST',
    body: formData,
  });

  return {
    extractedText: dto.extractedText,
    uncertainFields: dto.uncertainFields,
    shortTextWarning: dto.shortTextWarning,
  };
}

export type MaskContractTextResult = {
  maskedText: string;
  maskedCount: number;
};

export async function maskContractText(text: string): Promise<MaskContractTextResult> {
  if (useMockData) {
    return { maskedText: text, maskedCount: 0 };
  }

  const dto = await requestJson<ContractMaskingResponseDto>('/contract-analysis/masking', {
    method: 'POST',
    body: JSON.stringify({ text } satisfies ContractMaskingRequestDto),
  });

  return { maskedText: dto.maskedText, maskedCount: dto.maskedCount };
}

export async function analyzeContract(
  maskedText: string,
  userConfirmed: boolean,
  inputType: ContractInputType,
  propertyId?: number,
): Promise<ContractAnalysisResult> {
  if (useMockData) {
    return getMockContractAnalysisResult();
  }

  const dto = await requestJson<ContractAnalysisResultDto>('/contract-analysis/analyze', {
    method: 'POST',
    body: JSON.stringify({ maskedText, userConfirmed, inputType, propertyId } satisfies ContractAnalyzeRequestDto),
  });

  return mapContractAnalysisResultDto(dto);
}

// 조항 카드 안 미니 채팅용 추가 질문. 조항 하나에 한정된 대화라 매 호출마다 그 조항의 원문/위험여부/
// 설명(clause)과 그동안의 대화(history)를 통째로 실어 보낸다 - 서버가 아무 것도 저장하지 않는
// 정책이라 다른 단계들과 동일한 패턴이다.
export async function sendContractClauseQuestion(
  clause: ContractChatClauseContext,
  question: string,
  history?: ContractChatMessage[],
): Promise<ContractChatResponseDto> {
  if (useMockData) {
    return {
      answer: '지금은 mock 모드라 실제 AI 답변 대신 예시 문구를 보여드리고 있어요.',
      aiGeneratedNotice: '이 답변은 AI가 자동으로 생성한 참고용 정보입니다.',
      disclaimer: '본 답변은 참고 정보이며 법률 자문이나 계약 안전을 보장하지 않습니다.',
    };
  }

  return requestJson<ContractChatResponseDto>('/contract-analysis/chat', {
    method: 'POST',
    body: JSON.stringify({ clause, question, history } satisfies ContractChatRequestDto),
  });
}

export type GetContractHistoryParams = {
  page?: number;
  size?: number;
};

// 마이페이지 "계약분석 이력" 섹션용. 정렬(최신순)은 항상 고정이라(Backend
// ContractAnalysisHistoryService 참고) sort 쿼리 파라미터는 받지 않는다 - page/size만
// getMyChecklistOverviews(checklist.ts)와 동일한 패턴으로 다룬다.
export async function getMyContractHistory(
  params?: GetContractHistoryParams,
  cookieHeader?: string,
): Promise<ContractHistoryPage> {
  if (useMockData) {
    return getMockContractHistoryPage(params?.page, params?.size);
  }

  const query = new URLSearchParams();
  if (params?.page !== undefined) query.set('page', String(params.page));
  if (params?.size !== undefined) query.set('size', String(params.size));
  const queryString = query.toString();

  const page = await requestJson<PageResponseDto<ContractHistoryItemDto>>(
    queryString ? `/users/me/contract-history?${queryString}` : '/users/me/contract-history',
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );

  return {
    items: page.content.map(mapContractHistoryItemDto),
    page: page.page,
    size: page.size,
    totalElements: page.totalElements,
    totalPages: page.totalPages,
    hasNext: page.hasNext,
  };
}

// 이력 항목 클릭 시 아코디언(위험 조항 분석)만 보여주는 용도라, summary/disclaimer 등 나머지
// 상세 필드는 쓰지 않고 clauses만 꺼내서 돌려준다.
export async function getContractHistoryClauses(id: number): Promise<ContractClause[]> {
  if (useMockData) {
    return getMockContractHistoryClauses();
  }

  const dto = await requestJson<ContractHistoryDetailDto>(`/users/me/contract-history/${id}`);
  return dto.clauses.map(mapContractHistoryClauseDto);
}
