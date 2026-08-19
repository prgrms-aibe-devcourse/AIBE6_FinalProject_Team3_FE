'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { readAndClearContractMaskingReview } from '../../../lib/contractResultStorage';
import { type ContractMaskingReviewPayload } from '../../../types/api';
import { ContractResultClient } from './ContractResultClient';

// upload 화면이 마스킹까지만 마친 뒤 그 결과를 sessionStorage에 담아두고 데이터 없이 이 페이지로만
// 이동한다(서버가 아무 것도 저장하지 않는 정책이라 서버 컴포넌트로는 결과를 받을 수 없다).
// sessionStorage는 브라우저 전용 API라 이 페이지도 클라이언트 컴포넌트여야 하고, 첫 렌더(SSR/최초
// 마운트) 시점엔 아직 읽지 못했으므로 짧은 로딩 상태를 거친 뒤 useEffect에서 읽고 바로 지운다.
// AI 분석은 아직 실행되지 않은 상태 - 사용자가 이 화면에서 마스킹된 텍스트를 확인하고 "이대로 분석
// 진행"을 눌러야 analyzeContract가 호출된다(그 이후 로직은 ContractResultClient가 담당).
type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; payload: ContractMaskingReviewPayload }
  | { status: 'error'; message: string };

export default function Page() {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  // readAndClearContractMaskingReview()는 "읽자마자 지우는" 1회성 소비라 멱등하지 않다 - dev 모드
  // React Strict Mode가 마운트 시 이 effect를 두 번 실행하면, 두 번째 실행은 이미 첫 번째가 지운
  // sessionStorage를 만나 정상적으로 읽은 결과를 "결과 없음" 에러로 덮어써버린다. ref로 실제 읽기가
  // 처음 한 번만 일어나도록 막아 이 이중 실행을 무해하게 만든다.
  const hasReadRef = useRef(false);

  useEffect(() => {
    if (hasReadRef.current) {
      return;
    }
    hasReadRef.current = true;

    const stored = readAndClearContractMaskingReview();
    setLoadState(
      stored
        ? { status: 'ready', payload: stored }
        : { status: 'error', message: '마스킹 결과를 찾을 수 없습니다. 특약사항 입력부터 다시 진행해 주세요.' },
    );
  }, []);

  if (loadState.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const payload = loadState.status === 'ready' ? loadState.payload : undefined;

  return (
    <ContractResultClient
      maskedText={payload?.maskedText ?? ''}
      maskedCount={payload?.maskedCount ?? 0}
      uncertainFields={payload?.uncertainFields ?? []}
      shortTextWarning={payload?.shortTextWarning ?? false}
      inputType={payload?.inputType ?? 'TEXT'}
      loadError={loadState.status === 'error' ? loadState.message : undefined}
      propertyId={payload?.propertyId}
    />
  );
}
