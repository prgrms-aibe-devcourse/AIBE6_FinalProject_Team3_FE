import { useMockData } from '../config/dataSource';
import { requestJson } from '../lib/api/http';
import {
  createMockAdminChecklistItemTemplate,
  deleteMockAdminChecklistItemTemplate,
  getMockAdminPropertyReportDetail,
  reviewMockAdminPropertyReport,
  updateMockAdminChecklistItemTemplate,
  updateMockAdminUserRole,
  updateMockAdminUserStatus,
} from '../repositories/adminRepository';
import {
  type AdminChecklistItemTemplateCreateRequestDto,
  type AdminChecklistItemTemplateDto,
  type AdminChecklistItemTemplateUpdateRequestDto,
  type AdminPropertyReportDetailDto,
  type AdminPropertyReportReviewRequestDto,
  type AdminUserDetailDto,
  type AdminUserRoleUpdateRequestDto,
  type AdminUserStatusUpdateRequestDto,
} from '../types/api';

// admin.ts(GET 전용)와 이 파일 둘 다 'use client' 컴포넌트에서 호출되어 이미 브라우저 번들에
// 포함되므로(services/admin.ts 상단 주석 참고), adminRepository.ts를 여기서 바로 import해도
// 새로 생기는 문제는 없다. 오히려 admin.ts의 mock 읽기와 이 파일의 mock 쓰기가 같은
// adminRepository.ts의 globalThis 상태를 직접 공유해야, 이전에 Route Handler(서버 프로세스)를
// 거쳐 쓰기만 다른 인스턴스를 바꾸느라 읽기 쪽에 반영되지 않던 문제가 재발하지 않는다.
async function ensureFound<T>(result: T | undefined, notFoundMessage: string): Promise<T> {
  if (result === undefined) {
    throw new Error(notFoundMessage);
  }
  return result;
}

export async function updateAdminUserRole(
  userId: number,
  request: AdminUserRoleUpdateRequestDto,
): Promise<AdminUserDetailDto> {
  if (useMockData) {
    return ensureFound(updateMockAdminUserRole(userId, request.role), '유저를 찾을 수 없습니다.');
  }
  return requestJson<AdminUserDetailDto>(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function updateAdminUserStatus(
  userId: number,
  request: AdminUserStatusUpdateRequestDto,
): Promise<AdminUserDetailDto> {
  if (useMockData) {
    return ensureFound(updateMockAdminUserStatus(userId, request.status), '유저를 찾을 수 없습니다.');
  }
  return requestJson<AdminUserDetailDto>(`/admin/users/${userId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function getAdminPropertyReportDetail(reportId: number): Promise<AdminPropertyReportDetailDto> {
  if (useMockData) {
    return ensureFound(getMockAdminPropertyReportDetail(reportId), '신고를 찾을 수 없습니다.');
  }
  return requestJson<AdminPropertyReportDetailDto>(`/admin/property-reports/${reportId}`);
}

export async function reviewAdminPropertyReport(
  reportId: number,
  request: AdminPropertyReportReviewRequestDto,
): Promise<AdminPropertyReportDetailDto> {
  if (useMockData) {
    return ensureFound(reviewMockAdminPropertyReport(reportId, request), '신고를 찾을 수 없습니다.');
  }
  return requestJson<AdminPropertyReportDetailDto>(`/admin/property-reports/${reportId}/review`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function createAdminChecklistItemTemplate(
  request: AdminChecklistItemTemplateCreateRequestDto,
): Promise<AdminChecklistItemTemplateDto> {
  if (useMockData) {
    return createMockAdminChecklistItemTemplate(request);
  }
  return requestJson<AdminChecklistItemTemplateDto>('/admin/checklist-templates', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function updateAdminChecklistItemTemplate(
  templateId: number,
  request: AdminChecklistItemTemplateUpdateRequestDto,
): Promise<AdminChecklistItemTemplateDto> {
  if (useMockData) {
    return ensureFound(updateMockAdminChecklistItemTemplate(templateId, request), '체크리스트 문항을 찾을 수 없습니다.');
  }
  return requestJson<AdminChecklistItemTemplateDto>(`/admin/checklist-templates/${templateId}`, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

export async function deleteAdminChecklistItemTemplate(templateId: number): Promise<void> {
  if (useMockData) {
    if (!deleteMockAdminChecklistItemTemplate(templateId)) {
      throw new Error('체크리스트 문항을 찾을 수 없습니다.');
    }
    return;
  }
  await requestJson<void>(`/admin/checklist-templates/${templateId}`, { method: 'DELETE' });
}
