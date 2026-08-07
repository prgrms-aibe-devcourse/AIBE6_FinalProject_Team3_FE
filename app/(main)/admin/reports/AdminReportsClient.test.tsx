import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
vi.mock('../../../services/adminActions', () => ({
  getAdminPropertyReportDetail: (...args: unknown[]) => getAdminPropertyReportDetail(...args),
  reviewAdminPropertyReport: (...args: unknown[]) => reviewAdminPropertyReport(...args),
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
    propertyId: 10,
    propertyType: null,
    transactionType: null,
    propertyAddress: '서울시 강남구',
    deposit: null,
    monthlyRent: null,
    reporterId: 5,
    reporterNickname: '신고자',
    reporterEmail: null,
    reason: 'PRICE_MISMATCH',
    detail: null,
    status: 'RECEIVED',
    reviewerId: null,
    reviewedAt: null,
    reviewMemo: null,
    createdAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

function page(content: AdminPropertyReportListItemDto[]): PageResponseDto<AdminPropertyReportListItemDto> {
  return { content, page: 0, size: 20, totalPages: 1, totalElements: content.length, hasNext: false };
}

const filters = { status: 'RECEIVED', reason: '' };

describe('AdminReportsClient', () => {
  // 회귀 테스트 - 반려/조치완료는 한 번 확정되면 되돌릴 UI 수단이 없는 결정인데, 예전엔 버튼
  // 클릭이 곧바로 API를 호출해 확인 절차가 아예 없었다.
  it('조치완료 버튼을 눌러도 확인 전에는 API를 호출하지 않는다', async () => {
    getAdminPropertyReportDetail.mockResolvedValueOnce(reportDetail());

    render(<AdminReportsClient data={page([reportRow()])} filters={filters} />);

    fireEvent.click(screen.getByRole('button', { name: '상세보기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '조치완료' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '조치완료' }));

    expect(await screen.findByText(/처리 후에는 되돌릴 수 없습니다/)).toBeInTheDocument();
    expect(reviewAdminPropertyReport).not.toHaveBeenCalled();
  });

  it('확인을 누르면 그때 API를 호출하고, 취소를 누르면 호출하지 않는다', async () => {
    getAdminPropertyReportDetail.mockResolvedValueOnce(reportDetail());
    reviewAdminPropertyReport.mockResolvedValueOnce(reportDetail({ status: 'RESOLVED' }));

    render(<AdminReportsClient data={page([reportRow()])} filters={filters} />);

    fireEvent.click(screen.getByRole('button', { name: '상세보기' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '조치완료' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '조치완료' }));

    fireEvent.click(await screen.findByRole('button', { name: '취소' }));
    expect(reviewAdminPropertyReport).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '조치완료' }));
    fireEvent.click(await screen.findByRole('button', { name: '확인' }));

    await waitFor(() => expect(reviewAdminPropertyReport).toHaveBeenCalledWith(1, { status: 'RESOLVED', memo: undefined }));
  });
});
