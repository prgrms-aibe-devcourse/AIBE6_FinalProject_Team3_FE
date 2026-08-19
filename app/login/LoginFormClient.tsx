'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { sanitizeNextPath } from '../lib/nextPath';
import { hasRegisteredProfile } from '../lib/profile';
import { resolveErrorMessage } from '../lib/resolveErrorMessage';
import { login } from '../services/auth';
import { getMyProfile } from '../services/user';

type LoginFormClientProps = {
  // 세션 만료/일시 장애로 로그인 화면에 온 경우 원래 있던 경로 — 로그인 성공 후 무조건 /home으로
  // 보내는 대신 여기로 돌려보낸다. sanitizeNextPath()가 다시 검증하므로(오픈 리다이렉트 방지)
  // 이 값 자체는 검증 없이 그대로 받아도 안전하다.
  next?: string;
};

export function LoginFormClient({ next }: LoginFormClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(undefined);

    try {
      await login({ email, password });

      // OAuth 콜백(app/oauth/callback/route.ts)과 동일한 기준: 프로필 미등록이면 등록 화면으로
      // 우선 보내고, 등록돼 있으면 원래 있던 경로(next)로 — 없으면 홈으로.
      let destination = sanitizeNextPath(next);
      try {
        const profile = await getMyProfile();
        if (!hasRegisteredProfile(profile)) {
          destination = '/mypage/profile';
        }
      } catch (profileError) {
        // 프로필 조회에 실패해도 로그인 자체는 성공했으므로 destination(next 또는 홈)으로 보낸다.
        // oauth/callback/page.tsx의 동일한 실패 처리와 로깅 여부를 맞춘다 - 안 남기면 이 실패가
        // 이메일/비밀번호 로그인 경로에서만 관측되지 않아, 프로필 조회 실패가 늘어도 로그
        // 집계에서 원인 파악이 한쪽 경로에서만 가능해진다.
        console.error('Login: failed to load profile', profileError);
      }

      router.push(destination);
      router.refresh();
    } catch (submitError) {
      setError(resolveErrorMessage(submitError, '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block">
        <span className="sr-only">이메일</span>
        <input
          className="ansim-input w-full"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="이메일"
          autoComplete="email"
          required
        />
      </label>
      <label className="block">
        <span className="sr-only">비밀번호</span>
        <input
          className="ansim-input w-full"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="비밀번호"
          autoComplete="current-password"
          required
        />
      </label>

      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-bold text-teal-700 hover:text-teal-800">
          비밀번호를 잊으셨나요?
        </Link>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" disabled={isSubmitting} className="ansim-button-primary w-full py-3 disabled:opacity-60">
        {isSubmitting ? '로그인 중...' : '이메일로 로그인'}
      </button>
    </form>
  );
}
