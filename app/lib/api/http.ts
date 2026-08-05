import { type ApiErrorBody, type ApiResponse } from '../../types/api';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

const REFRESH_TOKEN_COOKIE = 'refresh_token';
const REFRESH_PATH = '/auth/refresh';

// Server Component(예: (main)/layout.tsx)는 자기 자신의 현재 경로를 알 방법이 없다 —
// usePathname()은 클라이언트 컴포넌트 전용이고, 서버 컴포넌트용 공식 대안이 없다. proxy.ts가
// 미들웨어 단계에서 이 값을 요청 헤더로 심어두면, 다운스트림 Server Component가 headers()로 읽을
// 수 있다 — 세션 복구 후 원래 있던 경로로 돌아가야 할 때(app/auth/session-recover/route.ts) 씀.
export const CURRENT_PATH_HEADER = 'x-current-path';

// 백엔드가 access token 인증 실패를 401로 내려줄 때 쓰는 코드들. 전부 "지금 로그인 상태가 아니니
// 다시 로그인해야 한다"는 같은 의미라, 화면에 보여줄 문구는 하나로 통일하되(의도적 선택 —
// docs/specs/auth-design.md 참고) 재로그인으로 보낼지 판단하는 코드 분기에서는 넷 다 인식해야 한다.
// UNAUTHORIZED는 하위 호환(백엔드가 아직 세분화 전이거나, /auth/me의 탈퇴 유저 체크처럼 컨트롤러
// 레벨에서 직접 이 코드를 쓰는 경우)을 위해 남겨둔다.
const SESSION_INVALID_ERROR_CODES = new Set([
  'UNAUTHORIZED',
  'AUTH_TOKEN_MISSING',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_EXPIRED',
]);

export function isSessionInvalidErrorCode(code: string | null | undefined): boolean {
  return code != null && SESSION_INVALID_ERROR_CODES.has(code);
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: ApiErrorBody | null,
    // requestJson()이 브라우저에서 refresh를 시도했지만 네트워크 오류/서버 일시 장애로 결과를 알 수
    // 없었던 경우에만 'unreachable'을 채운다 — 호출부(예: PasswordUpdateFormClient)가 "세션이 확실히
    // 무효"와 "일시 장애라 판단 불가"를 구분해서, 후자는 강제 로그아웃시키지 않게 하기 위함이다.
    public readonly sessionRefreshOutcome?: 'unreachable',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new ApiError('NEXT_PUBLIC_API_BASE_URL is required when mock data is disabled.', 0);
  }

  return API_BASE_URL;
}

const NETWORK_ERROR_MESSAGE = '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.';

// requestJson()의 fetch() 자체가 실패하면(백엔드가 완전히 다운됐거나 네트워크가 끊긴 경우) 원래는
// raw TypeError가 그대로 올라가 호출부마다 ApiError만 잡는 catch를 빠져나가곤 했다 — 그 결과
// 로그인/회원가입/프로필 저장 등에서 "실패했습니다"류의 일반 문구만 보이고, refresh unreachable
// 때 쓰는 "서버와 통신할 수 없습니다"와 톤이 달라졌다. 같은 원인(서버 연결 불가)이면 항상 같은
// ApiError(NETWORK_ERROR, status 0)로 정규화해 호출부가 하나의 catch로 처리할 수 있게 한다.
async function fetchOrThrowNetworkError(path: string, init: RequestInit): Promise<Response> {
  // getApiBaseUrl()은 try 밖에서 호출한다 — NEXT_PUBLIC_API_BASE_URL 누락은 네트워크 오류가 아니라
  // 환경 설정 오류라, 같은 catch에 걸려 NETWORK_ERROR로 덮이면 dev/CI에서 원인 진단이 어려워진다.
  const url = `${getApiBaseUrl()}${path}`;
  try {
    return await fetch(url, init);
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0, { code: 'NETWORK_ERROR', message: NETWORK_ERROR_MESSAGE });
  }
}

