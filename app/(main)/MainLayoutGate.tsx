'use client';

import { Loader2 } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isUnreachableError } from '../lib/api/http';
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

  // 인증 확인 자체는 마운트당 한 번만 하면 된다(Server Component 기반 (main)/layout.tsx가 사일블
  // 라우트 클라이언트 내비게이션마다 재실행되지 않는 것과 동일해야 하는 불변식) - 실패 시 돌아갈
  // next 경로만 그 시점의 최신 위치를 알면 되므로, effect를 다시 실행시키지 않고 ref로 최신값을
  // 추적한다(SignupFormClient의 latestNicknameRef와 동일한 패턴). AdminLayout은 "role이 세션
  // 도중 회수될 수 있어 재확인할 가치가 있다"는 별도 판단으로 매 pathname마다 재확인하는데, 이
  // 컴포넌트는 그런 근거 없이 단순히 next 값을 읽으려고 만든 의존성 배열이었다.
  const locationRef = useRef({ pathname, searchParams });
  useEffect(() => {
    locationRef.current = { pathname, searchParams };
  }, [pathname, searchParams]);

  useEffect(() => {
    let cancelled = false;
    // 뒤로가기 등으로 이 컴포넌트 자체가 언마운트되면 진행 중이던 GET /auth/me(및 401 이후의
    // refresh-then-retry)를 실제로 중단시킨다. abort하지 않으면 이미 이 화면을 떠난 뒤에도 응답이
    // 뒤늦게 도착해 requestJson 내부에서 redirectToSessionRecover()가 실행 시점의
    // window.location(=이미 이동해버린 새 페이지)을 그대로 읽어 그 페이지를 강제로 세션 만료
    // 처리해버리는 문제가 있었다.
    const controller = new AbortController();

    getCurrentUser(undefined, controller.signal)
      .then((me) => {
        if (cancelled) return;
        setState({ status: 'ready', nickname: me.nickname, profileImageUrl: me.profileImageUrl, isAdmin: me.role === 'ADMIN' });
      })
      .catch((error) => {
        if (cancelled) return;
        // 'rejected'(세션이 확실히 무효) 케이스는 requestJson이 이미 window.location.href로
        // session-recover로 이동시키는 중이라 여기 도달하지 않는다(다시는 resolve/reject되지
        // 않는 Promise). 여기 도달하는 건 최초 GET /auth/me 자체가 실패했거나(네트워크 오류,
        // CORS 차단 등 - refresh 단계까지 가지도 못함) 401 이후 refresh 시도가 막힌 경우뿐이다 -
        // 둘 다 isUnreachableError로 함께 판단해야 진짜 네트워크 장애를 "세션 만료"로 잘못
        // 안내하지 않는다.
        const { pathname: currentPathname, searchParams: currentSearchParams } = locationRef.current;
        const next = currentPathname + (currentSearchParams.toString() ? `?${currentSearchParams.toString()}` : '');
        const errorParam = isUnreachableError(error) ? 'session_unavailable' : 'session_expired';
        window.location.href = `/login?error=${errorParam}&next=${encodeURIComponent(next)}`;
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
    // 의도적으로 마운트당 1회만 실행한다(위 주석 참고) - pathname/searchParams는 실패 시에만
    // locationRef로 읽으므로 의존성에 넣을 필요가 없다.
  }, []);

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
