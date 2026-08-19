import { Shield } from 'lucide-react';
import Link from 'next/link';
import { getPasswordPolicy } from '../services/auth';
import { type PasswordPolicyDto } from '../types/api';
import { ResetPasswordFormClient } from './ResetPasswordFormClient';

// SignupPage와 동일한 최후 fallback 정책 - getPasswordPolicy() 조회 실패 시에만 쓴다.
const FALLBACK_PASSWORD_POLICY: PasswordPolicyDto = {
  pattern: '(?=.*[A-Za-z])(?=.*\\d)[\\x21-\\x7E]{8,72}',
  message: '영문과 숫자를 포함한 8~72자의 영문/숫자/기호를 입력해 주세요. 공백은 사용할 수 없습니다.',
};

type ResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { token } = await searchParams;

  let passwordPolicy = FALLBACK_PASSWORD_POLICY;
  try {
    passwordPolicy = await getPasswordPolicy();
  } catch {
    // 조회 실패해도 폴백 정책으로 폼은 계속 동작해야 한다.
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="ansim-card w-full max-w-sm p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-1 text-xl font-bold text-slate-950">새 비밀번호 설정</h1>
          <p className="text-sm text-slate-600">새로 사용할 비밀번호를 입력해 주세요</p>
        </div>

        {token ? (
          <ResetPasswordFormClient token={token} passwordPolicy={passwordPolicy} />
        ) : (
          <p className="text-sm text-red-600">
            유효하지 않은 링크입니다. 비밀번호 찾기를 다시 요청해 주세요.
          </p>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/login" className="font-bold text-teal-700 hover:text-teal-800">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
