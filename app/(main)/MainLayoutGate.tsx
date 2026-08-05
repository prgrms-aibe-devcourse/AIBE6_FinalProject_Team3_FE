'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ApiError } from '../lib/api/http';
import { getCurrentUser } from '../services/auth';
import MainLayoutClient from './MainLayoutClient';

type GateState =
  | { status: 'checking' }
  | { status: 'ready'; nickname: string; profileImageUrl: string | null; isAdmin: boolean };

/**
 * crossOriginAuth 배포용 로그인 게이트. (main)/layout.tsx(Server Component)는 백엔드 도메인
 * 쿠키를 받을 수 없어 로그인 여부를 판단하지 못하므로, 여기서 브라우저가 직접 크로스오리진
 * fetch(getCurrentUser → requestJson, credentials:'include')로 확인한다. access token이
 * 만료된 경우의 자동 refresh-then-retry, refresh까지 실패했을 때의 세션 복구 이동은
 * app/lib/api/http.ts의 기존 로직(refreshOnceInBrowser/redirectToSessionRecover)이 그대로
 * 처리하므로 여기서 다시 구현하지 않는다 — 이 컴포넌트는 그 결과만 반영한다.
 */
export default function MainLayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [state, setState] = useState<GateState>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;

    getCurrentUser()
      .then((me) => {
        if (cancelled) return;
        setState({ status: 'ready', nickname: me.nickname, profileImageUrl: me.profileImageUrl, isAdmin: me.role === 'ADMIN' });
      })
      .catch((error) => {
        if (cancelled) return;
        // 'rejected'(세션이 확실히 무효) 케이스는 requestJson이 이미 window.location.href로
        // session-recover로 이동시키는 중이라 여기 도달하지 않는다(다시는 resolve/reject되지
        // 않는 Promise). 여기 도달하는 건 'unreachable'(네트워크 오류 등으로 refresh 자체를
        // 시도 못한 경우)뿐이다 — 그 외 아직 못 다룬 에러도 안전하게 같은 경로로 보낸다.
        const next = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
        const errorParam = error instanceof ApiError && error.sessionRefreshOutcome === 'unreachable'
          ? 'session_unavailable'
          : 'session_expired';
        window.location.href = `/login?error=${errorParam}&next=${encodeURIComponent(next)}`;
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, searchParams]);

  if (state.status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <MainLayoutClient nickname={state.nickname} profileImageUrl={state.profileImageUrl} isAdmin={state.isAdmin}>
      {children}
    </MainLayoutClient>
  );
}
