import { ApiError } from './api/http';

// 계약 문구 분석 파이프라인(입력 제출/OCR/마스킹/분석/채팅)에서 백엔드가 error.code로 구분해
// 내려주는 실패 사유 중, 사용자에게 다르게 안내할 가치가 있는 것만 문구를 따로 둔다. 나머지
// 코드는 호출부가 넘긴 일반 문구로 그대로 처리한다(다른 도메인과 동일한 pass-through 패턴).
const CONTRACT_ANALYSIS_ERROR_MESSAGES: Record<string, string> = {
  CONTRACT_ANALYSIS_OCR_EMPTY_RESULT: '이미지에서 텍스트를 찾지 못했어요. 다른 사진을 시도하거나 직접 입력해주세요.',
  CONTRACT_ANALYSIS_AI_API_ERROR: 'AI 서비스가 잠시 불안정해요. 잠시 후 다시 시도해주세요.',
  CONTRACT_ANALYSIS_AI_HALLUCINATION: '분석 중 문제가 발생했어요. 다시 시도해주세요.',
  CONTRACT_ANALYSIS_TEXT_TOO_SHORT: '입력한 내용이 너무 짧아요. 20자 이상 입력해주세요.',
  CONTRACT_ANALYSIS_FILE_TOO_LARGE: '이미지 크기가 너무 커요. 10MB 이하로 다시 업로드해주세요.',
  CONTRACT_ANALYSIS_HISTORY_NOT_FOUND: '존재하지 않는 계약 분석 이력이에요.',
  CONTRACT_ANALYSIS_FORBIDDEN: '본인의 계약 분석 이력만 확인할 수 있어요.',
};

export function getContractAnalysisErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.body?.code) {
    const specificMessage = CONTRACT_ANALYSIS_ERROR_MESSAGES[error.body.code];
    if (specificMessage) {
      return specificMessage;
    }
  }
  return fallback;
}
