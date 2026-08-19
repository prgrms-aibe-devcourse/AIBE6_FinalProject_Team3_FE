'use client';

import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { resolveErrorMessage } from '../../../lib/resolveErrorMessage';
import { getAdminChecklistItemTemplates } from '../../../services/admin';
import { type AdminChecklistItemTemplateDto } from '../../../types/api';
import { AdminChecklistTemplatesClient } from './AdminChecklistTemplatesClient';

export default function AdminChecklistsPage() {
  const [data, setData] = useState<AdminChecklistItemTemplateDto[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  // AdminChecklistTemplatesClient가 문항 생성/수정/삭제에 성공한 뒤 목록을 다시 그리려면 이 fetch를
  // 직접 다시 호출해야 한다 - router.refresh()는 이 화면 전체가 client component라 다시 가져올
  // Server Component 데이터가 없어 no-op이다(admin/users, admin/reports와 동일한 이유).
  //
  // requestIdRef: onMutated로 effect 밖에서도 호출되므로, 응답이 왔을 때 그게 여전히 최신 호출인지
  // 확인한 뒤에만 state를 쓴다.
  const requestIdRef = useRef(0);
  const reloadTemplates = useCallback((options?: { keepDataOnError?: boolean }) => {
    const requestId = ++requestIdRef.current;
    return getAdminChecklistItemTemplates()
      .then((result) => {
        if (requestId !== requestIdRef.current) return;
        setData(result);
        setLoadError(undefined);
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return;
        const message = resolveErrorMessage(error, '체크리스트 문항을 불러오지 못했습니다.');
        if (options?.keepDataOnError) {
          // 문항 생성/수정/삭제가 서버에서는 이미 성공한 뒤, 그 후속 목록 재조회만 일시적으로
          // 실패한 경우다 - 목록을 지우면 방금 확정한 변경 자체가 실패한 것처럼 보인다. 기존
          // 목록은 그대로 두고 경고만 남긴다(AdminChecklistTemplatesClient가 data/loadError를
          // 독립적으로 렌더링하므로 목록과 경고가 함께 보인다).
          setLoadError(message);
          return;
        }
        // data를 그대로 두면 에러 배너 아래 이전 목록이 최신인 것처럼 계속 보인다 - 실패했으면
        // 화면에는 에러만 남긴다.
        setData(undefined);
        setLoadError(message);
      });
  }, []);

  // reloadTemplates는 의존성이 없어 재생성되지 않으므로, 이 effect는 최초 마운트 시 한 번만
  // 실행된다(필터/페이지 파라미터가 없는 화면이라 admin/users와 달리 재조회 트리거가 없음) -
  // loading의 초기값이 이미 true라 여기서 다시 설정할 필요가 없다.
  useEffect(() => {
    let cancelled = false;
    reloadTemplates().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [reloadTemplates]);

  const reloadTemplatesAfterMutation = useCallback(
    () => reloadTemplates({ keepDataOnError: true }),
    [reloadTemplates],
  );

  if (loading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <AdminChecklistTemplatesClient data={data} loadError={loadError} onMutated={reloadTemplatesAfterMutation} />
  );
}
