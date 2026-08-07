'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { resolveErrorMessage } from '../lib/resolveErrorMessage';
import { signup } from '../services/auth';
import { checkNicknameAvailability } from '../services/user';
import { type PasswordPolicyDto } from '../types/api';

type SignupFormClientProps = {
  passwordPolicy: PasswordPolicyDto;
};

export function SignupFormClient({ passwordPolicy }: SignupFormClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [nicknameCheckStatus, setNicknameCheckStatus] = useState<
    'idle' | 'checking' | 'available' | 'duplicate' | 'error'
  >('idle');
  const [nicknameRequiredError, setNicknameRequiredError] = useState(false);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword;

  const handleCheckNickname = async () => {
    const trimmed = nickname.trim();

    setNicknameCheckStatus('checking');
    setNicknameRequiredError(false);
    try {
      const available = await checkNicknameAvailability(trimmed);
      setNicknameCheckStatus(available ? 'available' : 'duplicate');
    } catch {
      setNicknameCheckStatus('error');
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    if (password !== confirmPassword) {
      // 폼의 암묵적 제출(입력란에서 Enter) 경로는 브라우저가 포커스를 되돌릴 수 있어,
      // 다음 tick으로 미뤄야 포커스 이동이 안정적으로 적용된다.
      setTimeout(() => confirmPasswordRef.current?.focus(), 0);
      return;
    }

    if (nicknameCheckStatus !== 'available') {
      setNicknameRequiredError(true);
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      // handleCheckNickname은 nickname.trim()으로 중복 확인을 했으므로, 여기서도 trim된 값을
      // 보내야 한다 - 그대로 보내면 입력값에 앞뒤 공백이 남아 있을 때 "확인된 적 없는" 값이
      // 제출되어 버린다(중복확인 통과 == 실제 제출값이라는 보장이 깨짐).
      await signup({ email, password, nickname: nickname.trim() });
      // 방금 가입한 계정은 프로필을 등록한 적이 없으므로 곧장 등록 화면으로 보낸다.
      router.push('/mypage/profile');
      router.refresh();
    } catch (submitError) {
      setError(resolveErrorMessage(submitError, '회원가입에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">이메일</span>
        <input
          className="ansim-input w-full"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">비밀번호</span>
        <input
          className="ansim-input w-full"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        <span className="mb-1.5 block text-sm font-bold text-slate-700">비밀번호 확인</span>
        <input
          ref={confirmPasswordRef}
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
      <label className="block">
        <span className="mb-1.5 block text-sm font-bold text-slate-700">닉네임</span>
        <div className="flex gap-2">
          <input
            className="ansim-input flex-1"
            value={nickname}
            onChange={(event) => {
              setNicknameCheckStatus('idle');
              setNicknameRequiredError(false);
              setNickname(event.target.value);
            }}
            placeholder="2~20자로 입력해 주세요"
            minLength={2}
            maxLength={20}
            required
          />
          <button
            type="button"
            onClick={handleCheckNickname}
            disabled={nicknameCheckStatus === 'checking' || nickname.trim().length < 2}
            className="shrink-0 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {nicknameCheckStatus === 'checking' ? '확인 중...' : '중복확인'}
          </button>
        </div>
        {nicknameCheckStatus === 'available' && (
          <p className="mt-1.5 text-sm font-bold text-teal-700">사용 가능한 닉네임입니다.</p>
        )}
        {nicknameCheckStatus === 'duplicate' && (
          <p className="mt-1.5 text-sm font-bold text-red-600">이미 사용 중인 닉네임입니다.</p>
        )}
        {nicknameCheckStatus === 'error' && (
          <p className="mt-1.5 text-sm text-red-600">닉네임 확인에 실패했습니다. 다시 시도해 주세요.</p>
        )}
        {nicknameRequiredError && nicknameCheckStatus === 'idle' && (
          <p className="mt-1.5 text-sm font-bold text-red-600">닉네임 중복 확인을 먼저 진행해 주세요.</p>
        )}
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="ansim-button-primary mt-2 w-full py-3 disabled:opacity-60"
      >
        {isSubmitting ? '가입 중...' : '회원가입'}
      </button>
    </form>
  );
}
