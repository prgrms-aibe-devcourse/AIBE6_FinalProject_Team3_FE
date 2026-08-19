import { Shield } from 'lucide-react';
import Link from 'next/link';
import { ForgotPasswordFormClient } from './ForgotPasswordFormClient';

export default function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="ansim-card w-full max-w-sm p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-1 text-xl font-bold text-slate-950">비밀번호 찾기</h1>
          <p className="text-sm text-slate-600">가입하신 이메일로 재설정 링크를 보내드려요</p>
        </div>

        <ForgotPasswordFormClient />

        <p className="mt-6 text-center text-sm text-slate-600">
          <Link href="/login" className="font-bold text-teal-700 hover:text-teal-800">
            로그인으로 돌아가기
          </Link>
        </p>
      </div>
    </div>
  );
}
