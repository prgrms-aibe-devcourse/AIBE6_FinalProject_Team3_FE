import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLogout } from './useLogout';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const logout = vi.fn();
vi.mock('../services/auth', () => ({
  logout: (...args: unknown[]) => logout(...args),
}));

const resetAuthRefreshState = vi.fn();
vi.mock('./api/http', () => ({
  resetAuthRefreshState: (...args: unknown[]) => resetAuthRefreshState(...args),
}));

describe('useLogout', () => {
  // 회귀 테스트 - resetAuthRefreshState()가 logout() 완료 "이후"에만 불리면, 그 사이 도착하는
  // 이전 refresh 응답의 Set-Cookie가 여전히 브라우저에 반영될 수 있다. /auth/logout을 보내기
  // 전에 먼저 진행 중이던 refresh를 abort시켜야 그 응답 자체가 도착하지 않는다.
  it('logout() 호출 전에 먼저 resetAuthRefreshState()를 호출하고, 성공 후 한 번 더 호출한다', async () => {
    const callOrder: string[] = [];
    resetAuthRefreshState.mockImplementation(() => callOrder.push('reset'));
    logout.mockImplementation(() => {
      callOrder.push('logout-start');
      return Promise.resolve().then(() => callOrder.push('logout-end'));
    });

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(callOrder).toEqual(['reset', 'logout-start', 'logout-end', 'reset']);
    expect(resetAuthRefreshState).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
  });
});
