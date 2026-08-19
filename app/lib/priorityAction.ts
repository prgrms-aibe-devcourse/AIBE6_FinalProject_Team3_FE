import { type ChecklistOverview, type PriorityAction, type UserCurrentStage } from '../types/domain';

type PriorityActionInput = {
  currentStage: UserCurrentStage | null;
  hasProperty: boolean;
  // getProperties() 조회 자체가 실패했을 때 true. 이 경우 hasProperty(=false)를 그대로 믿으면
  // "매물이 없다"고 단정하게 되어 실제로 매물이 있는 사용자에게 잘못된 안내가 나간다.
  propertiesLoadFailed: boolean;
  checklistOverviews: ChecklistOverview[];
  // "새로고침" CTA용 재시도 콜백. ctaHref를 '/home'(현재 페이지 자신)으로 두면 next/link의
  // 클라이언트 사이드 이동은 같은 라우트라 리마운트를 안 일으켜 재조회가 실제로 안 일어난다 -
  // 그래서 이동 대신 이 콜백으로 직접 재조회를 트리거한다(PriorityActionCard 참고).
  onRetry: () => void;
};

export function getPriorityAction({
  currentStage,
  hasProperty,
  propertiesLoadFailed,
  checklistOverviews,
  onRetry,
}: PriorityActionInput): PriorityAction {
  if (propertiesLoadFailed) {
    return {
      title: '매물 정보를 불러오지 못했어요',
      description: '잠시 후 다시 시도하거나 새로고침해 주세요.',
      ctaLabel: '새로고침',
      ctaHref: '/home',
      onCtaClick: onRetry,
    };
  }

  if (!hasProperty) {
    return currentStage === '자취 처음'
      ? {
          title: '자취가 처음이신가요? 매물을 아직 등록하지 않으셨어요',
          description: '관심 매물을 등록하면 시세 대비 가격과 확인 필요 신호를 바로 확인할 수 있어요.',
          ctaLabel: '매물 검증하기',
          ctaHref: '/properties/register',
        }
      : {
          title: '매물을 아직 등록하지 않으셨어요',
          description: '관심 매물을 등록하고 계약 전 확인할 항목을 순서대로 점검해보세요.',
          ctaLabel: '매물 검증하기',
          ctaHref: '/properties/register',
        };
  }

  if (checklistOverviews.length === 0) {
    // 매물이 있는데(hasProperty === true) 목록이 비어 있다는 건 조회 자체가 실패했다는 뜻이다 —
    // 성공했다면 매물마다 최소 NOT_STARTED 항목이라도 채워져서 온다(ChecklistService.listMyChecklists 참고).
    // 이 상태를 특정 매물의 "시작 전"으로 단정하지 않고, 사실 그대로 새로고침을 안내한다.
    return {
      title: '체크리스트 현황을 불러오지 못했어요',
      description: '잠시 후 다시 시도하거나 새로고침해 주세요.',
      ctaLabel: '새로고침',
      ctaHref: '/home',
      onCtaClick: onRetry,
    };
  }

  const inProgress = checklistOverviews.filter((overview) => overview.status === 'IN_PROGRESS');
  const notStarted = checklistOverviews.filter((overview) => overview.status === 'NOT_STARTED');

  if (inProgress.length === 1) {
    return {
      title: `${inProgress[0].propertyTitle} 체크리스트를 이어서 확인하세요`,
      description: '아직 확인하지 않은 항목이 남아 있어요.',
      ctaLabel: '체크리스트 이어하기',
      ctaHref: `/properties/${inProgress[0].propertyId}/checklist`,
    };
  }

  if (inProgress.length > 1) {
    return {
      title: '진행 중인 체크리스트가 여러 개 있어요',
      description: '확인이 필요한 매물이 여러 곳이에요.',
      ctaLabel: '체크리스트 확인하기',
      ctaHref: '/checklists',
    };
  }

  if (notStarted.length === 1) {
    return {
      title: `${notStarted[0].propertyTitle} 체크리스트를 시작해보세요`,
      description: '현장 방문 시 확인할 항목을 순서대로 기록할 수 있어요.',
      ctaLabel: '체크리스트 시작하기',
      ctaHref: `/properties/${notStarted[0].propertyId}/checklist`,
    };
  }

  if (notStarted.length > 1) {
    return {
      title: '아직 시작하지 않은 체크리스트가 있어요',
      description: '등록한 매물 중 체크리스트를 시작하지 않은 곳이 있어요.',
      ctaLabel: '체크리스트 확인하기',
      ctaHref: '/checklists',
    };
  }

  // notStarted/inProgress가 둘 다 0인데 목록엔 항목이 있다는 건 전부 COMPLETED라는 뜻.
  return {
    title: '등록한 매물의 체크리스트를 모두 확인했어요',
    description: '필요하면 언제든 다시 확인할 수 있어요.',
    ctaLabel: '체크리스트 다시 보기',
    ctaHref: '/checklists',
  };
}
