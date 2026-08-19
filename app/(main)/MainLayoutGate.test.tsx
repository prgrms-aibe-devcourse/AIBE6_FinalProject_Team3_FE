import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api/http';
import MainLayoutGate from './MainLayoutGate';

let mockPathname = '/home';
let mockSearchParams = new URLSearchParams();
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
  useSearchParams: () => mockSearchParams,
}));

const getCurrentUser = vi.fn();
vi.mock('../services/auth', () => ({
  getCurrentUser: (...args: unknown[]) => getCurrentUser(...args),
}));

vi.mock('./MainLayoutClient', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div data-testid="main-layout">{children}</div>,
}));

describe('MainLayoutGate', () => {
  let originalLocation: Location;

  beforeEach(() => {
    mockPathname = '/home';
    mockSearchParams = new URLSearchParams();
    originalLocation = window.location;
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

  // 회귀 테스트 - crossOriginAuth 배포(실제 운영 모드)에서 pathname/searchParams가 effect의
  // 의존성 배열에 있었던 탓에, 인증된 두 페이지 사이를 이동하거나 같은 페이지에서 쿼리스트링만
  // 바뀌어도 매번 GET /auth/me가 다시 나갔다. Server Component 기반 (main)/layout.tsx는 사일블
  // 라우트 클라이언트 내비게이션에 재실행되지 않으므로, 이 컴포넌트도 마운트당 한 번만 확인해야
  // 같은 불변식을 지킨다.
  it('클라이언트 내비게이션(페이지 이동/쿼리스트링 변경)마다 인증을 다시 확인하지 않는다', async () => {
    getCurrentUser.mockResolvedValue({ nickname: '홍길동', profileImageUrl: null, role: 'USER' });

    const { rerender } = render(<MainLayoutGate>content</MainLayoutGate>);
    await screen.findByTestId('main-layout');
    expect(getCurrentUser).toHaveBeenCalledTimes(1);

    mockPathname = '/mypage';
    mockSearchParams = new URLSearchParams('page=2');
    rerender(<MainLayoutGate>content</MainLayoutGate>);

    // 마이크로태스크 큐가 비워질 시간을 준 뒤에도 호출 수가 그대로여야 한다.
    await Promise.resolve();
    expect(getCurrentUser).toHaveBeenCalledTimes(1);
  });

  // 회귀 테스트 - effect를 마운트당 1회만 실행하도록 의존성 배열을 비우면서, 실패 시 돌아갈 next
  // 경로까지 마운트 시점의 낡은 pathname으로 고정되어선 안 된다(클로저 문제). ref로 최신값을
  // 별도 추적해 실패 시점의 실제 위치를 읽어야 한다.
  it('인증 확인 도중 경로가 바뀌어도 실패하면 실패 시점의 최신 경로를 next로 사용한다', async () => {
    let rejectPending: (error: unknown) => void = () => {};
    getCurrentUser.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          rejectPending = reject;
        }),
    );

    const { rerender } = render(<MainLayoutGate>content</MainLayoutGate>);

    // 아직 GET /auth/me 응답 전에 다른 화면으로 이동한 상황을 흉내낸다.
    mockPathname = '/mypage';
    mockSearchParams = new URLSearchParams('tab=security');
    rerender(<MainLayoutGate>content</MainLayoutGate>);

    rejectPending(new ApiError('unauthorized', 401));

    await waitFor(() => expect(window.location.href).toContain('/login'));
    expect(window.location.href).toContain(encodeURIComponent('/mypage?tab=security'));
  });
});
