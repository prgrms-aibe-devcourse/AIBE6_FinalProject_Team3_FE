'use client';

import { useState } from 'react';
import { resolveErrorMessage } from '../lib/resolveErrorMessage';
import { requestPasswordReset } from '../services/auth';

export function ForgotPasswordFormClient() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  // 계정 존재 여부를 노출하지 않기 위해 백엔드는 항상 200을 반환한다 - 성공 후에는 폼을 숨기고
  // 이 안내만 보여준다(재요청은 쿨다운이 있으니 같은 이메일로 반복 제출하지 못하게 막을 필요는
  // 없지만, 이미 보낸 뒤 폼을 계속 노출해봐야 혼란만 준다).
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setError(undefined);
    try {
      await requestPasswordReset(email);
      setSubmitted(true);
    } catch (submitError) {
      setError(resolveErrorMessage(submitError, '요청에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <p className="text-sm text-slate-700">
        입력하신 이메일이 가입된 계정이라면, 비밀번호 재설정 링크를 보내드렸어요. 메일함(스팸함 포함)을 확인해 주세요.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">이메일</span>
        <input
          className="ansim-input w-full"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="가입 시 사용한 이메일"
          autoComplete="email"
          required
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="ansim-button-primary mt-2 w-full py-3 disabled:opacity-60"
      >
        {isSubmitting ? '전송 중...' : '재설정 링크 받기'}
      </button>
    </form>
  );
}
