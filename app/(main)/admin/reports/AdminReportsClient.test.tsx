import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type AdminPropertyReportDetailDto,
  type AdminPropertyReportListItemDto,
  type PageResponseDto,
} from '../../../types/api';
import { AdminReportsClient } from './AdminReportsClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const getAdminPropertyReportDetail = vi.fn();
const reviewAdminPropertyReport = vi.fn();
const bulkReviewAdminPropertyReports = vi.fn();
vi.mock('../../../services/adminActions', () => ({
  getAdminPropertyReportDetail: (...args: unknown[]) => getAdminPropertyReportDetail(...args),
  reviewAdminPropertyReport: (...args: unknown[]) => reviewAdminPropertyReport(...args),
  bulkReviewAdminPropertyReports: (...args: unknown[]) => bulkReviewAdminPropertyReports(...args),
}));

function reportRow(): AdminPropertyReportListItemDto {
  return {
    id: 1,
    propertyId: 10,
    propertyAddress: '서울시 강남구',
    reporterId: 5,
    reporterNickname: '신고자',
    reason: 'PRICE_MISMATCH',
    detail: null,
    status: 'RECEIVED',
    createdAt: '2026-01-01T00:00:00',
  };
}

function reportDetail(overrides: Partial<AdminPropertyReportDetailDto> = {}): AdminPropertyReportDetailDto {
  return {
    id: 1,
    propertyType: null,
    transactionType: null,
    propertyAddress: '서울시 강남구',
    reporterId: 5,
    reporterNickname: '신고자',
    reporterEmail: null,
    reason: 'PRICE_MISMATCH',
    detail: null,
    status: 'RECEIVED',
    reviewedAt: null,
    reviewMemo: null,
    createdAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

function page(content: AdminPropertyReportListItemDto[]): PageResponseDto<AdminPropertyReportListItemDto> {
  return { content, page: 0, size: 20, totalPages: 1, totalElements: content.length, hasNext: false };
}

function reportRow2(overrides: Partial<AdminPropertyReportListItemDto> = {}): AdminPropertyReportListItemDto {
  return { ...reportRow(), id: 2, reporterId: 6, ...overrides };
}

const filters = { status: 'RECEIVED', reason: '' };

describe('AdminReportsClient', () => {
  // 회귀 테스트 - 반려/조치완료는 한 번 확정되면 되돌릴 UI 수단이 없는 결정인데, 예전엔 버튼
  // 클릭이 곧바로 API를 호출해 확인 절차가 아예 없었다.
  it('조치완료 버튼을 눌러도 확인 전에는 API를 호출하지 않는다', async () => {
    getAdminPropertyReportDetail.mockResolvedValueOnce(reportDetail());

    render(<AdminReportsClient data={page([reportRow()])} filters={filters} currentUserId={999} />);

    fireEvent.click(screen.getByRole('button', { name: '상세보기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '조치완료' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '조치완료' }));

    expect(await screen.findByText(/처리 후에는 되돌릴 수 없습니다/)).toBeInTheDocument();
    expect(reviewAdminPropertyReport).not.toHaveBeenCalled();
  });

  it('확인을 누르면 그때 API를 호출하고, 취소를 누르면 호출하지 않는다', async () => {
    getAdminPropertyReportDetail.mockResolvedValueOnce(reportDetail());
    reviewAdminPropertyReport.mockResolvedValueOnce(reportDetail({ status: 'RESOLVED' }));

    render(<AdminReportsClient data={page([reportRow()])} filters={filters} currentUserId={999} />);

    fireEvent.click(screen.getByRole('button', { name: '상세보기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '조치완료' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '조치완료' }));

    fireEvent.click(await screen.findByRole('button', { name: '취소' }));
    expect(reviewAdminPropertyReport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '조치완료' }));
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(reviewAdminPropertyReport).toHaveBeenCalledWith(1, { status: 'RESOLVED', memo: undefined }),
    );
  });

  // 이미 처리된 신고는 상세 모달에서도 처리 버튼을 숨긴다(RECEIVED일 때만 보임) - 일괄처리
  // 체크박스도 같은 이유로 RECEIVED 신고만 선택 가능해야 한다.
  it('RECEIVED가 아닌 신고의 체크박스는 비활성화된다', () => {
    render(
      <AdminReportsClient
        data={page([reportRow(), reportRow2({ status: 'RESOLVED' })])}
        filters={{ status: 'ALL', reason: '' }}
        currentUserId={999}
      />,
    );

    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[1]).not.toBeDisabled();
    expect(checkboxes[2]).toBeDisabled();
  });

  // 회귀 테스트 - backend는 본인이 신고한 건의 셀프 검토를 거부하는데(ADMIN_PROPERTY_REPORT_SELF_REVIEW),
  // Users 페이지(AdminUsersClient)가 본인 계정을 일괄처리/단건 액션에서 미리 제외하는 것과 달리
  // Reports 페이지엔 같은 가드가 없어서 관리자가 본인이 신고한 건을 선택하고 처리 시도까지 갈 수 있었다.
  it('본인이 신고한 건은 체크박스가 비활성화되고 상세 모달에서도 처리 버튼이 보이지 않는다', async () => {
    getAdminPropertyReportDetail.mockResolvedValueOnce(reportDetail());

    render(<AdminReportsClient data={page([reportRow()])} filters={filters} currentUserId={5} />);

    // checkboxes[0]은 헤더의 "전체 선택", [1]이 이 신고(reporterId=5=currentUserId) 행이다.
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[1]).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '상세보기' }));

    expect(await screen.findByText('본인이 신고한 건은 직접 처리할 수 없습니다.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '조치완료' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '반려' })).not.toBeInTheDocument();
  });

  it('체크박스로 선택 후 일괄 조치완료를 확인하면 선택된 id로 bulkReviewAdminPropertyReports를 호출한다', async () => {
    bulkReviewAdminPropertyReports.mockResolvedValueOnce({ succeededIds: [1, 2], failures: [] });
    const onMutated = vi.fn();

    render(
      <AdminReportsClient data={page([reportRow(), reportRow2()])} filters={filters} currentUserId={999} onMutated={onMutated} />,
    );

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]); // 전체 선택
    expect(screen.getByText('2건 선택됨')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '선택 조치완료' }));
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await waitFor(() =>
      expect(bulkReviewAdminPropertyReports).toHaveBeenCalledWith({
        reportIds: [1, 2],
        status: 'RESOLVED',
        memo: undefined,
      }),
    );
    expect(await screen.findByText('일괄 처리 결과')).toBeInTheDocument();
    expect(onMutated).toHaveBeenCalledTimes(1);
  });

  // 회귀 테스트 - A(응답 느림)를 열고 바로 B(응답 빠름)를 열면, B가 먼저 반영된 뒤 뒤늦게 도착한
  // A의 응답이 detail을 도로 덮어써 B를 보고 있어야 할 화면에 A의 내용이 보일 수 있었다.
  it('느린 상세 조회가 나중에 도착해도 그 사이 새로 연 신고의 상세를 덮어쓰지 않는다', async () => {
    let resolveFirst: (value: AdminPropertyReportDetailDto) => void = () => {};
    const firstRequest = new Promise<AdminPropertyReportDetailDto>((resolve) => {
      resolveFirst = resolve;
    });
    getAdminPropertyReportDetail.mockImplementation((id: number) =>
      id === 1 ? firstRequest : Promise.resolve(reportDetail({ id: 2, reporterNickname: '신고자2' })),
    );

    render(<AdminReportsClient data={page([reportRow(), reportRow2()])} filters={filters} currentUserId={999} />);

    const detailButtons = screen.getAllByRole('button', { name: '상세보기' });
    fireEvent.click(detailButtons[0]); // report #1 (느림, 아직 응답 없음)
    fireEvent.click(detailButtons[1]); // report #2 (빠름, 먼저 도착)

    expect(await screen.findByText('신고 #2')).toBeInTheDocument();

    await act(async () => {
      resolveFirst(reportDetail({ id: 1 }));
      await firstRequest;
    });

    expect(screen.getByText('신고 #2')).toBeInTheDocument();
    expect(screen.queryByText('신고 #1')).not.toBeInTheDocument();
  });
});
