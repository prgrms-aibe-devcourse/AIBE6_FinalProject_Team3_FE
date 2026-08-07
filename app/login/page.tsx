import { AlertCircle, Shield } from 'lucide-react';
import Link from 'next/link';
import { crossOriginAuth } from '../config/auth';
import { getGoogleLoginUrl, getKakaoLoginUrl } from '../services/auth';
import { NoticeBox } from '../ui/NoticeBox';
import { LoginFormClient } from './LoginFormClient';
import { SessionRecoverRetryButton } from './SessionRecoverRetryButton';
import { SocialLoginLinks } from './SocialLoginLinks';

const ERROR_MESSAGES: Record<string, string> = {
  oauth_login_failed: '로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
  session_expired: '로그인 세션을 확인할 수 없습니다. 다시 로그인해주세요.',
  // 세션이 실제로 만료된 게 아니라 서버/네트워크가 일시적으로 불안정했을 뿐인 경우
  // (proxy.ts/session-recover의 refresh 'unreachable') — "다시 로그인하세요"와 구분한다.
  session_unavailable: '일시적으로 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.',
  // 백엔드 OAuth2AuthenticationFailureHandler가 이제 CustomOAuth2UserService가 만드는 구체적인
  // 코드를 그대로 전달한다(예전엔 항상 oauth_login_failed로 뭉뚱그려졌음) - 이 세 코드에 맞는
  // 안내를 추가해야 그 구체성이 실제로 화면까지 전달된다. 백엔드 화이트리스트(OAuth2AuthenticationFailureHandler의
  // DOMAIN_SPECIFIC_ERROR_CODES)에 코드를 추가할 때는 항상 여기도 같이 갱신해야 한다 - 안 그러면
  // 화이트리스트는 통과하는데 이 테이블엔 없어 기본 문구로 떨어진다.
  account_blocked: '정지되었거나 이용할 수 없는 계정입니다. 고객센터에 문의해주세요.',
  email_conflict: '이미 사용 중인 이메일입니다. 이메일/비밀번호 로그인 등 다른 방법을 이용해주세요.',
  social_account_conflict: '이 계정에는 이미 다른 소셜 계정이 연동되어 있습니다. 고객센터에 문의해주세요.',
  // OAuth2AuthenticationSuccessHandler가 소셜 인증 자체는 성공했지만 그 이후 토큰 발급(Redis 장애 등)에
  // 실패했을 때 보내는 코드 - 이 코드가 없으면 사용자는 일반 문구만 보고 원인을 알 수 없다.
  token_issue_failed: '일시적으로 로그인 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.',
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string; next?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error, next } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? '로그인 중 문제가 발생했습니다.') : undefined;
  // session_unavailable(서버 일시 장애로 refresh를 못 해본 경우)만 재시도를 보여준다 —
  // refresh_token이 아직 남아있을 수 있으니, 로그인을 처음부터 다시 하는 대신 그 사이 서버가
  // 복구됐으면 세션을 그대로 이어가게 한다. next는 session-recover가 자체적으로 다시 검증
  // (sanitizeNextPath)하므로 여기서 추가 검증은 불필요하다.
  //
  // crossOriginAuth 배포에서는 /auth/session-recover(Route Handler)가 못 쓴다 - refresh_token
  // 쿠키가 백엔드 도메인에만 종속되어 프론트 자신에게 오는 요청에는 절대 안 붙으므로, 그 경로로
  // 재시도하면 항상 refreshToken이 비어 있는 것으로 처리돼 세션이 멀쩡해도 무조건 재로그인을
  // 강제한다(SessionRecoverRetryButton.tsx 참고) - 그 배포에서는 대신 브라우저가 직접
  // 크로스오리진으로 백엔드에 재확인하는 클라이언트 버튼을 쓴다.
  const showRetry = error === 'session_unavailable' && Boolean(next);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="ansim-card w-full max-w-sm p-8">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-600">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="mb-1 text-xl font-bold text-slate-950">알고계약 로그인</h1>
          <p className="text-sm text-slate-600">사회초년생과 대학생을 위한 부동산 계약 안전 도우미</p>
        </div>

        {errorMessage && (
          <NoticeBox icon={AlertCircle} iconClassName="text-red-500" className="mb-6 bg-red-50 text-red-600">
            {errorMessage}
            {showRetry && next && (
              <>
                {' '}
                {crossOriginAuth ? (
                  <SessionRecoverRetryButton next={next} />
                ) : (
                  <Link href={`/auth/session-recover?next=${encodeURIComponent(next)}`} className="font-bold underline">
                    다시 시도
                  </Link>
                )}
              </>
            )}
          </NoticeBox>
        )}

        <LoginFormClient next={next} />

        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          또는
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <SocialLoginLinks googleLoginUrl={getGoogleLoginUrl()} kakaoLoginUrl={getKakaoLoginUrl()} next={next} />

        <p className="mt-6 text-center text-sm text-slate-600">
          아직 계정이 없으신가요?{' '}
          <Link href="/signup" className="font-bold text-teal-700 hover:text-teal-800">
            이메일로 회원가입
          </Link>
        </p>

        <Link href="/" className="mt-6 block text-center text-xs text-slate-400 hover:text-slate-600">
          랜딩 페이지로 돌아가기
        </Link>
      </div>
    </div>
  );
}
