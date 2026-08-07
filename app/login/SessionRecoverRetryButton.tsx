'use client';

import { useState } from 'react';
import { isUnreachableError } from '../lib/api/http';
import { sanitizeNextPath } from '../lib/nextPath';
import { getCurrentUser } from '../services/auth';

/**
 * crossOriginAuth 배포에서만 쓴다. /auth/session-recover(Route Handler)는 refresh_token 쿠키를
 * 자기 자신의(프론트) 도메인 요청에서 읽는데, 크로스오리진 배포에서는 그 쿠키가 백엔드 도메인에만
 * 종속되어 프론트로 가는 요청에는 아예 붙지 않는다 - 그 경로로 재시도하면 항상 refreshToken이
 * 비어 있는 것으로 처리되어 무조건 session_expired로 떨어지고, 실제로는 세션이 멀쩡해도 강제로
 * 재로그인시킨다. 대신 브라우저가 직접 크로스오리진 fetch(credentials:'include')로 백엔드에
 * 재확인한다 - 이 요청의 대상은 백엔드 도메인이므로 그 쿠키가 정상적으로 붙는다.
 */
export function SessionRecoverRetryButton({ next }: { next: string }) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = () => {
    setRetrying(true);
    getCurrentUser()
      .then(() => {
        // next는 로그인 화면(searchParams)에서 그대로 넘어온 값이라 외부에서 조작 가능하다 -
        // 다른 모든 next 소비처(LoginFormClient, oauth/callback)는 이동 직전 sanitizeNextPath로
        // 재검증하는데 이 경로만 빠져 있었다(오픈 리다이렉트: ?next=https://evil.example.com).
        window.location.href = sanitizeNextPath(next);
      })
      .catch((error) => {
        // isUnreachableError면 여전히 서버/네트워크가 불안정한 상태라 이 페이지에 그대로
        // 머무른다(안내 문구가 이미 재시도를 유도하고 있어 버튼을 다시 누를 수 있게만 되돌린다).
        // 그 외(세션이 확실히 무효로 확인됨)는 requestJson이 이미 /auth/session-recover로 페이지
        // 이동을 시작한 뒤라(다시는 resolve/reject되지 않는 Promise) 여기 도달하지 않는다.
        if (isUnreachableError(error)) {
          setRetrying(false);
        }
      });
  };

  return (
    <button
      type="button"
      onClick={handleRetry}
      disabled={retrying}
      className="font-bold underline disabled:opacity-50"
    >
      {retrying ? '재시도 중...' : '다시 시도'}
    </button>
  );
}
