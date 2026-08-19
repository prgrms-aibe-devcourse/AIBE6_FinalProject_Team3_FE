import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  // (2026-08-12 추가) mock 호출 이력이 테스트 간에 남아있으면(vi.fn()은 기본적으로 안 지워짐)
  // 아래 두 번째 테스트의 "push가 호출 안 됐다" 검증이 첫 번째 테스트의 push('/login') 호출과
  // 섞여 오탐/누락될 수 있다.
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  // (2026-08-12 추가) 실패 경로 회귀 테스트 - useLogout.ts의 catch 블록은 "무조건 /login으로
  // 보내면 사용자는 로그아웃된 줄 알지만 서버 세션은 그대로 남는다"는 명시적 설계 근거로 실패
  // 시엔 이동하지 않고 logoutError만 채운다. 이 동작을 지키는 테스트가 없어서, 누군가 실수로
  // catch의 얼리리턴/상태복원을 지워도 기존 성공 케이스 테스트만으로는 잡히지 않았다.
  it('logout()이 실패하면 /login으로 이동하지 않고 logoutError를 채운 뒤 재시도 가능한 상태로 되돌린다', async () => {
    logout.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useLogout());

    await act(async () => {
      await result.current.handleLogout();
    });

    expect(push).not.toHaveBeenCalled();
    expect(result.current.logoutError).toBe('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    // isLoggingOut이 다시 false로 돌아와야 사용자가 재시도 버튼을 다시 누를 수 있다.
    expect(result.current.isLoggingOut).toBe(false);
  });
});
