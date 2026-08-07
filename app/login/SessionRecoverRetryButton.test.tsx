import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionRecoverRetryButton } from './SessionRecoverRetryButton';

const getCurrentUser = vi.fn();
vi.mock('../services/auth', () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

describe('SessionRecoverRetryButton', () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
    // jsdom의 실제 navigation은 구현돼 있지 않으므로, href 대입만 관찰할 수 있는 stub으로 교체한다.
    Object.defineProperty(window, 'location', {
      value: { ...originalLocation, href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { value: originalLocation, writable: true, configurable: true });
    vi.clearAllMocks();
  });

  // 회귀 테스트(오픈 리다이렉트) - next는 로그인 화면 searchParams에서 그대로 넘어온 값이라 외부
  // 조작이 가능하다. 세션 재확인 성공 후 이 값을 검증 없이 window.location.href에 그대로 실으면,
  // ?next=https://evil.example.com 같은 값으로 외부 사이트로 강제 이동시킬 수 있었다.
  it('허용되지 않은 절대 URL로는 이동하지 않고 기본 경로로 이동한다', async () => {
    getCurrentUser.mockResolvedValueOnce({ userId: 1 });

    render(<SessionRecoverRetryButton next="https://evil.example.com" />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(window.location.href).not.toBe(''));

    expect(window.location.href).toBe('/home');
  });

  it('허용된 경로로는 그대로 이동한다', async () => {
    getCurrentUser.mockResolvedValueOnce({ userId: 1 });

    render(<SessionRecoverRetryButton next="/mypage" />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(window.location.href).toBe('/mypage'));
  });
});
