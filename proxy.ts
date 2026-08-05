import { NextRequest, NextResponse } from 'next/server';
import { crossOriginAuth } from './app/config/auth';
import { useMockData } from './app/config/dataSource';
import { CURRENT_PATH_HEADER, mergeCookieHeader, refreshSession } from './app/lib/api/http';

const ACCESS_TOKEN_COOKIE = 'access_token';
const REFRESH_TOKEN_COOKIE = 'refresh_token';

// access_token 쿠키는 httpOnly라 여기서 값을 읽어 검증할 순 없지만, 존재 여부는 확인할 수 있다.
// 실제 유효성 검증(서명/만료)은 백엔드가 각 API 호출마다 수행하므로, 여기서는
// "로그인 안 한 사용자를 로그인 화면으로 안내"하는 UX 목적의 가벼운 체크로 충분하다.
export async function proxy(request: NextRequest) {
  // 이 요청이 통과되는 모든 경로(mock 모드, 쿠키 존재, refresh 성공)에서 공통으로 심어준다 —
  // (main)/layout.tsx가 access_token은 있지만 무효인 경우 세션 복구 후 원래 경로로 돌아가려면
  // 자기 자신의 경로를 알아야 하는데, Server Component는 그걸 직접 알 방법이 없다.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CURRENT_PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);

  // mock 모드는 백엔드가 없어도 화면을 확인할 수 있어야 하므로 로그인 게이트를 건너뛴다.
  if (useMockData) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // 프론트/백엔드가 도메인을 공유하지 않는 배포(crossOriginAuth)에서는 이 미들웨어가 애초에
  // access_token/refresh_token 쿠키를 받을 수 없다 — 브라우저가 발급 도메인(백엔드)에만 그
  // 쿠키를 붙이기 때문이다. 여기서 "쿠키 없음"을 "로그인 안 됨"으로 오판해 매번 로그인 화면으로
  // 튕기지 않도록, 로그인 판정 자체를 브라우저 쪽 크로스오리진 fetch로 넘긴다
  // ((main)/MainLayoutGate.tsx 참고).
  if (crossOriginAuth) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (request.cookies.has(ACCESS_TOKEN_COOKIE)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // access_token은 Max-Age가 지나면 브라우저가 알아서 지우므로, 쿠키가 없다는 사실만으로는
  // "로그인한 적 없음"과 "Access Token만 만료됨"을 구분할 수 없다. refresh_token이 남아있다면
  // 여기서 재발급을 시도해, 세션이 아직 유효한 사용자를 로그인 화면으로 돌려보내지 않는다.
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  let refreshOutcomeStatus: 'rejected' | 'unreachable' | undefined;
  if (refreshToken) {
    const outcome = await refreshSession(refreshToken);
    if (outcome.status === 'success') {
      // Set-Cookie는 브라우저의 "다음" 요청부터만 적용된다. 지금 이 요청에 이어지는
      // 서버 컴포넌트(layout 등)가 cookies()로 읽는 건 여전히 원래 요청 헤더라서, 갱신된
      // 토큰을 요청 헤더에도 반영해줘야 이번 요청에서 바로 로그인 화면으로 튕기지 않는다.
      requestHeaders.set('cookie', mergeCookieHeader(requestHeaders.get('cookie'), outcome.cookies));

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      outcome.cookies.forEach((cookie) => response.headers.append('Set-Cookie', cookie));
      return response;
    }
    // 'rejected'(DB 초기화 등으로 백엔드가 이 토큰을 실제로 거부함)와 'unreachable'(네트워크 오류
    // 등으로 토큰 상태를 아예 확인 못 함)을 구분한다 — 후자까지 무효 토큰 취급해 쿠키를 지우면,
    // 백엔드가 잠깐 응답 안 했을 뿐인 멀쩡한 세션까지 로그아웃시켜버린다.
    refreshOutcomeStatus = outcome.status;
  }

  // refreshToken이 있었는데 실제로 거부당했다면(DB 초기화 등으로 더 이상 유효하지 않은 경우) 그
  // 쿠키를 지우지 않으면 브라우저가 계속 들고 있다가 보호 페이지에 접근할 때마다 이 흐름을 반복해
  // 백엔드에 매번 "유효하지 않은 Refresh Token입니다" 요청을 만든다.
  //
  // 'unreachable'인 경우 access token 쿠키는 이미 없고(이 분기에 들어온 이유), refresh_token
  // 상태도 확인하지 못했다는 뜻이라 사용자를 계속 페이지에 둘 방법이 없다 — 하지만 "로그인 정보가
  // 틀렸다"는 문구는 부정확하므로 별도 쿼리(session_unavailable)로 구분해, 로그인 화면이 "다시
  // 로그인하세요"가 아니라 "잠시 후 다시 시도하세요"를 보여주게 한다.
  //
  // next는 세 경우 모두 똑같이 넘긴다 — 로그인 폼/OAuth가 성공 후 이 값으로 복귀하므로
  // (LoginFormClient.tsx, oauth/callback/page.tsx 참고), next가 없으면 재로그인해도 항상
  // 홈으로만 떨어진다.
  //
  // 에러 문구는 세 가지로 구분한다 — refreshToken 자체가 없었던 경우(애초에 로그인한 적 없음)는
  // 굳이 놀랄 문구를 보여줄 필요가 없어 에러 없이 로그인 폼만 보여주지만, 'rejected'(로그인은
  // 했었는데 세션이 실제로 끊긴 경우 — 다른 곳에서 로그아웃, DB 초기화 등)는 session-recover와
  // 동일하게 "다시 로그인해주세요" 문구를 보여줘야 한다. 이걸 안 보여주면 방금까지 로그인돼
  // 있던 사용자가 아무 설명 없이 빈 로그인 화면을 보게 된다.
  const currentPath = request.nextUrl.pathname + request.nextUrl.search;
  const errorParam =
    refreshOutcomeStatus === 'unreachable'
      ? 'session_unavailable'
      : refreshOutcomeStatus === 'rejected'
        ? 'session_expired'
        : undefined;
  const loginPath = `/login?${errorParam ? `error=${errorParam}&` : ''}next=${encodeURIComponent(currentPath)}`;
  const response = NextResponse.redirect(new URL(loginPath, request.url));
  // session-recover/route.ts와 동일한 조건('unreachable'이 아니면 삭제) — 이 분기는 이미
  // access_token 쿠키가 없다고 확인된 뒤라(23번째 줄) 실제로는 rejected/undefined 어느 쪽이든
  // 지울 게 없는 no-op이지만, 조건을 두 파일에서 다르게 두면 나중에 위 가드가 바뀔 때 조용히
  // 어긋날 수 있어 표현을 맞춰둔다.
  if (refreshOutcomeStatus !== 'unreachable') {
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
  }
  return response;
}

export const config = {
  matcher: [
    '/home/:path*',
    '/properties/:path*',
    '/checklist/:path*',
    '/checklists/:path*',
    '/contract/:path*',
    '/mypage/:path*',
    '/admin/:path*',
  ],
};
