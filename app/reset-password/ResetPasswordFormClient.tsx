'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { resolveErrorMessage } from '../lib/resolveErrorMessage';
import { confirmPasswordReset } from '../services/auth';
import { type PasswordPolicyDto } from '../types/api';

type ResetPasswordFormClientProps = {
  token: string;
  passwordPolicy: PasswordPolicyDto;
};

export function ResetPasswordFormClient({ token, passwordPolicy }: ResetPasswordFormClientProps) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (newPassword !== confirmPassword) return;

    setIsSubmitting(true);
    setError(undefined);
    try {
      await confirmPasswordReset(token, newPassword);
      // 재설정 성공 시 백엔드가 기존 세션(refresh token)을 전부 무효화하므로, 새 비밀번호로
      // 다시 로그인해야 한다.
      router.push('/login');
    } catch (submitError) {
      setError(
        resolveErrorMessage(submitError, '비밀번호 재설정에 실패했습니다. 링크가 만료되었을 수 있어요.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">새 비밀번호</span>
        <input
          className="ansim-input w-full"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="영문, 숫자 포함 8~72자"
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          pattern={passwordPolicy.pattern}
          title={passwordPolicy.message}
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">새 비밀번호 확인</span>
        <input
          className="ansim-input w-full"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="비밀번호를 다시 입력해 주세요"
          autoComplete="new-password"
          required
        />
        {passwordMismatch && <p className="mt-1 text-sm text-red-600">비밀번호가 일치하지 않습니다.</p>}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="ansim-button-primary mt-2 w-full py-3 disabled:opacity-60"
      >
        {isSubmitting ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  );
}
