import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 회귀/커버리지 보강 테스트 - services/auth.ts는 지금까지 모든 테스트에서 vi.mock으로 완전히
// 대체돼왔다(app/lib/api/http.ts를 실제로 호출하는지, 그 응답을 올바르게 파싱하는지 검증하는
// 테스트가 하나도 없었다 - cross-domain-summary.md 전수조사 결과 테스트 코드 품질 참고). 여기서는
// http.ts를 mock하지 않고 실제 fetch만 stub해서, services/auth.ts가 만드는 요청 경로/메서드/바디와
// 응답 파싱이 실제로 맞물려 동작하는지 확인한다.
describe('services/auth.ts (http.ts 연결)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8080';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    vi.unstubAllGlobals();
  });

  it('getCurrentUser()가 GET /auth/me를 호출하고 성공 응답의 data를 그대로 반환한다', async () => {
    const meResponse = {
      userId: 1,
      email: 'user@example.com',
      nickname: '유저',
      profileImageUrl: null,
      role: 'USER',
    };
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      expect(String(url)).toBe('http://localhost:8080/auth/me');
      expect(init?.credentials).toBe('include');
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: meResponse }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { getCurrentUser } = await import('./auth');
    const result = await getCurrentUser();

    expect(result).toEqual(meResponse);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('getCurrentUser()가 실패 응답을 받으면 ApiError로 던진다(코드/메시지 보존)', async () => {
    // 401 + 세션무효 코드(AUTH_TOKEN_*)는 requestJson이 브라우저 refresh-then-retry/session-recover
    // 흐름을 타서(shouldTryRefresh) 이 테스트가 검증하려는 "실패를 ApiError로 던진다"와 무관한
    // 리다이렉트 경로로 빠진다 - 세션 무효 코드가 아닌 4xx로 그 분기를 건드리지 않는다.
    const fetchMock = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ success: false, error: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' } }), {
          status: 404,
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getCurrentUser } = await import('./auth');
    const { ApiError } = await import('../lib/api/http');

    await expect(getCurrentUser()).rejects.toMatchObject(
      expect.objectContaining({ name: 'ApiError', status: 404, body: { code: 'USER_NOT_FOUND', message: '사용자를 찾을 수 없습니다.' } }),
    );
    await expect(getCurrentUser()).rejects.toBeInstanceOf(ApiError);
  });

  it('login()이 POST /auth/login으로 JSON 바디를 실어 보낸다', async () => {
    const meResponse = { userId: 2, email: 'a@b.com', nickname: '닉네임', profileImageUrl: null, role: 'USER' };
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      expect(String(url)).toBe('http://localhost:8080/auth/login');
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'a@b.com', password: 'pw12345678' });
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: meResponse }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { login } = await import('./auth');
    const result = await login({ email: 'a@b.com', password: 'pw12345678' });

    expect(result).toEqual(meResponse);
  });

  it('logout()이 POST /auth/logout을 호출한다', async () => {
    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      expect(String(url)).toBe('http://localhost:8080/auth/logout');
      expect(init?.method).toBe('POST');
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: null }), { status: 200 }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const { logout } = await import('./auth');
    await logout();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('isLoggedIn()은 requestJson을 거치지 않는 순수 fetch라 401이어도 예외를 던지지 않고 false를 반환한다', async () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 401 })));
    vi.stubGlobal('fetch', fetchMock);

    const { isLoggedIn } = await import('./auth');

    await expect(isLoggedIn()).resolves.toBe(false);
  });
});
