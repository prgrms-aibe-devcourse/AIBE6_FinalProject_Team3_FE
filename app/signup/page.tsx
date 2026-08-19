import { Shield } from 'lucide-react';
import Link from 'next/link';
import { getPasswordPolicy } from '../services/auth';
import { getNicknamePolicy } from '../services/user';
import { type NicknamePolicyDto, type PasswordPolicyDto } from '../types/api';
import { SignupFormClient } from './SignupFormClient';

// backend가 내려오지 않는 극히 드문 경우에만 쓰는 최후의 fallback이다 — 평소엔 항상
// getPasswordPolicy()가 실제 정책을 받아오므로, 이 값이 실제 정책과 어긋나도 서버가 최종
// 검증에서 걸러주니 이중 실패로 이어지지 않는다.
const FALLBACK_PASSWORD_POLICY: PasswordPolicyDto = {
  pattern: '(?=.*[A-Za-z])(?=.*\\d)[\\x21-\\x7E]{8,72}',
  message: '영문과 숫자를 포함한 8~72자의 영문/숫자/기호를 입력해 주세요. 공백은 사용할 수 없습니다.',
};

// FALLBACK_PASSWORD_POLICY와 같은 이유의 최후 fallback.
const FALLBACK_NICKNAME_POLICY: NicknamePolicyDto = {
  pattern: '[가-힣a-zA-Z0-9]{2,20}',
  message: '닉네임은 한글, 영문, 숫자로 2~20자여야 합니다.',
};

export default async function SignupPage() {
  let passwordPolicy = FALLBACK_PASSWORD_POLICY;
  try {
    passwordPolicy = await getPasswordPolicy();
  } catch {
    // 조회 실패해도 폴백 정책으로 폼은 계속 동작해야 한다.
  }

  let nicknamePolicy = FALLBACK_NICKNAME_POLICY;
  try {
    nicknamePolicy = await getNicknamePolicy();
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
          <h1 className="mb-1 text-xl font-bold text-slate-950">알고계약 회원가입</h1>
          <p className="text-sm text-slate-600">이메일로 가입하고 바로 시작해 보세요</p>
        </div>

        <SignupFormClient passwordPolicy={passwordPolicy} nicknamePolicy={nicknamePolicy} />

        <p className="mt-6 text-center text-sm text-slate-600">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="font-bold text-teal-700 hover:text-teal-800">
            로그인
          </Link>
        </p>

        <Link href="/" className="mt-6 block text-center text-xs text-slate-400 hover:text-slate-600">
          홈페이지로 돌아가기
        </Link>
      </div>
    </div>
  );
}
