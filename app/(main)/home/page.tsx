'use client';

import { AlertTriangle, ArrowRight, FileSearch, Link2, Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { quickActions, quickActionToneMap } from '../../data/dashboard';
import { computeHomeSummaryCounts } from '../../lib/homeSummary';
import { getPriorityAction } from '../../lib/priorityAction';
import { classifyProfileLoadError, isSessionInvalidError } from '../../lib/sessionErrors';
import { getActivityHistory } from '../../services/activityHistory';
import { getChecklistResult, getMyChecklistOverviews } from '../../services/checklist';
import { getProperties } from '../../services/properties';
import { getMyProfile } from '../../services/user';
import {
  type ActivityHistoryItem,
  type ChecklistOverview,
  type PropertySummary,
  type UserProfile,
} from '../../types/domain';
import { AccountUnavailableRedirect } from '../../ui/AccountUnavailableRedirect';
import { ChecklistProgressWidget } from '../../ui/ChecklistProgressWidget';
import { NoticeBox } from '../../ui/NoticeBox';
import { PriorityActionCard } from '../../ui/PriorityActionCard';

const emptyProfile: UserProfile = {
  nickname: '',
  email: null,
  profileImageUrl: null,
  interestRegion: null,
  transactionType: null,
  currentStage: null,
  hasPassword: false,
};

type ChecklistProgressEntry = {
  propertyId: number;
  propertyTitle: string;
  progressPercent: number;
  cautionCount: number;
};

type PageData = {
  loadError?: string;
  profileNotFound: boolean;
  profile: UserProfile;
  properties: PropertySummary[];
  propertiesTotalCount: number;
  propertiesLoadFailed: boolean;
  activityHistory: ActivityHistoryItem[];
  checklistOverviews: ChecklistOverview[];
  checklistProgressEntries: ChecklistProgressEntry[];
};

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const notice = searchParams.get('notice') ?? undefined;
  const [data, setData] = useState<PageData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      let loadError: string | undefined;
      let profileNotFound = false;

      let profile = emptyProfile;
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
          // 실패 시 개인화 우선순위 카드는 미등록 상태 기준으로 표시하고, 아래 배너로 실패 사실을 알린다.
          loadError = '일부 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
        }
      }

      let properties: PropertySummary[] = [];
      let propertiesTotalCount = 0;
      let propertiesLoadFailed = false;
      try {
        // 백엔드가 허용하는 최대 페이지 크기(100, PropertyController@PageableDefault 검증 로직 참고)만큼
        // 한 번에 가져온다. interestedPropertyCount/hasProperty는 아래에서 totalElements를 쓰므로
        // 매물이 100개를 넘어도 정확하지만, "중요 확인사항" 위젯(signalProperties)과 신호/체크리스트
        // 기반 카운트는 이 items 배열(최대 100개, createdAt DESC)만 보므로 101번째 이후 오래된 매물의
        // 신호는 반영되지 않는다. 실사용 규모상 무시 가능하다고 판단해 별도 페이지 순회는 하지 않는다.
        const propertiesPage = await getProperties(undefined, { size: 100 });
        properties = propertiesPage.items;
        propertiesTotalCount = propertiesPage.totalElements;
      } catch (error) {
        if (isSessionInvalidError(error)) {
          router.push('/login?error=session_expired');
          return;
        }
        // 실패 시 "매물이 없다"고 단정하지 않도록 propertiesLoadFailed로 별도 표시하고,
        // 아래 배너로도 실패 사실을 알린다.
        propertiesLoadFailed = true;
        loadError = '일부 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      }

      let activityHistory: ActivityHistoryItem[] = [];
      try {
        activityHistory = await getActivityHistory();
      } catch (error) {
        if (isSessionInvalidError(error)) {
          router.push('/login?error=session_expired');
          return;
        }
        // 백엔드에 이 엔드포인트가 아직 없어 항상 실패한다(app/services/activityHistory.ts 참고) -
        // 일시적 오류가 아니라 상시 상태라 배너로 알리지 않고, 분석한 특약사항 카운트/알림만 조용히
        // 빈 상태로 둔다. 엔드포인트가 실제로 생기면 이 catch에서도 loadError를 다시 세팅할 것.
      }

      let checklistOverviews: ChecklistOverview[] = [];
      try {
        checklistOverviews = await getMyChecklistOverviews();
      } catch (error) {
        if (isSessionInvalidError(error)) {
          router.push('/login?error=session_expired');
          return;
        }
        // 실패 시 개인화 우선순위 카드는 "불러오지 못함" 상태로 표시하고, 아래 배너로도 실패 사실을 알린다.
        loadError = '일부 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
      }

      let checklistProgressEntries: ChecklistProgressEntry[] = [];
      try {
        const inProgressChecklists = checklistOverviews.filter(
          (overview): overview is ChecklistOverview & { checklistId: number } =>
            overview.status === 'IN_PROGRESS' && overview.checklistId !== null,
        );
        checklistProgressEntries = await Promise.all(
          inProgressChecklists.map(async (overview) => {
            const summary = await getChecklistResult(overview.checklistId);
            return {
              propertyId: overview.propertyId,
              propertyTitle: overview.propertyTitle,
              progressPercent: summary.progressPercent,
              cautionCount: summary.cautionCount,
            };
          }),
        );
      } catch (error) {
        if (isSessionInvalidError(error)) {
          router.push('/login?error=session_expired');
          return;
        }
      }

      if (!cancelled) {
        setData({
          loadError,
          profileNotFound,
          profile,
          properties,
          propertiesTotalCount,
          propertiesLoadFailed,
          activityHistory,
          checklistOverviews,
          checklistProgressEntries,
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

  const hasProperty = data.propertiesTotalCount > 0;

  const priorityAction = getPriorityAction({
    currentStage: data.profile.currentStage,
    hasProperty,
    propertiesLoadFailed: data.propertiesLoadFailed,
    checklistOverviews: data.checklistOverviews,
  });

  const summaryCounts = {
    ...computeHomeSummaryCounts(data.properties, data.activityHistory, data.checklistOverviews),
    // items(최대 100개)가 아니라 totalElements 기준 - 매물이 100개를 넘어도 정확한 값을 보여준다.
    interestedPropertyCount: data.propertiesTotalCount,
  };
  const signalProperties = data.properties.filter((property) => (property.checkSignalCount ?? 0) > 0);
  const specialTermsAlerts = data.activityHistory.filter((item) => item.type === '특약사항 분석');

  return (
    <div className="container mx-auto max-w-5xl px-4 py-6 md:py-10">
      {data.profileNotFound && <AccountUnavailableRedirect />}

      <div className="mb-8">
        <h1 className="ansim-page-title mb-2">계약 전 확인할 항목을 정리했어요</h1>
        <p className="ansim-page-description">
          매물 가격, 보증금 안전성, 현장 확인, 특약사항 분석을 순서대로 점검하세요.
        </p>
      </div>

      {notice === 'account_linked' && (
        <div className="ansim-card mb-8 flex items-start gap-2 border-teal-100 bg-teal-50 p-4 text-sm text-teal-800">
          <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
          <span>이미 가입되어 있던 계정과 자동으로 연결되었어요.</span>
        </div>
      )}

      {data.loadError && (
        <div className="ansim-card mb-8 border-red-100 bg-red-50 p-4 text-sm text-red-700">{data.loadError}</div>
      )}

      <PriorityActionCard action={priorityAction} />

      <div className="mb-10 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.title}
            href={action.to}
            className="ansim-card group p-4 transition-all hover:border-teal-200 hover:bg-teal-50/30 md:p-6"
          >
            <div
              className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${quickActionToneMap[action.tone]}`}
            >
              <action.icon className="h-6 w-6" />
            </div>
            <h3 className="mb-1 font-bold text-slate-950">{action.title}</h3>
            <p className="text-xs leading-relaxed text-slate-600 md:text-sm">{action.description}</p>
          </Link>
        ))}
      </div>

      <div className="ansim-card mb-10 bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-950">요약 정보</h2>
          <Link href="/mypage" className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-950">
            전체보기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            ['관심 매물', `${summaryCounts.interestedPropertyCount}개`],
            ['확인 필요 신호', `${summaryCounts.signalsToCheckCount}개`],
            ['진행 중 체크리스트', `${summaryCounts.activeChecklistCount}개`],
            ['분석한 특약사항', `${summaryCounts.analyzedSpecialTermsCount}건`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="mb-1 text-sm text-slate-500">{label}</p>
              <p className="text-2xl font-bold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {data.checklistProgressEntries.length > 0 && (
        <div className="mb-10 space-y-4">
          {data.checklistProgressEntries.map((entry) => (
            <ChecklistProgressWidget
              key={entry.propertyId}
              propertyTitle={entry.propertyTitle}
              progressPercent={entry.progressPercent}
              cautionCount={entry.cautionCount}
              href={`/properties/${entry.propertyId}/checklist`}
            />
          ))}
        </div>
      )}

      <div className="mb-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <h2 className="text-lg font-bold text-slate-950">중요 확인사항</h2>
          {signalProperties.length === 0 && specialTermsAlerts.length === 0 && (
            <div className="ansim-card p-4 text-sm text-slate-500">확인이 필요한 사항이 없습니다.</div>
          )}
          {signalProperties.map((property) => (
            <Link
              key={property.id}
              href={`/properties/${property.id}`}
              className="flex items-start gap-4 rounded-xl border border-orange-100 bg-orange-50 p-4 transition hover:bg-orange-100/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-100">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="mb-1 font-bold text-orange-950">
                  {property.title} 확인 필요 신호 {property.checkSignalCount}개
                </p>
                <p className="text-sm leading-relaxed text-orange-800">{property.signalSummary}</p>
              </div>
            </Link>
          ))}
          {specialTermsAlerts.map((item) => (
            <Link
              key={`${item.title}-${item.type}`}
              href="/mypage"
              className="flex items-start gap-4 rounded-xl border border-red-100 bg-red-50 p-4 transition hover:bg-red-100/60"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <FileSearch className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="mb-1 font-bold text-red-950">{item.title} 특약사항 확인 필요</p>
                <p className="text-sm leading-relaxed text-red-800">{item.status}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <NoticeBox icon={AlertTriangle} iconClassName="text-orange-500">
        <span className="font-bold">안내:</span> 위험 신호는 확정 판단이 아니라 공공데이터와 입력 정보를 바탕으로 한
        참고용 설명입니다. 실제 계약 전에는 등기부등본, 보증보험 가능 여부, 전문가 검토를 함께 확인하세요.
      </NoticeBox>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
