'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { devLogin } from './services/auth';

type DevLoginButtonProps = {
  // 부모(page.tsx)가 devkey 캡처 + localStorage 조회를 한 effect 안에서 순서대로 처리한 뒤 내려주는
  // 값 - 이 컴포넌트가 스스로 localStorage를 다시 읽으면, "저장 먼저, 조회 나중"이 이 컴포넌트와
  // 부모 페이지의 effect 실행 순서(React는 자식 effect를 부모보다 먼저 실행한다)에 의존하게 돼서,
  // 방금 `/#devkey=` 링크로 들어온 첫 방문에서도 버튼이 숨어버리는 경쟁 상태가 생길 수 있다.
  devLoginKey: string | null;
};

// 개발 편의용 버튼 — NEXT_PUBLIC_ENABLE_DEV_LOGIN=true이고, 이 브라우저가 `/#devkey=<secret>`
// 부트스트랩 링크를 한 번이라도 방문해 열쇠를 저장해둔 경우에만 렌더링된다. 열쇠가 없으면(일반
// 방문자) 버튼 자체가 보이지 않아, "관리자 로그인 버튼이 있다"는 사실조차 드러나지 않는다.
// 백엔드도 DEV_LOGIN_ENABLED가 꺼져 있거나 key가 DEV_LOGIN_SECRET과 다르면 이 요청을 404로
// 거부하므로 이중으로 막혀 있다.
export function DevLoginButton({ devLoginKey }: DevLoginButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (process.env.NEXT_PUBLIC_ENABLE_DEV_LOGIN !== 'true' || !devLoginKey) {
    return null;
  }

  const handleClick = async () => {
    setIsLoading(true);
    setFailed(false);
    try {
      await devLogin(devLoginKey);
      router.push('/home');
      router.refresh();
    } catch (error) {
      // 개발 전용 버튼이지만, 실패를 완전히 삼키면 404(DEV_LOGIN_ENABLED 미적용 등)와
      // 네트워크 오류를 구분하기 어려워 원인 파악이 오래 걸린다 — 콘솔에 원인을 남기고
      // 버튼 옆에도 짧게 실패 상태를 보여준다.
      console.warn('[DevLoginButton] dev-login 실패:', error);
      setFailed(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="text-[11px] text-slate-300 transition-colors hover:text-slate-400 disabled:opacity-60"
      >
        {isLoading ? '개발자 로그인 중...' : '개발자용 관리자 로그인'}
      </button>
      {failed && <span className="text-[11px] text-red-400">실패 (콘솔 확인)</span>}
    </span>
  );
}
