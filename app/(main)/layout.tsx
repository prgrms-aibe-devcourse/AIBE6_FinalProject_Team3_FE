import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { type ReactNode } from 'react';
import { crossOriginAuth } from '../config/auth';
import { CURRENT_PATH_HEADER } from '../lib/api/http';
import { getCurrentUser } from '../services/auth';
import MainLayoutClient from './MainLayoutClient';
import MainLayoutGate from './MainLayoutGate';

// crossOriginAuth=true 분기는 cookies()/headers()를 호출하지 않아, Next.js가 이 레이아웃 하위
// 경로를 자동으로 dynamic 렌더링으로 판단하지 못한다 - 정적 생성(SSG)을 시도하다가
// useSearchParams()를 쓰는 client 하위 페이지(예: /admin/reports)에서 "should be wrapped in a
// suspense boundary" 빌드 에러로 죽는다(실측: crossOriginAuth=true로 next build 시 100% 재현).
// 이 레이아웃 하위는 전부 로그인 필요 페이지라 애초에 정적 생성이 의미 없으므로 명시적으로 강제한다.
export const dynamic = 'force-dynamic';

export default async function MainLayout({ children }: { children: ReactNode }) {
  // crossOriginAuth 배포에서는 이 서버 컴포넌트가 access_token 쿠키를 받을 방법이 없으므로(쿠키가
  // 백엔드 도메인에만 종속됨) 여기서 /auth/me를 확인하는 대신, 브라우저가 직접 크로스오리진
  // fetch(credentials:'include')로 확인하는 클라이언트 게이트에 위임한다.
  if (crossOriginAuth) {
    return <MainLayoutGate>{children}</MainLayoutGate>;
  }

  const cookieHeader = (await cookies()).toString();

  let nickname: string;
  let profileImageUrl: string | null;
  let isAdmin: boolean;
  try {
    const me = await getCurrentUser(cookieHeader);
    nickname = me.nickname;
    profileImageUrl = me.profileImageUrl;
    isAdmin = me.role === 'ADMIN';
  } catch {
    // 프록시는 access_token 쿠키 존재 여부만 확인하고 만료/위조까지는 걸러내지 않으므로,
    // 실제 유효성은 여기서 /auth/me 호출 결과로 판단한다. 다만 access_token은 있는데 무효한
    // 경우(로그아웃으로 블랙리스트에 오름 등) refresh_token은 아직 유효할 수 있다 — 이 Server
    // Component는 쿠키를 쓸 수 없어(App Router 제약) 여기서 직접 refresh를 시도하면 안 된다
    // (refresh는 DB의 refresh token을 회전시키는데, 그 결과를 브라우저에 반영 못 하면 다음
    // 요청부터 refresh 자체가 영구히 깨진다). 그래서 실제로 쿠키를 쓸 수 있는 Route Handler
    // (app/auth/session-recover)로 보내 그쪽에서 refresh를 시도하게 한다.
    const currentPath = (await headers()).get(CURRENT_PATH_HEADER) ?? '/home';
    redirect(`/auth/session-recover?next=${encodeURIComponent(currentPath)}`);
  }

  return (
    <MainLayoutClient nickname={nickname} profileImageUrl={profileImageUrl} isAdmin={isAdmin}>
      {children}
    </MainLayoutClient>
  );
}
