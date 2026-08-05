'use client';

import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { parsePageParam } from '../../../lib/pageParam';
import { getAdminUsers } from '../../../services/admin';
import { getCurrentUser } from '../../../services/auth';
import { type AdminUserListItemDto, type PageResponseDto } from '../../../types/api';
import { AdminUsersClient } from './AdminUsersClient';

function AdminUsersPageContent() {
  const searchParams = useSearchParams();
  const page = parsePageParam(searchParams.get('page') ?? undefined);
  const email = searchParams.get('email') ?? undefined;
  const nickname = searchParams.get('nickname') ?? undefined;
  const role = searchParams.get('role') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  const [data, setData] = useState<PageResponseDto<AdminUserListItemDto> | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [currentUserId, setCurrentUserId] = useState<number | undefined>(undefined);
  const [currentUserError, setCurrentUserError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // 이 화면 전체가 client component라 router.refresh()가 다시 가져올 Server Component 데이터가
  // 없다 - AdminUsersClient가 역할/상태 변경에 성공한 뒤 목록을 다시 그리려면 이 fetch를 직접
  // 다시 호출해야 한다. currentUserId는 세션 중 바뀌지 않으므로 재조회 대상에서 뺀다.
  //
  // requestIdRef: 필터를 빠르게 바꾸면 이전 필터의 느린 응답이 최신 필터의 빠른 응답보다 늦게
  // 도착할 수 있다 - 매 호출마다 순번을 매겨서, 응답이 왔을 때 그게 여전히 최신 호출인지 확인한
  // 뒤에만 state를 쓴다. useEffect의 cancelled 플래그는 loading/currentUserId만 지켜줄 뿐 이
  // 함수 내부 쓰기는 못 막는다(onMutated로 effect 밖에서도 호출되므로 더더욱 그렇다).
  const requestIdRef = useRef(0);
  const reloadUsers = useCallback(() => {
    const requestId = ++requestIdRef.current;
    return getAdminUsers({ page, email, nickname, role, status })
      .then((usersPage) => {
        if (requestId !== requestIdRef.current) return;
        setData(usersPage);
        setLoadError(undefined);
      })
      .catch(() => {
        if (requestId !== requestIdRef.current) return;
        setLoadError('유저 목록을 불러오지 못했습니다.');
      });
  }, [page, email, nickname, role, status]);

  useEffect(() => {
    let cancelled = false;
    // 필터/페이지가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과
    // 동일) - 필터 변경 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all([
      reloadUsers(),
      // admin/layout.tsx가 이미 이 요청의 role을 확인해 통과시켰지만, 그 확인과 이 fetch 사이의
      // 네트워크/CORS 순간 장애나 세션 만료까지 막아주진 않는다 - 여기서 실패를 안 잡으면
      // Promise.all 전체가 reject되어 currentUserId가 영영 undefined로 남고, 아래 렌더링
      // 조건(loading || currentUserId === undefined) 때문에 스피너에 영원히 갇힌다.
      getCurrentUser()
        .then((me) => me.userId)
        .catch((error) => {
          console.error('Failed to load current user', error);
          if (!cancelled) {
            setCurrentUserError('현재 로그인한 계정 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.');
          }
          return undefined;
        }),
    ])
      .then(([, userId]) => {
        if (cancelled) return;
        setCurrentUserId(userId);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadUsers]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // currentUserId 없이는 AdminUsersClient가 "본인 계정" 판단을 할 수 없으므로 렌더링할 수 없다 -
  // loading이 끝났는데도 여전히 undefined라면 getCurrentUser()가 실패한 것이니, 스피너를 계속
  // 보여주는 대신 에러를 보여준다.
  if (currentUserId === undefined) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <div className="ansim-card border-red-100 bg-red-50 p-6 text-sm text-red-700">
          {currentUserError ?? '현재 로그인한 계정 정보를 불러오지 못했습니다. 새로고침 후 다시 시도해주세요.'}
        </div>
      </div>
    );
  }

  return (
    <AdminUsersClient
      data={data}
      loadError={loadError}
      filters={{
        email: email ?? '',
        nickname: nickname ?? '',
        role: role ?? '',
        status: status ?? '',
      }}
      currentUserId={currentUserId}
      onMutated={reloadUsers}
    />
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <AdminUsersPageContent />
    </Suspense>
  );
}
