import { NextRequest, NextResponse } from 'next/server';
import { refreshSession } from '../../lib/api/http';
import { sanitizeNextPath } from '../../lib/nextPath';

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const ACCESS_TOKEN_COOKIE = 'access_token';

// (main)/layout.tsx가 GET /auth/me에서 401을 받았을 때 곧장 /login으로 보내는 대신 여기로 온다 —
// access_token 쿠키가 있어도 무효(로그아웃으로 블랙리스트에 오름 등)일 수 있는데, refresh_token은
// 아직 살아있을 수 있어서다. Server Component(layout.tsx)는 쿠키를 쓸 수 없으므로, 실제로 refresh를
// 시도하고 그 결과 쿠키를 Set-Cookie로 반영하는 건 Route Handler인 여기서만 할 수 있다.
export async function GET(request: NextRequest) {
  const next = sanitizeNextPath(request.nextUrl.searchParams.get('next'));
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

  let refreshOutcomeStatus: 'rejected' | 'unreachable' | undefined;
  if (refreshToken) {
    const outcome = await refreshSession(refreshToken);
    if (outcome.status === 'success') {
      const response = NextResponse.redirect(new URL(next, request.url));
      outcome.cookies.forEach((cookie) => response.headers.append('Set-Cookie', cookie));
      return response;
    }
    // proxy.ts와 동일한 구분 — 'rejected'(진짜 무효)일 때만 쿠키를 지운다. 'unreachable'(네트워크
    // 오류 등)까지 지우면 백엔드가 잠깐 응답 안 했을 뿐인 멀쩡한 세션까지 로그아웃시켜버린다.
    refreshOutcomeStatus = outcome.status;
  }

  // 여기서 쿠키를 지우지 않으면 proxy.ts가 (무효해진) access_token 쿠키의 "존재 여부"만 보고
  // 통과시켜서, 다음 방문 때마다 이 세션 복구 흐름을 헛되이 반복하게 된다.
  //
  // 'unreachable'이면 세션이 실제로 만료된 게 아니라 백엔드/네트워크가 잠깐 불안정했을 뿐일 수
  // 있으므로, "다시 로그인하세요"(session_expired) 대신 "잠시 후 다시 시도하세요"(session_unavailable)
  // 문구로 구분한다. refreshToken 자체가 아예 없었던 경우(진짜 세션 없음)는 여전히 session_expired.
  //
  // next는 두 경우 모두 넘긴다 — unreachable이면 "다시 시도" 링크가 이 경로로 다시
  // /auth/session-recover를 태우는 데 쓰고, session_expired(진짜 재로그인이 필요한, 더 흔한 경우)면
  // 로그인 폼/OAuth가 성공 후 이 값으로 복귀하는 데 쓴다(LoginFormClient.tsx,
  // oauth/callback/page.tsx 참고) — 여기서 안 넘기면 재로그인해도 항상 홈으로만 떨어진다.
  const loginPath =
    refreshOutcomeStatus === 'unreachable'
      ? `/login?error=session_unavailable&next=${encodeURIComponent(next)}`
      : `/login?error=session_expired&next=${encodeURIComponent(next)}`;
  const response = NextResponse.redirect(new URL(loginPath, request.url));
  // 여기 온 것 자체가 이미 layout.tsx의 /auth/me 실패로 access_token이 무효라고 확인된 뒤다 —
  // 'unreachable'(백엔드/네트워크가 잠깐 불안정했을 뿐, 무효 여부를 확인 못 한 경우)이 아니라면
  // access_token은 항상 지운다. 안 지우면 proxy.ts가 이 쿠키의 "존재 여부"만 보고 통과시켜
  // layout.tsx → session-recover → login으로 오는 이 흐름이 매번 헛되이 반복된다. refresh_token은
  // 애초에 없었을 수도 있지만(refreshToken이 falsy인 경우), 그럴 땐 지우는 게 no-op이라 안전하다.
  if (refreshOutcomeStatus !== 'unreachable') {
    response.cookies.delete(ACCESS_TOKEN_COOKIE);
    response.cookies.delete(REFRESH_TOKEN_COOKIE);
  }
  return response;
}
