'use client';

import { ArrowRight, CheckCircle2, FileSearch, PlusCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { quickActionToneMap } from '../data/dashboard';
import { cn } from '../lib/cn';
import { type QuickActionTone } from '../types/domain';
import { Modal } from './Modal';

type OnboardingIntroModalProps = {
  open: boolean;
  onClose: () => void;
};

type IntroStep = {
  title: string;
  description: string;
  icon: typeof PlusCircle;
  tone: QuickActionTone;
};

// 홈 화면 퀵액션 카드(app/data/dashboard.ts)와 아이콘·색상은 맞추되, 설명은 이 모달 전용으로
// 따로 쓴다 - 퀵액션 카드는 계속 노출되는 자리라 짧게 유지하고, 처음 한 번 보여주는 이 안내에서만
// 실제로 어떤 신호/기능이 나오는지 조금 더 구체적으로 풀어 쓴다. 위험 신호 확인(퀵액션 4번째)은
// 매물 등록 이후 아무 때나 둘러볼 수 있는 보조 기능이라 핵심 순서에서는 뺀다.
const introSteps: IntroStep[] = [
  {
    title: '매물 검증하기',
    description:
      '주소와 보증금을 입력하면 국토교통부 실거래가 기준 시세와 비교하고, 허위매물 의심 신호와 전세가율 같은 위험 신호까지 함께 확인할 수 있어요.',
    icon: PlusCircle,
    tone: 'teal',
  },
  {
    title: '현장 체크리스트',
    description: '방문 전후로 확인해야 할 항목을 매물 유형에 맞춰 순서대로 확인하고, 미흡한 부분은 메모로 남길 수 있어요.',
    icon: CheckCircle2,
    tone: 'emerald',
  },
  {
    title: '특약사항 분석',
    description:
      '계약서를 업로드하면 특약사항 중 확인이 필요한 조항을 짚어주고, 어려운 문구는 쉬운 설명으로 풀어드려요. 궁금한 조항은 AI 챗봇에게 바로 추가로 물어볼 수도 있어요.',
    icon: FileSearch,
    tone: 'blue',
  },
];

// 프로필 등록 직후 한 번만 띄우는 사용법 안내 - 진행 상황을 계속 추적하는 위젯이 아니라 그냥
// "이런 순서로 쓰면 됩니다"를 한 번 보여주고 끝나는 정적 안내라, 매물/체크리스트 상태를 따로
// 받지 않는다(ProgressStepper처럼 매물이 느는 것에 따라 다시 나타나거나 라벨이 바뀌지 않음).
export function OnboardingIntroModal({ open, onClose }: OnboardingIntroModalProps) {
  const [stepIndex, setStepIndex] = useState(0);

  // 이 컴포넌트는 open이 false여도 언마운트되지 않고 계속 살아있다(Modal이 내부적으로 null만
  // 반환) - 그래서 다시 열렸을 때 지난번에 몇 번째를 보고 있었는지가 그대로 남아있을 수 있다.
  // 다시 볼 때는 항상 처음부터 보여주는 게 맞는 1회성 안내라 open이 true가 될 때마다 초기화한다.
  useEffect(() => {
    // open이 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과 동일) -
    // 다시 열릴 때 이전 스텝이 잠깐이라도 보이지 않도록 의도적으로 동기 호출한다.
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStepIndex(0);
    }
  }, [open]);

  const step = introSteps[stepIndex];
  const isLastStep = stepIndex === introSteps.length - 1;

  function handleNext() {
    if (isLastStep) {
      onClose();
      return;
    }
    setStepIndex((current) => current + 1);
  }

  function handlePrev() {
    setStepIndex((current) => current - 1);
  }

  return (
    <Modal open={open} onClose={onClose} maxWidthClassName="max-w-md">
      <p className="mb-1 text-xs font-bold text-teal-600">알고계약 시작하기</p>
      <h2 className="mb-5 text-lg font-bold text-slate-950">이런 순서로 이용해보세요</h2>

      <div className="mb-6 flex items-start gap-3">
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
            quickActionToneMap[step.tone],
          )}
        >
          <step.icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-950">
            {stepIndex + 1}. {step.title}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{step.description}</p>
        </div>
      </div>

      <div className="mb-6 flex justify-center gap-1.5">
        {introSteps.map((introStep, index) => (
          <span
            key={introStep.title}
            className={cn('h-1.5 w-1.5 rounded-full', index === stepIndex ? 'bg-teal-600' : 'bg-slate-200')}
          />
        ))}
      </div>

      <div className="flex gap-3">
        {stepIndex > 0 && (
          <button type="button" onClick={handlePrev} className="ansim-button-secondary flex-1 py-3">
            이전
          </button>
        )}
        <button
          type="button"
          onClick={handleNext}
          className="ansim-button-primary flex flex-1 items-center justify-center gap-2 py-3"
        >
          {isLastStep ? '시작하기' : '다음'} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </Modal>
  );
}
