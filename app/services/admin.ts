import { useMockData } from '../config/dataSource';
import { requestJson } from '../lib/api/http';
import {
  getMockAdminChecklistItemTemplates,
  getMockAdminDashboardStats,
  getMockAdminPropertyReports,
  getMockAdminUsers,
} from '../repositories/adminRepository';
import {
  type AdminChecklistItemTemplateDto,
  type AdminDashboardStatsDto,
  type AdminPropertyReportListItemDto,
  type AdminUserListItemDto,
  type PageResponseDto,
} from '../types/api';

// 이 파일은 GET 전용이고 admin/*.tsx page들에서 호출된다 - mutation/단건 조회는
// adminActions.ts에 분리되어 있다(그 파일의 주석 참고). admin/*.tsx가 크로스오리진 배포
// 대응으로 전부 Client Component가 되면서(2026-08-04) 이 파일도 이제 page.tsx가 아니라
// 'use client' 컴포넌트에서 직접 호출되고, adminRepository.ts의 mock repository/init 데이터도
// 브라우저 번들에 포함된다(mock 데이터는 민감하지 않은 로컬 개발용 시드값이라 문제없다 -
// adminRepository.ts 상단 주석 참고).
export type AdminUserSearchParams = {
  page?: number;
  email?: string;
  nickname?: string;
  role?: string;
  status?: string;
};

function toQueryString(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') {
      query.set(key, String(value));
    }
  }
  const queryString = query.toString();
  return queryString ? `?${queryString}` : '';
}

export async function getAdminUsers(
  params: AdminUserSearchParams = {},
  cookieHeader?: string,
): Promise<PageResponseDto<AdminUserListItemDto>> {
  if (useMockData) {
    return getMockAdminUsers(params);
  }
  const path = `/admin/users${toQueryString(params)}`;
  return requestJson<PageResponseDto<AdminUserListItemDto>>(
    path,
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );
}

export type AdminPropertyReportSearchParams = {
  page?: number;
  status?: string;
  reason?: string;
};

export async function getAdminPropertyReports(
  params: AdminPropertyReportSearchParams = {},
  cookieHeader?: string,
): Promise<PageResponseDto<AdminPropertyReportListItemDto>> {
  if (useMockData) {
    return getMockAdminPropertyReports(params);
  }
  const path = `/admin/property-reports${toQueryString(params)}`;
  return requestJson<PageResponseDto<AdminPropertyReportListItemDto>>(
    path,
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );
}

export type AdminDashboardStatsParams = {
  startDate?: string;
  endDate?: string;
};

export async function getAdminDashboardStats(
  params: AdminDashboardStatsParams = {},
  cookieHeader?: string,
): Promise<AdminDashboardStatsDto> {
  if (useMockData) {
    return getMockAdminDashboardStats(params);
  }
  const path = `/admin/stats/dashboard${toQueryString(params)}`;
  return requestJson<AdminDashboardStatsDto>(path, cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined);
}

export async function getAdminChecklistItemTemplates(cookieHeader?: string): Promise<AdminChecklistItemTemplateDto[]> {
  if (useMockData) {
    return getMockAdminChecklistItemTemplates();
  }
  return requestJson<AdminChecklistItemTemplateDto[]>(
    '/admin/checklist-templates',
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );
}
