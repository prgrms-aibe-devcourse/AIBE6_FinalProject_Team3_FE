import { useMockData } from '../config/dataSource';
import { requestJson } from '../lib/api/http';
import { mapContractAnalysisResultDto } from '../mappers/contract-analysis';
import { getMockContractAnalysisResult } from '../repositories/contractAnalysisRepository';
import {
  type ContractAnalysisResultDto,
  type ContractAnalyzeRequestDto,
  type ContractChatClauseContext,
  type ContractChatHistoryEntry,
  type ContractChatRequestDto,
  type ContractChatResponseDto,
  type ContractInputResponseDto,
  type ContractMaskingRequestDto,
  type ContractMaskingResponseDto,
  type ContractOcrUncertainField,
  type OcrExtractResponseDto,
} from '../types/api';
import { type ContractAnalysisResult } from '../types/domain';

// 서버는 분석 결과를 포함해 아무 것도 저장하지 않는 정책이라(이력 조회 목적 저장 없음),
// 이전 단계 응답값을 클라이언트가 들고 있다가 다음 단계 요청에 그대로 실어 보내는 구조다.
// mock 모드에서는 1~3단계를 입력값 그대로 통과시키고, 최종 분석 단계만 app/mocks/init 데이터를 반환한다.

export type SubmitContractInputParams =
  | { inputType: 'TEXT'; text: string; propertyId?: number }
  | { inputType: 'IMAGE'; image: File; propertyId?: number };

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
};

// 이미지 입력 경로용(submitContractInput의 nextStep이 'OCR'일 때). 텍스트 직접 입력 화면에서는
// 호출되지 않지만, 이미지 업로드가 실제로 붙을 때 재사용할 수 있도록 스펙대로 구현해 둔다.
export async function extractOcrText(image: File): Promise<ExtractOcrTextResult> {
  if (useMockData) {
    return { extractedText: '', uncertainFields: [] };
  }

  const formData = new FormData();
  formData.append('image', image);

  const dto = await requestJson<OcrExtractResponseDto>('/contract-analysis/ocr', {
    method: 'POST',
    body: formData,
  });

  return { extractedText: dto.extractedText, uncertainFields: dto.uncertainFields };
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

export async function analyzeContract(maskedText: string, userConfirmed: boolean): Promise<ContractAnalysisResult> {
  if (useMockData) {
    return getMockContractAnalysisResult();
  }

  const dto = await requestJson<ContractAnalysisResultDto>('/contract-analysis/analyze', {
    method: 'POST',
    body: JSON.stringify({ maskedText, userConfirmed } satisfies ContractAnalyzeRequestDto),
  });

  return mapContractAnalysisResultDto(dto);
}

// 조항 카드 안 미니 채팅용 추가 질문. 조항 하나에 한정된 대화라 매 호출마다 그 조항의 원문/위험여부/
// 설명(clause)과 그동안의 대화(history)를 통째로 실어 보낸다 - 서버가 아무 것도 저장하지 않는
// 정책이라 다른 단계들과 동일한 패턴이다.
export async function sendContractClauseQuestion(
  clause: ContractChatClauseContext,
  question: string,
  history?: ContractChatHistoryEntry[],
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
