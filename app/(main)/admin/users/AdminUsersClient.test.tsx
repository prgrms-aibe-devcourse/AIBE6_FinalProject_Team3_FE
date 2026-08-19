import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type AdminUserListItemDto, type PageResponseDto } from '../../../types/api';
import { AdminUsersClient } from './AdminUsersClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const updateAdminUserRole = vi.fn();
const updateAdminUserStatus = vi.fn();
const bulkUpdateAdminUserStatus = vi.fn();
vi.mock('../../../services/adminActions', () => ({
  updateAdminUserRole: (...args: unknown[]) => updateAdminUserRole(...args),
  updateAdminUserStatus: (...args: unknown[]) => updateAdminUserStatus(...args),
  bulkUpdateAdminUserStatus: (...args: unknown[]) => bulkUpdateAdminUserStatus(...args),
}));

function user(overrides: Partial<AdminUserListItemDto>): AdminUserListItemDto {
  return {
    id: 1,
    email: 'user@example.com',
    nickname: '유저',
    role: 'USER',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

function page(content: AdminUserListItemDto[]): PageResponseDto<AdminUserListItemDto> {
  return { content, page: 0, size: 20, totalPages: 1, totalElements: content.length, hasNext: false };
}

const filters = { email: '', nickname: '', role: '', status: '' };

describe('AdminUsersClient', () => {
  it('로그인한 관리자 본인의 행에는 관리자 해제/정지 버튼 대신 안내 문구를 보여준다', () => {
    render(
      <AdminUsersClient
        data={page([user({ id: 1, nickname: '관리자', role: 'ADMIN' })])}
        filters={filters}
        currentUserId={1}
      />,
    );

    expect(screen.getByText('본인 계정')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '관리자 해제' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '정지' })).not.toBeInTheDocument();
  });

  it('다른 유저의 행에는 관리자 해제/정지 버튼을 정상적으로 보여준다', () => {
    render(
      <AdminUsersClient
        data={page([user({ id: 2, nickname: '다른유저', role: 'USER' })])}
        filters={filters}
        currentUserId={1}
      />,
    );

    expect(screen.queryByText('본인 계정')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '관리자 지정' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '정지' })).toBeInTheDocument();
  });

  it('탈퇴한 유저의 행에는 어떤 액션도 보여주지 않는다', () => {
    render(
      <AdminUsersClient
        data={page([user({ id: 2, nickname: '탈퇴유저', status: 'WITHDRAWN' })])}
        filters={filters}
        currentUserId={1}
      />,
    );

    expect(screen.queryByText('본인 계정')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '관리자 지정' })).not.toBeInTheDocument();
  });

  // 회귀 테스트 - 한 유저에 대한 액션이 실패해 모달에 에러가 남은 채로 닫고, 다른 유저의
  // 액션 모달을 열면 이전 에러가 그대로 보이던 문제. 새 액션을 열 때 actionError를 리셋해야 한다.
  it('한 유저의 액션 실패 메시지가 다른 유저의 액션 모달에 남지 않는다', async () => {
    updateAdminUserRole.mockRejectedValueOnce(new Error('권한 변경에 실패했습니다.'));

    render(
      <AdminUsersClient
        data={page([
          user({ id: 2, nickname: '유저둘', role: 'USER' }),
          user({ id: 3, nickname: '유저셋', role: 'USER' }),
        ])}
        filters={filters}
        currentUserId={1}
      />,
    );

    fireEvent.click(screen.getAllByRole('button', { name: '관리자 지정' })[0]);
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(screen.getByText('권한 변경에 실패했습니다.')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '취소' }));
    fireEvent.click(screen.getAllByRole('button', { name: '관리자 지정' })[1]);

    expect(screen.queryByText('권한 변경에 실패했습니다.')).not.toBeInTheDocument();
  });

  // (2026-08-12 추가) "정지" 액션 자체(성공/실패)를 검증하는 테스트가 지금까지 하나도 없었다 -
  // updateAdminUserStatus가 실제로 (userId, {status:'SUSPENDED'})로 호출되는지, 성공 시 모달이
  // 닫히고 onMutated가 불리는지를 확인한다.
  it('정지 버튼 클릭 후 확인하면 updateAdminUserStatus를 호출하고 모달을 닫은 뒤 목록을 새로고침한다', async () => {
    updateAdminUserStatus.mockResolvedValueOnce(undefined);
    const onMutated = vi.fn();

    render(
      <AdminUsersClient
        data={page([user({ id: 2, nickname: '유저둘', status: 'ACTIVE' })])}
        filters={filters}
        currentUserId={1}
        onMutated={onMutated}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '정지' }));
    expect(screen.getByText('이 유저를 정지할까요?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(updateAdminUserStatus).toHaveBeenCalledWith(2, { status: 'SUSPENDED' }));
    await waitFor(() => expect(screen.queryByText('이 유저를 정지할까요?')).not.toBeInTheDocument());
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  // 실패 경로 - 컴포넌트 코드(confirmAction의 catch)는 실패 시 모달을 닫지 않고 actionError만
  // 채워 사용자가 같은 모달에서 재시도하거나 취소할 수 있게 한다. 이 동작도 지금까지 정지
  // 액션에서는 한 번도 검증된 적이 없었다.
  it('정지 실패 시 모달을 닫지 않고 에러 메시지를 보여준다', async () => {
    updateAdminUserStatus.mockRejectedValueOnce(new Error('정지 처리에 실패했습니다.'));

    render(
      <AdminUsersClient
        data={page([user({ id: 2, nickname: '유저둘', status: 'ACTIVE' })])}
        filters={filters}
        currentUserId={1}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '정지' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() => expect(screen.getByText('정지 처리에 실패했습니다.')).toBeInTheDocument());
    expect(screen.getByText('이 유저를 정지할까요?')).toBeInTheDocument();
  });

  // 탈퇴 유저/본인 계정은 단건 액션 버튼도 이미 숨긴다(위 테스트 참고) - 일괄처리 체크박스도
  // 같은 이유로 같은 대상을 선택 불가로 막아야 한다.
  it('본인 계정과 탈퇴한 유저의 체크박스는 비활성화된다', () => {
    render(
      <AdminUsersClient
        data={page([
          user({ id: 1, nickname: '관리자', role: 'ADMIN' }),
          user({ id: 2, nickname: '탈퇴유저', status: 'WITHDRAWN' }),
          user({ id: 3, nickname: '일반유저' }),
        ])}
        filters={filters}
        currentUserId={1}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    // 0번은 헤더(전체선택), 1~3번이 각 행(관리자 본인/탈퇴유저/일반유저) 순서.
    expect(checkboxes[1]).toBeDisabled();
    expect(checkboxes[2]).toBeDisabled();
    expect(checkboxes[3]).not.toBeDisabled();
  });

  it('체크박스로 선택하면 일괄처리 액션바가 나타나고, 일괄 정지를 확인하면 선택된 id로 bulkUpdateAdminUserStatus를 호출한다', async () => {
    bulkUpdateAdminUserStatus.mockResolvedValueOnce({ succeededIds: [2, 3], failures: [] });
    const onMutated = vi.fn();

    render(
      <AdminUsersClient
        data={page([user({ id: 2, nickname: '유저둘' }), user({ id: 3, nickname: '유저셋' })])}
        filters={filters}
        currentUserId={1}
        onMutated={onMutated}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    expect(screen.getByText('2명 선택됨')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '선택 정지' }));
    expect(screen.getByText('선택한 2명을 정지할까요?')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(bulkUpdateAdminUserStatus).toHaveBeenCalledWith({ userIds: [2, 3], status: 'SUSPENDED' }),
    );
    expect(await screen.findByText('일괄 처리 결과')).toBeInTheDocument();
    expect(screen.getByText('성공 2명')).toBeInTheDocument();
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  it('일괄처리가 부분 실패하면 결과 모달에 실패 항목을 보여준다', async () => {
    bulkUpdateAdminUserStatus.mockResolvedValueOnce({
      succeededIds: [2],
      failures: [{ id: 3, message: '마지막 남은 관리자 계정은 강등하거나 정지할 수 없습니다.' }],
    });

    render(
      <AdminUsersClient
        data={page([user({ id: 2, nickname: '유저둘' }), user({ id: 3, nickname: '유저셋', role: 'ADMIN' })])}
        filters={filters}
        currentUserId={1}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // 전체 선택

    fireEvent.click(screen.getByRole('button', { name: '선택 정지' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    expect(await screen.findByText('성공 1명, 실패 1명')).toBeInTheDocument();
    expect(screen.getByText(/마지막 남은 관리자 계정은 강등하거나 정지할 수 없습니다/)).toBeInTheDocument();
  });
});
