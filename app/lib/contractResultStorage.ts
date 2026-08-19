import { type ContractMaskingReviewPayload } from '../types/api';

// upload -> result 화면 간 마스킹 결과 전달용. 서버가 아무 것도 저장하지 않는 정책이라(계약분석
// 도메인 공통 제약) query string 대신 sessionStorage에 잠깐 담아뒀다가, result 화면이 마운트되자마자
// 읽고 바로 지운다 - 새로고침/뒤로가기로 재방문했을 때 예전 데이터가 남아있지 않게 하기 위함이다.
// 두 함수 모두 클라이언트 전용 호출부(이벤트 핸들러/useEffect)에서만 쓰여 SSR 중에는 실행되지
// 않으므로 sessionStorage 접근에 별도 가드가 필요 없다.
const STORAGE_KEY = 'contract-analysis:masking-review';

export function saveContractMaskingReview(payload: ContractMaskingReviewPayload): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readAndClearContractMaskingReview(): ContractMaskingReviewPayload | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);

  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as ContractMaskingReviewPayload;
  } catch {
    return null;
  }
}
