import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AdminUserListItemDto, type PageResponseDto } from '../../../types/api';
import { AdminCurrentUserProvider } from '../AdminCurrentUserContext';
import AdminUsersPage from './page';

let mockSearchParams = new URLSearchParams();
// 매 호출마다 새 객체를 반환하면(예: () => ({ push: vi.fn(), replace: vi.fn() })), 이 router
// 객체를 의존성으로 삼는 clampToValidPage/reloadUsers의 useCallback이 렌더마다 재생성되어
// useEffect가 무한 재실행되는(getAdminUsers를 계속 다시 호출하는) 루프에 빠진다 - 참조가
// 안정적이도록 모듈 스코프의 고정 객체를 반환한다.
const routerMock = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => mockSearchParams,
}));

const getAdminUsers = vi.fn();
vi.mock('../../../services/admin', () => ({
  getAdminUsers: (...args: unknown[]) => getAdminUsers(...args),
}));

const updateAdminUserStatus = vi.fn();
vi.mock('../../../services/adminActions', () => ({
  updateAdminUserRole: vi.fn(),
  updateAdminUserStatus: (...args: unknown[]) => updateAdminUserStatus(...args),
  bulkUpdateAdminUserStatus: vi.fn(),
}));

function user(overrides: Partial<AdminUserListItemDto>): AdminUserListItemDto {
  return {
    id: 2,
    email: 'target@example.com',
    nickname: '대상유저',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

function page(content: AdminUserListItemDto[]): PageResponseDto<AdminUserListItemDto> {
  return { content, page: 0, size: 20, totalPages: 1, totalElements: content.length, hasNext: false };
}

describe('AdminUsersPage', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 회귀 테스트 - 유저 상태 변경 자체는 서버에서 이미 성공했는데, 그 직후 목록 재조회(onMutated)만
  // 일시적으로 실패하면 기존에는 목록 전체가 지워지고 에러 배너만 남아 방금 확정한 변경이 실패한
  // 것처럼 보였다. 지금은 재조회 실패 시에도 마지막으로 성공한 목록을 그대로 보여주면서 경고만
  // 추가로 떠야 한다.
  it('변경 후 목록 재조회만 실패해도 기존 목록은 그대로 남고 경고만 추가된다', async () => {
    getAdminUsers.mockResolvedValueOnce(page([user({})]));
    updateAdminUserStatus.mockResolvedValue({ id: 2, role: 'USER', status: 'SUSPENDED' });
    getAdminUsers.mockRejectedValueOnce(new Error('network blip'));

    render(
      <AdminCurrentUserProvider value={{ userId: 1 }}>
        <AdminUsersPage />
      </AdminCurrentUserProvider>,
    );

    await screen.findByText('target@example.com');

    fireEvent.click(screen.getByRole('button', { name: '정지' }));
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));

    await waitFor(() => expect(updateAdminUserStatus).toHaveBeenCalled());
    await waitFor(() => expect(getAdminUsers).toHaveBeenCalledTimes(2));

    // 목록은 여전히 보여야 한다(지워지면 안 된다) - 방금 성공한 변경이 실패한 것처럼 보이면 안 된다.
    expect(screen.getByText('target@example.com')).toBeInTheDocument();
    // resolveErrorMessage는 Error 인스턴스면 그 message를 그대로 보여준다(fallback 문구는 Error가
    // 아니거나 message가 빈 경우에만 쓰인다) - 재조회가 실패했다는 경고 자체가 목록과 함께 보이는지만 확인한다.
    expect(await screen.findByText('network blip')).toBeInTheDocument();
  });
});