// 예전엔 여기서 자체 refresh를 시도했지만(retryAfterRefresh), 회전된 새 access/refresh 토큰이
// 실제 브라우저 쿠키에 반영되지 않아 브라우저가 이미 무효화된 옛 토큰을 계속 들고 있다가 다음
// refresh 시점에 세션이 끊기는 문제가 있어 제거했었다. 이 함수는 Server Component와 클라이언트
// 컴포넌트 양쪽에서 호출되는데, Server Component 호출 시엔 이 refresh 응답이 서버-서버 통신
// 결과일 뿐이라 그 Set-Cookie를 실제 브라우저 응답에 반영하려면 호출부가 명시적으로 헤더를
// 복사해 자기 응답에 실어야 한다 — requestJson은 임의의 호출 깊이에서 쓰이므로 그 반영을 보장할
// 방법이 없다(retryAfterRefresh를 없앤 진짜 이유). 그런데 이건 httpOnly라서 원천적으로 불가능한
// 게 아니라 Node 런타임의 서버 사이드 fetch라 브라우저 쿠키 저장소를 못 쓰기 때문이었다 — 순수
// 브라우저 fetch(credentials:'include')라면 Set-Cookie를 브라우저가 알아서 반영하므로 이 문제가
// 애초에 없다. 그래서 브라우저 컨텍스트(typeof window !== 'undefined')에서만 자동
// refresh-then-retry를 켠다 — Server Component 쪽 동작은 그대로 유지된다(401을 즉시 던져서
// layout.tsx가 session-recover로 보내는 기존 흐름 그대로).
export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = normalizeHeaders(init?.headers, init?.body instanceof FormData);
  const requestStartedAt = typeof window !== 'undefined' ? Date.now() : 0;
  const response = await fetchOrThrowNetworkError(path, { ...init, credentials: 'include', headers });
  const body = await readApiResponse<T>(response);

  const shouldTryRefresh =
    !response.ok &&
    response.status === 401 &&
    isSessionInvalidErrorCode(body.error?.code) &&
    typeof window !== 'undefined' &&
    path !== REFRESH_PATH;

  if (shouldTryRefresh) {
    // 이 요청이 나간 "이후"에 이미 성공한 refresh가 있다면, 그 401은 우리 요청이 낡은(만료된)
    // access token을 들고 나갔을 때 생긴 것일 뿐이다 — 브라우저는 이미 새 쿠키를 갖고 있으니
    // refresh를 또 시작할 필요 없이 바로 재시도만 하면 된다. (동시에 나간 A/B 요청 중 A가 refresh를
    // 끝낸 뒤에야 B의 401이 뒤늦게 도착하는 경우 — 안 그러면 이미 성공한 refresh 직후에 불필요한
    // 재-rotate가 한 번 더 일어난다.)
    if (requestStartedAt < lastRefreshSucceededAt) {
      const retryResponse = await fetchOrThrowNetworkError(path, { ...init, credentials: 'include', headers });
      return finalizeResponse<T>(retryResponse, await readApiResponse<T>(retryResponse));
    }

    const outcome = await refreshOnceInBrowser();

    if (outcome === 'success') {
      const retryResponse = await fetchOrThrowNetworkError(path, { ...init, credentials: 'include', headers });
      return finalizeResponse<T>(retryResponse, await readApiResponse<T>(retryResponse));
    }

    // 'rejected'는 백엔드가 이 세션을 확실히 무효로 판단한 경우다 — access/refresh 쿠키는 httpOnly라
    // 여기서 직접 지울 수 없으므로(서버 응답으로만 Set-Cookie 삭제 가능), 이미 그 정리를 하는
    // /auth/session-recover로 전체 페이지 이동시켜 위임한다(쿠키 삭제 로직을 두 곳에 중복시키지
    // 않기 위함). 'unreachable'(네트워크 오류, 5xx 등 refresh 자체가 성공/실패 어느 쪽인지 알 수
    // 없는 경우)은 세션이 실제로 무효인지 알 수 없으므로 강제 로그아웃시키지 않고 원래 401을 그대로
    // 던지되, sessionRefreshOutcome 표시를 남겨 호출부가 "확정된 세션 만료"와 구분할 수 있게 한다.
    if (outcome === 'rejected') {
      redirectToSessionRecover();
      return new Promise<T>(() => {}); // 페이지 이동이 끝날 때까지 아무 것도 하지 않고 대기
    }

    return finalizeResponse<T>(response, body, 'unreachable');
  }

  return finalizeResponse<T>(response, body);
}

