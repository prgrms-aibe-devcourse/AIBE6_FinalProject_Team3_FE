import { render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OAuthCallbackPage from './page';

const replace = vi.fn();
let mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => mockSearchParams,
}));

const getCurrentUser = vi.fn();
vi.mock('../../services/auth', () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

const getMyProfile = vi.fn();
vi.mock('../../services/user', () => ({
  getMyProfile: (...args: unknown[]) => getMyProfile(...args),
}));

describe('OAuthCallbackPage', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
    document.cookie = 'oauth_next=; path=/; max-age=0';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 회귀 테스트 - oauth_next 쿠키가 없어(보호된 페이지에서 튕겨온 게 아니라 처음부터 소셜
  // 로그인을 시도한 경우) rawNext가 없어도, 로그인 페이지로 돌아갈 때 next는 항상 붙어야 한다
  // (session_unavailable 재시도 UI가 next 존재를 전제로 하지 않도록 login/page.tsx도 함께
  // 고쳤지만, 이 콜백 자체도 next를 항상 명시적으로 붙여야 일관된다).
  it('oauth_next 쿠키가 없어도 에러 리다이렉트에 next가 기본값으로 붙는다', async () => {
    mockSearchParams = new URLSearchParams('error=oauth_login_failed');

    render(<OAuthCallbackPage />);

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const [calledUrl] = replace.mock.calls[0];
    expect(calledUrl).toContain('next=%2Fhome');
  });

  // 회귀 테스트 - 세션 확인이 아직 응답 전인 사이에 사용자가 이 페이지를 떠나면(언마운트),
  // 나중에 도착하는 실패 응답이 그 시점의 페이지를 세션 만료로 강제 리다이렉트시키면 안 된다.
  // getCurrentUser에 전달된 AbortSignal이 실제로 abort되는지, 그리고 언마운트 후에는 router
  // 이동이 발생하지 않는지 확인한다.
  it('언마운트 후에는 세션 확인 실패가 도착해도 리다이렉트하지 않고, signal이 abort된다', async () => {
    let capturedSignal: AbortSignal | undefined;
    let rejectPending: (error: unknown) => void = () => {};
    getCurrentUser.mockImplementationOnce(
      (_cookieHeader: unknown, signal: AbortSignal) =>
        new Promise((_, reject) => {
          capturedSignal = signal;
          rejectPending = reject;
        }),
    );

    const { unmount } = render(<OAuthCallbackPage />);
    unmount();

    expect(capturedSignal?.aborted).toBe(true);

    rejectPending(new Error('session invalid'));
    await Promise.resolve();
    await Promise.resolve();

    expect(replace).not.toHaveBeenCalled();
  });

  // 회귀 테스트 - consumeOAuthNextCookie()는 읽으면서 쿠키를 지우는 1회용 소비라, StrictMode의
  // dev 전용 이중 마운트(마운트→클린업→재마운트)에서 첫 패스가 쿠키를 이미 소비해버리면 실제
  // 진행되는 두 번째 패스는 next 없이 시작한 것처럼 보일 수 있었다. ref로 캐시해 두 패스 모두
  // 같은 next 값을 쓰는지 확인한다.
  it('StrictMode 이중 마운트에서도 oauth_next 쿠키 값을 잃지 않는다', async () => {
    document.cookie = `oauth_next=${encodeURIComponent('/mypage')}; path=/`;
    getCurrentUser.mockResolvedValue({ nickname: '홍길동', role: 'USER' });
    getMyProfile.mockResolvedValue({ interestRegion: '서울', transactionType: 'JEONSE' });

    render(
      <StrictMode>
        <OAuthCallbackPage />
      </StrictMode>,
    );

    await waitFor(() => expect(replace).toHaveBeenCalled());
    const [calledUrl] = replace.mock.calls[replace.mock.calls.length - 1];
    expect(calledUrl).toBe('/mypage');
  });
});
