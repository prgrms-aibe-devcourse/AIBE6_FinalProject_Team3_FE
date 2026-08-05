import { type ContractMaskingReviewPayload } from '../../../types/api';
import { ContractResultClient } from './ContractResultClient';

export const dynamic = 'force-dynamic';

type ResultPageProps = {
  searchParams: Promise<{ data?: string }>;
};

// upload 화면이 마스킹까지만 마친 뒤 그 결과(+OCR uncertainFields)를 base64url로 인코딩해 넘겨준다.
// AI 분석은 아직 실행되지 않은 상태 - 사용자가 이 화면에서 마스킹된 텍스트를 확인하고 "이대로 분석
// 진행"을 눌러야 analyzeContract가 호출된다(그 이후 로직은 클라이언트 컴포넌트가 담당).
function decodeMaskingReviewPayload(data: string): ContractMaskingReviewPayload {
  return JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as ContractMaskingReviewPayload;
}

export default async function Page({ searchParams }: ResultPageProps) {
  const { data } = await searchParams;

  let payload: ContractMaskingReviewPayload | undefined;
  let loadError: string | undefined;

  if (!data) {
    loadError = '마스킹 결과를 찾을 수 없습니다. 특약사항 입력부터 다시 진행해 주세요.';
  } else {
    try {
      payload = decodeMaskingReviewPayload(data);
    } catch {
      loadError = '마스킹 결과를 불러오지 못했습니다. 특약사항 입력부터 다시 진행해 주세요.';
    }
  }

  return (
    <ContractResultClient
      maskedText={payload?.maskedText ?? ''}
      maskedCount={payload?.maskedCount ?? 0}
      uncertainFields={payload?.uncertainFields ?? []}
      loadError={loadError}
    />
  );
}