// 브라우저 탭 안에서 동시에 여러 컴포넌트가 401을 만나도 실제 POST /auth/refresh는 한 번만 나가야
// 한다 — Refresh Token이 매번 회전(rotate)되고 유저당 1세션만 유지되는 구조라(docs/specs/auth-design.md
// 참고), 동시에 두 번 부르면 두 번째 호출은 첫 번째가 이미 회전시켜버린 옛 refresh token으로
// 실패한다. 진행 중인 refresh가 있으면 그 Promise를 그대로 공유해서 중복 호출을 막는다.
type BrowserRefreshOutcome = 'success' | 'rejected' | 'unreachable';

let refreshInFlight: Promise<BrowserRefreshOutcome> | null = null;
let lastRefreshSucceededAt = 0;

function refreshOnceInBrowser(): Promise<BrowserRefreshOutcome> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${getApiBaseUrl()}${REFRESH_PATH}`, {
      method: 'POST',
      credentials: 'include',
      // 백엔드 CsrfHeaderFilter가 상태 변경 요청에 요구하는 헤더 - requestJson()을 거치지 않는
      // raw fetch라 normalizeHeaders()의 자동 부착을 못 받으므로 직접 붙인다.
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    })
      .then((response): BrowserRefreshOutcome => {
        if (response.ok) {
          lastRefreshSucceededAt = Date.now();
          return 'success';
        }
        // 401만 "백엔드가 실제로 이 refresh token을 거부했다"는 확정 신호다. 5xx/429 등은 refresh
        // 엔드포인트 자체의 일시 장애일 수 있어(auth-design.md 기준 실패는 항상 401로 응답하도록
        // 되어 있음), 그런 경우까지 rejected로 묶으면 서버가 잠깐 이상했을 뿐인데 강제 로그아웃되는
        // 것처럼 보인다.
        return response.status === 401 ? 'rejected' : 'unreachable';
      })
      .catch((): BrowserRefreshOutcome => 'unreachable')
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

// session-recover는 이미 refresh 실패 시 access/refresh 쿠키를 지우고 /login으로 보내는 로직을
// 갖고 있다(app/auth/session-recover/route.ts) — 여기서 같은 로직을 다시 구현하는 대신 그쪽으로
// 넘겨서 쿠키 삭제 규칙이 한 곳에만 존재하도록 한다.
function redirectToSessionRecover() {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/auth/session-recover?next=${next}`;
}

// HeadersInit은 plain object/배열/Headers 인스턴스 중 뭐든 될 수 있는데, {...init?.headers}로
// 스프레드하면 Headers 인스턴스나 배열은 조용히 빈 객체가 되어 헤더가 통째로 사라진다.
// new Headers(...)로 정규화해야 어떤 형태로 들어와도 안전하게 병합/조회할 수 있다.
function normalizeHeaders(initHeaders?: HeadersInit, isFormData = false): Headers {
  const headers = new Headers(initHeaders);
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  // FormData 바디는 브라우저가 multipart boundary까지 포함해 Content-Type을 직접 설정해야 하므로
  // 여기서 미리 값을 넣으면 안 된다(넣으면 boundary 없는 잘못된 헤더로 덮어써져 요청이 깨진다).
  if (!isFormData && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  // 백엔드 CsrfHeaderFilter가 상태 변경 요청(POST/PUT/PATCH/DELETE)에 요구하는 최소 CSRF 방어용
  // 헤더 - SameSite=None 배포에서는 크로스사이트 요청에도 쿠키가 실리므로, 순수 HTML 폼은 붙일 수
  // 없는 이 커스텀 헤더로 "진짜 이 프론트가 보낸 요청"임을 구분한다. GET에도 붙여도 무해하다.
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest');
  }
  return headers;
}

// 브라우저에서 refresh-then-retry까지 실패한 뒤에도(또는 재시도 대상이 아닌 요청이라면) 여전히
// 401이 그대로 던져진다 — `PasswordUpdateFormClient`처럼 `isSessionInvalidErrorCode(error.code)`로
// 감지해 `/login?error=session_expired`로 보내는 컴포넌트 레벨 fallback은 계속 필요하다(예:
// refresh_token 자체가 이미 없거나 만료된 경우).
function finalizeResponse<T>(
  response: Response,
  body: ApiResponse<T>,
  sessionRefreshOutcome?: 'unreachable',
): T {
  if (!response.ok) {
    throw new ApiError(
      body.error?.message ?? `API request failed: ${response.status}`,
      response.status,
      body.error,
      sessionRefreshOutcome,
    );
  }

  if (!body.success) {
    throw new ApiError(body.error?.message ?? 'API request failed.', response.status, body.error, sessionRefreshOutcome);
  }

  return body.data;
}

