'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { ApiError } from '../../lib/api/http';
import { sanitizeNextPath } from '../../lib/nextPath';
import { hasRegisteredProfile } from '../../lib/profile';
import { getCurrentUser } from '../../services/auth';
import { getMyProfile } from '../../services/user';

const OAUTH_NEXT_COOKIE = 'oauth_next';

// oauth_next는 SocialLoginLinks.tsx가 OAuth 제공자로 넘어가기 직전 document.cookie로 남겨둔,
// httpOnly가 아닌 프론트(Vercel) 자체 쿠키다 - access/refresh 토큰과 달리 백엔드가 발급하는
// 게 아니라 브라우저에서만 쓰고 버리므로, crossOriginAuth 여부와 무관하게 항상 여기서 직접
//읽고 지울 수 있다.
function consumeOAuthNextCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${OAUTH_NEXT_COOKIE}=([^;]*)`));
  document.cookie = `${OAUTH_NEXT_COOKIE}=; path=/; max-age=0; samesite=lax`;
  return match ? decodeURIComponent(match[1]) : null;
}

function OAuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // 로그인 화면(SocialLoginLinks)이 구글/카카오로 넘어가기 직전에 남겨둔 원래 경로 — OAuth는
    // 제공자로 리다이렉트됐다 돌아오는 왕복이라 쿼리스트링으로 next를 들고 다닐 방법이 없어서 대신
    // 쿠키를 쓴다. 실패/성공 어느 분기로 끝나든 한 번 쓰고 나면 지워서 다음 로그인 시도에 잘못
    // 재사용되지 않게 한다.
    const rawNext = consumeOAuthNextCookie();
    const next = sanitizeNextPath(rawNext);

    const error = searchParams.get('error');
    if (error) {
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('error', error);
      // 실패해도 next는 살려서 로그인 화면(이메일 로그인/다른 소셜 로그인)이 여전히 원래 경로로
      // 복귀할 수 있게 한다 — rawNext가 있을 때만 붙여서, 애초에 next 없이 시작한 로그인 실패에는
      // 쓸데없이 /home을 next로 얹지 않는다.
      if (rawNext) {
        loginUrl.searchParams.set('next', next);
      }
      router.replace(`${loginUrl.pathname}${loginUrl.search}`);
      return;
    }

    const notice = searchParams.get('notice');

    async function finish() {
      // 백엔드(EC2)가 소셜 로그인 성공 시 발급한 access/refresh 쿠키는 EC2 도메인에만 종속되므로,
      // 이 페이지(Vercel) 서버가 아니라 브라우저가 직접 credentials:'include'로 확인해야 한다.
      try {
        await getCurrentUser();
      } catch (error) {
        // MainLayoutGate/admin-layout과 동일한 이유로 콘솔에 원인을 남긴다 - 이 콜백은 방금
        // OAuth를 마치고 돌아온 첫 진입점이라, CORS/쿠키 설정이 미묘하게 틀렸을 때 원인 진단이
        // 가장 필요한 지점인데 정작 아무 로그도 없이 "다시 로그인하세요"만 보이면 안 된다.
        console.error('OAuth callback: failed to confirm session', error);
        // 'unreachable'(네트워크 오류 등으로 refresh 자체를 시도 못한 경우)과 세션이 실제로
        // 무효인 경우를 구분해서 보내야, 배포 초기 CORS/쿠키 설정 오류를 "로그인 정보가
        // 만료됐다"는 잘못된 안내로 덮지 않는다.
        const errorParam =
          error instanceof ApiError && error.sessionRefreshOutcome === 'unreachable'
            ? 'session_unavailable'
            : 'session_expired';
        const loginUrl = new URL('/login', window.location.origin);
        loginUrl.searchParams.set('error', errorParam);
        // 위 error 분기와 동일한 이유로 next를 살려둔다 — rawNext가 있을 때만 붙여서, 애초에
        // next 없이 시작한 로그인 시도에 쓸데없이 /home을 next로 얹지 않는다.
        if (rawNext) {
          loginUrl.searchParams.set('next', next);
        }
        router.replace(`${loginUrl.pathname}${loginUrl.search}`);
        return;
      }

      try {
        const profile = await getMyProfile();
        if (!hasRegisteredProfile(profile)) {
          router.replace('/mypage/profile');
          return;
        }
      } catch (error) {
        // 프로필 조회에 실패해도 로그인 자체는 성공했으므로 destination(next 또는 홈)으로
        // 보낸다 - 다만 원인 진단을 위해 콘솔에는 남긴다.
        console.error('OAuth callback: failed to load profile', error);
      }

      // notice=account_linked: 새 계정이 아니라 이미 있던 계정(로컬 가입 또는 다른 소셜)에 방금
      // 연동된 로그인이라는 신호 — 홈 화면이 이 값을 보고 안내 배너를 한 번 띄운다. 백엔드가 보낸
      // 값이라도 이 콜백 자체는 외부에서 접근 가능한 진입점이므로, 허용된 값인지 검증한 뒤에만
      // 그대로 전달한다.
      const destinationUrl = new URL(next, window.location.origin);
      if (notice === 'account_linked') {
        destinationUrl.searchParams.set('notice', notice);
      }
      router.replace(`${destinationUrl.pathname}${destinationUrl.search}`);
    }

    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <OAuthCallbackContent />
    </Suspense>
  );
}
