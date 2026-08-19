import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api/http';
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

  // (2026-08-12 추가) getCurrentUser()가 일시적 네트워크/서버 장애(isUnreachableError)로
  // reject되면, 페이지 이동을 시작하지 않고 버튼을 다시 누를 수 있는 상태(retrying=false)로
  // 되돌려야 한다 - 이 catch 분기를 지키는 테스트가 없어서, 조건을 반대로 바꾸거나
  // setRetrying(false)를 지워도 잡아낼 수 없었다.
  it('일시적 오류로 실패하면 이동하지 않고 다시 시도할 수 있는 상태로 되돌아온다', async () => {
    getCurrentUser.mockRejectedValueOnce(new ApiError('network error', 0));

    render(<SessionRecoverRetryButton next="/mypage" />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('button', { name: '다시 시도' })).not.toBeDisabled();
    expect(window.location.href).toBe('');
  });

  // 회귀 테스트 - isUnreachableError도 아니고 requestJson이 리다이렉트를 시작하지도 않는 실패
  // (예: 세션 무효로 확정되지 않은 401/403/404, 백엔드 재배포 중 502 등 sessionRefreshOutcome이
  // 없는 일반 ApiError)는 실제로 이 catch에 도달해 settle되는데, 예전엔 isUnreachableError일
  // 때만 retrying을 풀어줘서 이 경우 버튼이 "재시도 중..."에 영구히 멈춰 있었다.
  it('세션 무효 확정도 네트워크 오류도 아닌 실패도 다시 시도할 수 있는 상태로 되돌아온다', async () => {
    getCurrentUser.mockRejectedValueOnce(new ApiError('not found', 404, { code: 'USER_NOT_FOUND', message: 'not found' }));

    render(<SessionRecoverRetryButton next="/mypage" />);
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByRole('button', { name: '다시 시도' })).not.toBeDisabled();
    expect(window.location.href).toBe('');
  });
});