// 'rejected'는 백엔드가 실제로 응답해서 이 Refresh Token을 거부한 경우(만료/무효 등)이고,
// 'unreachable'은 요청 자체가 실패해(네트워크 오류, 백엔드 일시 다운 등) 토큰 상태를 알 수 없는
// 경우다 — 호출부가 "무효 토큰이니 쿠키를 지워도 된다"와 "일시 장애라 쿠키는 그대로 둬야 한다"를
// 구분하려면 이 둘을 뭉뚱그리면 안 된다.
export type RefreshSessionOutcome =
  | { status: 'success'; cookies: string[] }
  | { status: 'rejected' }
  | { status: 'unreachable' };

/**
 * Access Token 쿠키가 만료(브라우저가 자동 삭제)된 상태에서 Refresh Token으로 세션을 갱신한다.
 * 백엔드는 응답 바디 대신 Set-Cookie 헤더로 새 access_token/refresh_token을 내려주므로,
 * requestJson(바디만 반환) 대신 raw fetch로 응답 헤더를 그대로 반환한다 — 호출부(middleware)가
 * 이 값을 그대로 브라우저 응답에 실어 보내야 실제로 반영된다.
 */
export async function refreshSession(refreshTokenCookieValue: string): Promise<RefreshSessionOutcome> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${REFRESH_PATH}`, {
      method: 'POST',
      // 백엔드 CsrfHeaderFilter가 상태 변경 요청에 요구하는 헤더 - 이건 서버(Next.js)가 실제 쿠키
      // 값을 들고 직접 호출하는 신뢰된 서버-서버 통신이라 CSRF 공격 대상이 아니지만, 필터는 호출
      // 주체를 구분하지 않고 헤더 존재 여부만 보므로 똑같이 붙여야 통과한다.
      headers: { Cookie: `${REFRESH_TOKEN_COOKIE}=${refreshTokenCookieValue}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
  } catch {
    return { status: 'unreachable' };
  }

  if (!response.ok) {
    // 401만 "refresh token을 확실히 거부함"이다 — 5xx/429 등 백엔드 일시 장애까지 rejected로
    // 묶으면 proxy.ts/session-recover가 멀쩡한 세션의 쿠키를 지워버릴 수 있다(auth-design.md 기준
    // refresh 실패는 항상 401로 응답하도록 되어 있음).
    return response.status === 401 ? { status: 'rejected' } : { status: 'unreachable' };
  }

  // 미들웨어/Node 런타임에서는 지원되지만, 런타임에 따라 없을 수 있으니 안전하게 호출한다.
  const setCookies = response.headers.getSetCookie?.() ?? [];
  return setCookies.length > 0 ? { status: 'success', cookies: setCookies } : { status: 'rejected' };
}

// Set-Cookie 문자열 배열("access_token=xxx; Path=/; HttpOnly; ...")에서 name=value 쌍만 뽑아,
// 기존 Cookie 헤더에 병합한다(같은 이름이면 새 값으로 덮어씀).
export function mergeCookieHeader(existingCookieHeader: string | null | undefined, newSetCookies: string[]): string {
  const cookies = new Map<string, string>();

  for (const pair of existingCookieHeader?.split(';') ?? []) {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex > 0) {
      cookies.set(pair.slice(0, separatorIndex).trim(), pair.slice(separatorIndex + 1).trim());
    }
  }

  for (const setCookie of newSetCookies) {
    const pair = setCookie.split(';')[0] ?? '';
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex > 0) {
      cookies.set(pair.slice(0, separatorIndex).trim(), pair.slice(separatorIndex + 1).trim());
    }
  }

  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function readApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  try {
    return (await response.json()) as ApiResponse<T>;
  } catch {
    return {
      success: false,
      data: undefined as T,
      error: {
        code: 'INVALID_RESPONSE',
        message: 'API response is not valid JSON.',
      },
    };
  }
}
