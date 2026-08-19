import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AdminPropertyReportListItemDto, type PageResponseDto } from '../../../types/api';
import { AdminCurrentUserProvider } from '../AdminCurrentUserContext';
import AdminReportsPage from './page';

let mockSearchParams = new URLSearchParams();
// 매 호출마다 새 객체를 반환하면 이 router 객체를 의존성으로 삼는 useCallback들이 렌더마다
// 재생성되어 useEffect가 무한 재실행되는 루프에 빠진다 - 참조가 안정적이도록 모듈 스코프의
// 고정 객체를 반환한다(admin/users/page.test.tsx와 동일한 이유).
const routerMock = { push: vi.fn(), replace: vi.fn() };
vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  useSearchParams: () => mockSearchParams,
}));

const getAdminPropertyReports = vi.fn();
vi.mock('../../../services/admin', () => ({
  getAdminPropertyReports: (...args: unknown[]) => getAdminPropertyReports(...args),
}));

function page(content: AdminPropertyReportListItemDto[]): PageResponseDto<AdminPropertyReportListItemDto> {
  return { content, page: 0, size: 20, totalPages: 1, totalElements: content.length, hasNext: false };
}

describe('AdminReportsPage', () => {
  beforeEach(() => {
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // 회귀 테스트 - 명시적으로 빈 status 파라미터(?status=)가 붙은 URL(오래된 북마크, 수동 편집
  // 링크 등)로 들어오면, ??는 null/undefined만 대체하고 빈 문자열은 그대로 통과시켜 필터 없이
  // (전체) 조회되면서 드롭다운은 아무 항목도 선택되지 않은 것처럼 보이는 불일치가 있었다. 지금은
  // 빈 문자열도 기본값(RECEIVED)으로 대체되어야 한다.
  it('status 파라미터가 빈 문자열이면 기본값(RECEIVED)으로 조회한다', async () => {
    mockSearchParams = new URLSearchParams('status=');
    getAdminPropertyReports.mockResolvedValue(page([]));

    render(
      <AdminCurrentUserProvider value={{ userId: 1 }}>
        <AdminReportsPage />
      </AdminCurrentUserProvider>,
    );

    await screen.findByText('조건에 맞는 신고가 없습니다.');

    expect(getAdminPropertyReports).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'RECEIVED' }),
    );
  });
});
