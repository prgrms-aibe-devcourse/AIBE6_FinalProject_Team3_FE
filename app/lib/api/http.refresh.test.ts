import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 회귀 테스트 - refreshOnceInBrowser()가 만드는 refresh fetch가 무한정 pending으로 남으면
// (드문 네트워크 행 상태) 그 탭의 이후 모든 401이 같은 죽은 Promise에 계속 합류해 세션 복구가
// 무기한 멈춘다. resetAuthRefreshState()가 실제로 그 fetch를 abort시키는지, 그리고 로그아웃
// 후 다음 로그인이 이전 세션의 refresh 결과를 물려받지 않는지를 검증한다.
describe('resetAuthRefreshState', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_BASE_URL;

  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:8080';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_API_BASE_URL = originalEnv;
    vi.unstubAllGlobals();
  });

  it('진행 중인 refresh fetch를 실제로 abort시킨다', async () => {
    let refreshSignal: AbortSignal | undefined;

    const fetchMock = vi.fn((url: unknown, init?: RequestInit) => {
      const href = String(url);
      if (href.endsWith('/auth/refresh')) {
        refreshSignal = init?.signal as AbortSignal;
        return new Promise<Response>((_, reject) => {
          refreshSignal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        });
      }
      // 원 요청은 401(access token 만료)로 응답해 refresh 흐름을 트리거한다.
      return Promise.resolve(
        new Response(JSON.stringify({ success: false, error: { code: 'AUTH_TOKEN_EXPIRED', message: 'expired' } }), {
          status: 401,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { requestJson, resetAuthRefreshState } = await import('./http');

    const pending = requestJson('/some/protected/path').catch((error: unknown) => error);

    await vi.waitFor(() => expect(refreshSignal).toBeDefined());
    expect(refreshSignal?.aborted).toBe(false);

    resetAuthRefreshState();

    expect(refreshSignal?.aborted).toBe(true);

    const result = (await pending) as { sessionRefreshOutcome?: string };
    // abort된 refresh는 '결과를 알 수 없음'으로 처리되어, 원래의 401을 unreachable 표시와 함께 던진다.
    expect(result.sessionRefreshOutcome).toBe('unreachable');
  });

  it('reset 이후 새 refresh 시도는 이전 refresh의 결과를 물려받지 않는다', async () => {
    let refreshCallCount = 0;

    const fetchMock = vi.fn((url: unknown) => {
      const href = String(url);
      if (href.endsWith('/auth/refresh')) {
        refreshCallCount += 1;
        return Promise.resolve(new Response(null, { status: 200 }));
      }
      return Promise.resolve(
        new Response(JSON.stringify({ success: false, error: { code: 'AUTH_TOKEN_EXPIRED', message: 'expired' } }), {
          status: 401,
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const { resetAuthRefreshState } = await import('./http');

    resetAuthRefreshState();
    resetAuthRefreshState();

    // reset 자체는 새 요청을 만들지 않는다 - 상태만 정리한다.
    expect(refreshCallCount).toBe(0);
  });
});
