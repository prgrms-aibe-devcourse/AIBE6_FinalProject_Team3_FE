'use client';

import { Loader2 } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { getCurrentUser } from '../../services/auth';
import { AdminNav } from './AdminNav';

type GateState = 'checking' | 'authorized' | 'forbidden';

// 관리자가 아닌 사용자에게는 이 경로가 존재한다는 사실 자체를 드러내지 않기 위해 리다이렉트가
// 아니라 404와 동일한 화면을 보여준다. 인증 자체는 상위 (main)/layout.tsx(MainLayoutGate)가 이미
// 보장하므로, 여기서는 role만 브라우저에서 크로스오리진 fetch로 추가 확인한다 — crossOriginAuth
// 배포에서는 이 레이아웃도 서버 컴포넌트로는 백엔드 쿠키를 받을 수 없어 role 확인이 불가능하다.
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let cancelled = false;
    // pathname이 바뀔 때만 이 effect가 재실행되는데, Next.js가 이 레이아웃을 admin/users ↔
    // admin/reports 같은 하위 경로 이동에서는 리마운트하지 않으므로 재검증 자체가 없으면 세션
    // 중 권한이 박탈돼도 admin/* 안에서 계속 머무는 동안은 이전 'authorized' 상태가 그대로
    // 남는다. 재검증 중에는 이전 상태를 그대로 보여주지 않고 'checking'으로 되돌린다 - 여기는
    // role 게이트라 방금 권한을 잃은 사용자에게 admin 화면을 잠깐이라도 계속 보여주는 쪽의
    // 리스크가 로딩 스피너를 한 번 더 보여주는 쪽보다 크다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState('checking');

    getCurrentUser()
      .then((me) => {
        if (!cancelled) {
          setState(me.role === 'ADMIN' ? 'authorized' : 'forbidden');
        }
      })
      .catch((error) => {
        // 실패 사유(진짜 권한 없음 vs CORS/네트워크 오류)를 사용자에게는 구분해서 보여주지
        // 않는다 - 관리자가 아닌 사용자에게 "설정 오류"와 "권한 없음"을 구분해 알려주면 이 경로가
        // 존재한다는 사실 자체가 새어나간다. 대신 배포 직후 진단용으로 콘솔에만 남긴다.
        console.error('Admin role check failed', error);
        if (!cancelled) {
          setState('forbidden');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

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

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      {children}
    </div>
  );
}
