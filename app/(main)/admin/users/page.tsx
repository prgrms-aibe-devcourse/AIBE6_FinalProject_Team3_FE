'use client';

import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { parsePageParam } from '../../../lib/pageParam';
import { resolveErrorMessage } from '../../../lib/resolveErrorMessage';
import { getAdminUsers } from '../../../services/admin';
import { type AdminUserListItemDto, type PageResponseDto } from '../../../types/api';
import { useAdminCurrentUser } from '../AdminCurrentUserContext';
import { AdminUsersClient } from './AdminUsersClient';

function AdminUsersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // AdminLayout이 role 게이트 과정에서 이미 확인해둔 본인 정보를 재사용한다 - 이 페이지가 직접
  // getCurrentUser()를 또 호출하면 /admin/users에 진입할 때마다 /auth/me가 불필요하게 두 번
  // 왕복했다(2026-08-12 정정, backend/frontend admin-design.md "전수조사 결과" 참고).
  const { userId: currentUserId } = useAdminCurrentUser();
  const page = parsePageParam(searchParams.get('page') ?? undefined);
  const email = searchParams.get('email') ?? undefined;
  const nickname = searchParams.get('nickname') ?? undefined;
  const role = searchParams.get('role') ?? undefined;
  const status = searchParams.get('status') ?? undefined;

  // 유저 상태/권한 변경으로 필터에 맞는 항목이 하나 줄면, 지금 보고 있던 페이지가 더 이상
  // 존재하지 않게 될 수 있다(예: 2페이지에 1명 남아있던 걸 정지 처리 → 2페이지는 빈 목록).
  // 목록 갱신 없이는 Pagination 자체가 사라져(totalPages<=1) 되돌아갈 UI 수단이 없으므로,
  // 응답의 totalPages를 기준으로 유효 범위를 벗어나면 자동으로 마지막 유효 페이지로 되돌린다.
  const clampToValidPage = useCallback(
    (totalPages: number) => {
      const validPage = totalPages > 0 ? Math.min(page, totalPages - 1) : 0;
      if (validPage === page) return false;
      const query = new URLSearchParams(searchParams.toString());
      if (validPage) {
        query.set('page', String(validPage));
      } else {
        query.delete('page');
      }
      router.replace(`/admin/users${query.toString() ? `?${query.toString()}` : ''}`);
      return true;
    },
    [page, router, searchParams],
  );

  const [data, setData] = useState<PageResponseDto<AdminUserListItemDto> | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // 이 화면 전체가 client component라 router.refresh()가 다시 가져올 Server Component 데이터가
  // 없다 - AdminUsersClient가 역할/상태 변경에 성공한 뒤 목록을 다시 그리려면 이 fetch를 직접
  // 다시 호출해야 한다.
  //
  // requestIdRef: 필터를 빠르게 바꾸면 이전 필터의 느린 응답이 최신 필터의 빠른 응답보다 늦게
  // 도착할 수 있다 - 매 호출마다 순번을 매겨서, 응답이 왔을 때 그게 여전히 최신 호출인지 확인한
  // 뒤에만 state를 쓴다. useEffect의 cancelled 플래그는 loading만 지켜줄 뿐 이 함수 내부 쓰기는
  // 못 막는다(onMutated로 effect 밖에서도 호출되므로 더더욱 그렇다).
  const requestIdRef = useRef(0);
  const reloadUsers = useCallback(
    (options?: { keepDataOnError?: boolean }) => {
      const requestId = ++requestIdRef.current;
      return getAdminUsers({ page, email, nickname, role, status })
        .then((usersPage) => {
          if (requestId !== requestIdRef.current) return;
          // 지금 페이지가 이 결과 기준으로 더 이상 유효하지 않으면, 빈 목록을 잠깐 보여주는 대신
          // 유효한 페이지로 리다이렉트한다(그 리다이렉트가 URL을 바꿔 이 effect를 다시 실행시킨다).
          if (clampToValidPage(usersPage.totalPages)) return;
          setData(usersPage);
          setLoadError(undefined);
        })
        .catch((error) => {
          if (requestId !== requestIdRef.current) return;
          const message = resolveErrorMessage(error, '유저 목록을 불러오지 못했습니다.');
          if (options?.keepDataOnError) {
            // 역할/상태 변경이 서버에서는 이미 성공한 뒤, 그 후속 목록 재조회만 일시적으로
            // 실패한 경우다 - 목록을 지우면 방금 확정한 변경 자체가 실패한 것처럼 보인다. 기존
            // 목록은 그대로 두고 경고만 남긴다(AdminUsersClient가 data/loadError를 독립적으로
            // 렌더링하므로 목록과 경고가 함께 보인다).
            setLoadError(message);
            return;
          }
          // 필터/페이지 변경으로 인한 재조회 실패다 - data를 그대로 두면 에러 배너 아래 이전
          // (어쩌면 다른 필터의) 목록이 최신인 것처럼 계속 보인다. 실패했으면 화면에는 에러만
          // 남긴다.
          setData(undefined);
          setLoadError(message);
        });
    },
    [page, email, nickname, role, status, clampToValidPage],
  );

  useEffect(() => {
    let cancelled = false;
    // 필터/페이지가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과
    // 동일) - 필터 변경 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    reloadUsers().finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [reloadUsers]);

  const reloadUsersAfterMutation = useCallback(() => reloadUsers({ keepDataOnError: true }), [reloadUsers]);

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
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
      onMutated={reloadUsersAfterMutation}
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
