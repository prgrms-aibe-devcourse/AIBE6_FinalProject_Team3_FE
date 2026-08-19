'use client';

import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isUnreachableError } from '../../lib/api/http';
import { getCurrentUser } from '../../services/auth';
import { AdminCurrentUserProvider } from './AdminCurrentUserContext';
import { AdminNav } from './AdminNav';

type GateState = 'checking' | 'authorized' | 'forbidden' | 'unreachable';

// 관리자가 아닌 사용자에게는 이 경로가 존재한다는 사실 자체를 드러내지 않기 위해 리다이렉트가
// 아니라 404와 동일한 화면을 보여준다. 인증 자체는 상위 (main)/layout.tsx(MainLayoutGate)가 이미
// 보장하므로, 여기서는 role만 브라우저에서 크로스오리진 fetch로 추가 확인한다 — crossOriginAuth
// 배포에서는 이 레이아웃도 서버 컴포넌트로는 백엔드 쿠키를 받을 수 없어 role 확인이 불가능하다.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<GateState>('checking');
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined);
  // "다시 시도" 버튼이 setState('checking')만 해서는 effect가 재실행되지 않는다(의존성 배열에
  // pathname만 있음) - 이 카운터를 같이 늘려서 재조회를 강제한다.
  const [retryToken, setRetryToken] = useState(0);
  // 이미 한 번 인가에 성공했었는지 추적한다 - admin/users ↔ admin/reports 같은 탭 이동마다
  // pathname이 바뀌어 이 effect가 재실행되는데, 매번 화면 전체를 'checking' 스피너로 덮어버리면
  // AdminNav/children이 통째로 언마운트됐다 다시 마운트되는 것처럼 보여 탭을 누를 때마다 전체
  // 화면이 두 번 깜빡인다(AdminCurrentUserContext가 막으려던 중복 호출 문제와 같은 종류의 UX
  // 낭비). 최초 로드 때만 전체화면 스피너를 보여주고, 이미 인가된 뒤의 재검증은 백그라운드로
  // 수행해 이전 화면을 그대로 유지하다가 실제로 결과가 달라질 때만(forbidden/unreachable)
  // 전환한다 - 권한이 중간에 박탈되면 여전히 즉시 쫓아내야 하므로 재검증 자체는 그대로 유지한다.
  const hasAuthorizedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    if (!hasAuthorizedRef.current) {
      setState('checking');
    }

    // MainLayoutGate.tsx와 동일한 이유로, 라우트 이동 시 진행 중인 요청을 실제로 중단시킨다 —
    // 그렇지 않으면 이미 떠난 뒤 도착한 401/refresh-rejected 응답이 requestJson 내부에서 그 시점의
    // window.location(=이미 이동한 새 페이지)을 세션 만료로 강제 리다이렉트시킬 수 있다.
    const controller = new AbortController();

    getCurrentUser(undefined, controller.signal)
      .then((me) => {
        if (!cancelled) {
          if (me.role === 'ADMIN') {
            hasAuthorizedRef.current = true;
            setCurrentUserId(me.userId);
            setState('authorized');
          } else {
            hasAuthorizedRef.current = false;
            setState('forbidden');
          }
        }
      })
      .catch((error) => {
        // 진짜 권한 없음과 일시적 CORS/네트워크 오류(unreachable)는 구분한다 - 전자만 404로
        // 접어야 "관리자가 아닌 사용자에게 이 경로 존재 자체를 숨긴다"는 의도가 유지되고,
        // 후자까지 같이 접으면 실제 관리자도 일시 장애 때 "페이지 없음"만 보게 돼 재시도해야
        // 한다는 사실조차 알 수 없다. 배포 직후 진단용으로 콘솔에는 항상 남긴다.
        console.error('Admin role check failed', error);
        if (cancelled) return;
        hasAuthorizedRef.current = false;
        setState(isUnreachableError(error) ? 'unreachable' : 'forbidden');
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [pathname, retryToken]);

  if (state === 'checking') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (state === 'forbidden') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-2xl font-bold text-slate-950">404</h1>
        <p className="text-sm text-slate-500">페이지를 찾을 수 없습니다.</p>
      </div>
    );
  }

  if (state === 'unreachable') {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
        <p className="text-sm text-slate-500">일시적인 오류로 페이지를 확인할 수 없습니다.</p>
        <button
          type="button"
          onClick={() => setRetryToken((token) => token + 1)}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // currentUserId는 setState('authorized')보다 먼저 set돼 이 시점엔 항상 값이 있다(위 참고).
  return (
    <AdminCurrentUserProvider value={{ userId: currentUserId as number }}>
      <div className="container mx-auto max-w-6xl px-4 py-8">
        <AdminNav />
        {children}
      </div>
    </AdminCurrentUserProvider>
  );
}
