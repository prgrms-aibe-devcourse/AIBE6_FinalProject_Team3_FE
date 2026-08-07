'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { ApiError, isSessionInvalidErrorCode } from '../../../lib/api/http';
import { updatePassword } from '../../../services/auth';
import { type PasswordPolicyDto } from '../../../types/api';
import { Modal } from '../../../ui/Modal';

type PasswordUpdateFormClientProps = {
  hasPassword: boolean;
  passwordPolicy: PasswordPolicyDto;
};

export function PasswordUpdateFormClient({ hasPassword, passwordPolicy }: PasswordUpdateFormClientProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const confirmNewPasswordRef = useRef<HTMLInputElement>(null);

  const passwordMismatch = confirmNewPassword.length > 0 && newPassword !== confirmNewPassword;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;

    if (newPassword !== confirmNewPassword) {
      // Enter 키로 제출된 경우 브라우저의 암묵적 제출 처리가 포커스를 되돌려놓기 때문에,
      // 다음 tick으로 미뤄야 포커스 이동이 실제로 적용된다.
      setTimeout(() => confirmNewPasswordRef.current?.focus(), 0);
      return;
    }

    setIsSaving(true);
    setError(undefined);
    setSuccess(false);

    try {
      await updatePassword({ currentPassword: currentPassword || undefined, newPassword });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (submitError) {
      // requestJson()이 이제 브라우저 컨텍스트에서 401 → refresh → 원 요청 1회 재시도를 자동으로
      // 처리하므로(app/lib/api/http.ts 참고), 정상 케이스(refresh 성공)는 이 catch까지 401이 아예
      // 올라오지 않는다. 이 분기가 실제로 타는 건 refresh까지 실패한 경우뿐인데, 그중
      // 'rejected'(진짜 무효)는 requestJson()이 이미 /auth/session-recover로 페이지 이동시켜버려서
      // 이 컴포넌트 코드가 실행될 새도 없이 화면을 벗어난다. 그러니 여기 남는 건 사실상
      // 'unreachable'(네트워크 오류/백엔드 일시 장애, requestJson()이 강제 로그아웃하지 않고 원래
      // 에러에 sessionRefreshOutcome: 'unreachable' 표시만 남겨 그대로 던지는 경우)뿐이다 — 이때는
      // 세션이 진짜 무효인지 알 수 없으므로 재로그인 화면으로 보내지 않고 일반 에러로만 보여준다.
      // sessionRefreshOutcome이 없는 session-invalid 에러(예: 애초에 refresh를 안 붙이는 서버
      // 사이드 호출)는 여전히 재로그인으로 보낸다. AUTH_INVALID_CREDENTIALS(현재 비밀번호 오류)는
      // 이 케이스와 구분해 폼 에러로 유지한다.
      if (
        submitError instanceof ApiError &&
        isSessionInvalidErrorCode(submitError.body?.code) &&
        submitError.sessionRefreshOutcome !== 'unreachable'
      ) {
        router.push('/login?error=session_expired');
        return;
      }

      setError(
        submitError instanceof ApiError
          ? submitError.sessionRefreshOutcome === 'unreachable'
            ? '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : submitError.message
          : `비밀번호 ${hasPassword ? '변경' : '설정'}에 실패했습니다. 잠시 후 다시 시도해 주세요.`,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirm = () => {
    router.push('/mypage');
    router.refresh();
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4">
        {hasPassword && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">현재 비밀번호</span>
            <input
              className="ansim-input w-full"
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
        )}
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
            ref={confirmNewPasswordRef}
            className="ansim-input w-full"
            type="password"
            value={confirmNewPassword}
            onChange={(event) => setConfirmNewPassword(event.target.value)}
            placeholder="새 비밀번호를 다시 입력해 주세요"
            autoComplete="new-password"
            required
          />
          {passwordMismatch && <p className="mt-1 text-sm text-red-600">비밀번호가 일치하지 않습니다.</p>}
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={isSaving} className="ansim-button-primary w-full py-3 disabled:opacity-60">
          {isSaving ? `${hasPassword ? '변경' : '설정'} 중...` : `비밀번호 ${hasPassword ? '변경' : '설정'}`}
        </button>
      </form>

      <Modal open={success} onClose={() => setSuccess(false)}>
        <p className="mb-4 text-sm font-bold text-teal-700">
          비밀번호가 {hasPassword ? '변경' : '설정'}되었습니다.
        </p>
        <button type="button" onClick={handleConfirm} className="ansim-button-primary w-full py-3">
          확인
        </button>
      </Modal>
    </>
  );
}
