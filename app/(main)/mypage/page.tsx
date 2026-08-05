'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { classifyProfileLoadError, isSessionInvalidError } from '../../lib/sessionErrors';
import { getActivityHistory } from '../../services/activityHistory';
import { getCurrentUser } from '../../services/auth';
import { getChecklistResult, getMyChecklistOverviews } from '../../services/checklist';
import { getProperties } from '../../services/properties';
import { getMyProfile } from '../../services/user';
import {
  type ActivityHistoryItem,
  type ChecklistOverview,
  type ChecklistProgress,
  type PropertySummary,
  type UserProfile,
} from '../../types/domain';
import { AccountUnavailableRedirect } from '../../ui/AccountUnavailableRedirect';
import { MyPageClient } from './MyPageClient';

const emptyProfile: UserProfile = {
  nickname: '',
  email: null,
  profileImageUrl: null,
  interestRegion: null,
  transactionType: null,
  currentStage: null,
  hasPassword: false,
};

type PageData = {
  nickname: string;
  activityHistory: ActivityHistoryItem[];
  activityHistoryLoadError?: string;
  properties: PropertySummary[];
  propertiesTotalCount: number;
  propertiesLoadError?: string;
  checklistProgressByPropertyId: Record<number, ChecklistProgress>;
  profile: UserProfile;
  profileLoadError?: string;
  profileNotFound: boolean;
};

export default function Page() {
  const router = useRouter();
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let nickname: string;
      try {
        nickname = (await getCurrentUser()).nickname;
      } catch {
        // MainLayoutGate와 동일한 이유로, 세션이 실제로 유효하지 않으면 재로그인 화면으로 보낸다.
        router.push('/login?error=session_expired');
        return;
      }

      // 최근 활동 내역(activityHistory, 특약사항 분석 포함)은 백엔드에 아직 이 엔드포인트가 없어
      // 항상 실패한다(app/services/activityHistory.ts 참고) - ENABLE_ANALYSIS_HISTORY가 꺼져 있어
      // 화면에 드러나지 않으므로 지금은 그대로 둔다.
      let activityHistory: ActivityHistoryItem[] = [];
      let activityHistoryLoadError: string | undefined;
      try {
        activityHistory = await getActivityHistory();
      } catch (error) {
        if (isSessionInvalidError(error)) {
          router.push('/login?error=session_expired');
          return;
        }
        activityHistoryLoadError = '마이페이지 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      }

      let properties: PropertySummary[] = [];
      let propertiesTotalCount = 0;
      let propertiesLoadError: string | undefined;
      try {
        // 홈 화면과 동일한 이유(app/(main)/home/page.tsx 참고)로 최대 페이지 크기(100)만큼 가져온다.
        const propertiesPage = await getProperties(undefined, { size: 100 });
        properties = propertiesPage.items;
        propertiesTotalCount = propertiesPage.totalElements;
      } catch (error) {
        if (isSessionInvalidError(error)) {
          router.push('/login?error=session_expired');
          return;
        }
        propertiesLoadError = '매물 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      }

      const checklistProgressByPropertyId: Record<number, ChecklistProgress> = {};
      try {
        const checklistOverviews = await getMyChecklistOverviews();
        checklistOverviews.forEach((overview) => {
          checklistProgressByPropertyId[overview.propertyId] = { status: overview.status };
        });

        const withResult = checklistOverviews.filter(
          (overview): overview is ChecklistOverview & { checklistId: number } =>
            overview.status !== 'NOT_STARTED' && overview.checklistId !== null,
        );
        try {
          const summaries = await Promise.all(
            withResult.map((overview) => getChecklistResult(overview.checklistId)),
          );
          withResult.forEach((overview, index) => {
            checklistProgressByPropertyId[overview.propertyId] = {
              status: overview.status,
              progressPercent: summaries[index].progressPercent,
              cautionCount: summaries[index].cautionCount,
            };
          });
        } catch (error) {
          if (isSessionInvalidError(error)) {
            router.push('/login?error=session_expired');
            return;
          }
        }
      } catch (error) {
        if (isSessionInvalidError(error)) {
          router.push('/login?error=session_expired');
          return;
        }
      }

      let profile = emptyProfile;
      let profileLoadError: string | undefined;
      let profileNotFound = false;
      try {
        profile = await getMyProfile();
      } catch (error) {
        const classification = classifyProfileLoadError(error);
        if (classification === 'session-invalid') {
          router.push('/login?error=session_expired');
          return;
        }
        if (classification === 'not-found') {
          profileNotFound = true;
        } else {
          profileLoadError = '프로필 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
        }
      }

      if (!cancelled) {
        setData({
          nickname,
          activityHistory,
          activityHistoryLoadError,
          properties,
          propertiesTotalCount,
          propertiesLoadError,
          checklistProgressByPropertyId,
          profile,
          profileLoadError,
          profileNotFound,
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <>
      {data.profileNotFound && <AccountUnavailableRedirect />}
      <MyPageClient
        activityHistory={data.activityHistory}
        activityHistoryLoadError={data.activityHistoryLoadError}
        properties={data.properties}
        propertiesTotalCount={data.propertiesTotalCount}
        propertiesLoadError={data.propertiesLoadError}
        checklistProgressByPropertyId={data.checklistProgressByPropertyId}
        nickname={data.nickname}
        profile={data.profile}
        profileLoadError={data.profileLoadError}
      />
    </>
  );
}
