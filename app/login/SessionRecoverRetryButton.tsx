'use client';

import { useState } from 'react';
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
      .catch(() => {
        // requestJson이 세션을 확실히 무효로 판단한 경우(rejected)는 이미 /auth/session-recover로
        // 페이지 이동을 시작한 뒤라(다시는 resolve/reject되지 않는 Promise) 여기 도달하지 않는다.
        // 그 외의 모든 거부 - isUnreachableError(네트워크 오류/일시 장애)뿐 아니라, 세션 무효로
        // 확정되지 않은 401/403/404, 백엔드 재배포 중 502/503처럼 requestJson이 리다이렉트를
        // 시작하지 않고 그대로 던지는 경우 전부 - 는 실제로 여기 도달해 settle되므로, 매번
        // retrying을 풀어줘야 한다. 예전엔 isUnreachableError일 때만 풀어줬는데, 리다이렉트가
        // 시작되지 않는 다른 실패들에서는 버튼이 "재시도 중..."에 영구히 멈춰 있었다.
        setRetrying(false);
      });
  };

  return (
    <button type="button" onClick={handleRetry} disabled={retrying} className="font-bold underline disabled:opacity-50">
      {retrying ? '재시도 중...' : '다시 시도'}
    </button>
  );
}
