'use client';

import { createContext, useContext } from 'react';

// AdminLayout이 role 게이트 과정에서 이미 확인한 본인 정보를 하위 페이지가 그대로 재사용하도록
// Context로 내려준다 - 없으면 admin/users/page.tsx처럼 "본인 계정" 판단에 currentUserId가
// 필요한 화면마다 getCurrentUser()를 또 호출해 /auth/me가 불필요하게 두 번 왕복하게 된다.
// authorized 상태일 때만 값이 채워지므로(그 전엔 children 자체가 렌더되지 않음), 소비하는
// 쪽은 null 체크 없이 바로 써도 된다 - useAdminCurrentUser()가 그 보장을 강제한다.
//
// 별도 파일로 뺀 이유(2026-08-12): 원래 layout.tsx 안에 함께 있었는데, Context/훅은 라우트
// 파일이 아니라 여러 페이지가 공유하는 재사용 유틸 성격이라 라우트 파일에 대한 의존을 줄이기
// 위해 분리했다.
const AdminCurrentUserContext = createContext<{ userId: number } | null>(null);

export const AdminCurrentUserProvider = AdminCurrentUserContext.Provider;

export function useAdminCurrentUser(): { userId: number } {
  const value = useContext(AdminCurrentUserContext);
  if (!value) {
    throw new Error('useAdminCurrentUser는 AdminLayout 하위(인가 완료 후)에서만 호출할 수 있습니다.');
  }
  return value;
}
