'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, HelpCircle, Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { checklistCategories as categories } from '../../../../data/checklist';
import { ApiError, isSessionInvalidErrorCode } from '../../../../lib/api/http';
import { type ChecklistSummary } from '../../../../lib/checklistSummary';
import { cn } from '../../../../lib/cn';
import { getChecklistResult, updateChecklistItem } from '../../../../services/checklist';
import { type ChecklistItemUpdateRequestDto } from '../../../../types/api';
import { type Checklist, type ChecklistItem, type PropertyDetail } from '../../../../types/domain';
import { Badge } from '../../../../ui/Badge';
import { Modal } from '../../../../ui/Modal';
import { NoticeBox } from '../../../../ui/NoticeBox';

const EMPTY_SUMMARY: ChecklistSummary = {
  progressPercent: 0,
  missingRequiredCount: 0,
  cautionCount: 0,
  hasStarted: false,
};

// helperText 안의 **텍스트**만 굵게 렌더링한다. 서버가 보내는 문자열에 마크다운 스타일 표시만
// 넣으면 되고, 그 외 나머지는 일반 텍스트(줄바꿈 포함)로 그대로 둔다.
function renderWithBold(text: string) {
  return text.split(/(\*\*.+?\*\*)/g).map((part, index) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={index} className="font-semibold text-slate-900">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

type ChecklistClientProps = {
  propertyId: number;
  checklist?: Checklist;
  initialSummary?: ChecklistSummary;
  loadError?: string;
  property?: PropertyDetail;
};

export function ChecklistClient({ propertyId, checklist, initialSummary, loadError, property }: ChecklistClientProps) {
  const router = useRouter();
  const [items, setItems] = useState<ChecklistItem[]>(checklist?.items ?? []);
  const [summary, setSummary] = useState<ChecklistSummary>(initialSummary ?? EMPTY_SUMMARY);
  const [activeCategory, setActiveCategory] = useState(categories[0].id);
  const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
  const [helperItemId, setHelperItemId] = useState<number | null>(null);
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const openHelperRef = useRef<HTMLSpanElement | null>(null);

  const checklistId = checklist?.id;
  const activeItems = items.filter((item) => item.category === activeCategory);
  const uncheckedCount = items.filter((item) => !item.checked).length;

  useEffect(() => {
    if (helperItemId === null) {
      return;
    }
    function handleClickOutside(event: MouseEvent) {
      if (openHelperRef.current && !openHelperRef.current.contains(event.target as Node)) {
        setHelperItemId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [helperItemId]);

  async function applyUpdate(
    item: ChecklistItem,
    patch: Partial<ChecklistItem>,
    request: ChecklistItemUpdateRequestDto,
  ) {
    if (!checklistId) {
      return;
    }

    setItems((currentItems) =>
      currentItems.map((current) => (current.id === item.id ? { ...current, ...patch } : current)),
    );
    setItemErrors((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });

    try {
      const updated = await updateChecklistItem(checklistId, item.id, request);
      setItems((currentItems) => currentItems.map((current) => (current.id === item.id ? updated : current)));

      try {
        setSummary(await getChecklistResult(checklistId));
      } catch {
        // 결과 재조회 실패는 문항 저장 자체와는 무관하므로 조용히 무시한다 (다음 변경 때 다시 시도됨).
      }
    } catch (submitError) {
      // requestJson()이 브라우저 컨텍스트에서 401 → refresh → 원 요청 1회 재시도를 자동으로
      // 처리하므로(app/lib/api/http.ts 참고), 정상 케이스(refresh 성공)는 이 catch까지 401이 아예
      // 올라오지 않는다. 이 분기가 실제로 타는 건 refresh까지 실패한 경우뿐인데, 그중
      // 'rejected'(진짜 무효)는 requestJson()이 이미 /auth/session-recover로 페이지 이동시켜버려서
      // 이 컴포넌트 코드가 실행될 새도 없이 화면을 벗어난다. 그러니 여기 남는 건 사실상
      // 'unreachable'(네트워크 오류/백엔드 일시 장애)뿐이다 — 이때는 세션이 진짜 무효인지 알 수
      // 없으므로 재로그인 화면으로 보내지 않고 일반 에러로만 보여준다(PasswordUpdateFormClient와
      // 동일 패턴).
      if (
        submitError instanceof ApiError &&
        isSessionInvalidErrorCode(submitError.body?.code) &&
        submitError.sessionRefreshOutcome !== 'unreachable'
      ) {
        router.push('/login?error=session_expired');
        return;
      }

      setItems((currentItems) => currentItems.map((current) => (current.id === item.id ? item : current)));
      setItemErrors((current) => ({
        ...current,
        [item.id]:
          submitError instanceof ApiError && submitError.sessionRefreshOutcome === 'unreachable'
            ? '서버와 통신할 수 없습니다. 잠시 후 다시 시도해 주세요.'
            : '저장하지 못했어요. 다시 시도해 주세요.',
      }));
    }
  }

  const handleComplete = (item: ChecklistItem) => {
    if (item.checked && item.userNote === null) {
      // 이미 완료 상태에서 다시 누르면 실수로 누른 걸로 보고 미확인 상태로 되돌린다.
      void applyUpdate(item, { checked: false, userNote: null }, { checked: false });
      return;
    }
    void applyUpdate(item, { checked: true, userNote: null }, { checked: true });
  };

  const handleMarkInsufficient = (item: ChecklistItem, note: string) => {
    void applyUpdate(item, { checked: true, userNote: note }, { userNote: note });
  };

  const handleToggleInsufficient = (item: ChecklistItem) => {
    if (item.userNote !== null) {
      // 이미 미흡 상태에서 다시 누르면 실수로 누른 걸로 보고 미확인 상태로 되돌린다.
      void applyUpdate(item, { checked: false, userNote: null }, { checked: false });
      return;
    }
    handleMarkInsufficient(item, item.userNote ?? '');
  };

  const handleAnswer = (item: ChecklistItem, value: string) => {
    void applyUpdate(item, { checked: true, value }, { value });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="container mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Link href={`/properties/${propertyId}`} className="-ml-2 p-2 text-slate-500 hover:text-slate-950">
              <ArrowLeft className="h-6 w-6" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-950">현장 체크리스트</h1>
              {property && (
                <p className="text-xs text-slate-500">
                  {property.type} · {property.title} · {property.address}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="h-1 w-full bg-slate-100">
          <div
            className="h-full bg-teal-500 transition-all duration-500"
            style={{ width: `${summary.progressPercent}%` }}
          />
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-6">
        {loadError && (
          <div className="ansim-card mb-6 border-red-100 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
        )}

        <div className="ansim-card mb-6 bg-white p-4">
          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">진행률</p>
              <p className="mt-1 font-bold text-slate-950">{summary.progressPercent}%</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-xs text-slate-400">주의 항목</p>
              <p className="mt-1 font-bold text-slate-950">{summary.cautionCount}개</p>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-slate-500">
            {summary.hasStarted
              ? `필수 확인 누락 ${summary.missingRequiredCount}개`
              : (summary.message ?? '체크리스트를 시작해보세요')}
          </p>
        </div>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                'ansim-filter-pill flex items-center gap-2',
                activeCategory === category.id ? 'bg-slate-950 text-white' : 'ansim-filter-pill-muted',
              )}
            >
              <category.icon className="h-4 w-4" />
              {category.name}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {activeItems.map((item) => (
            <div
              key={item.id}
              className={cn(
                'ansim-card overflow-visible bg-white p-4',
                item.issueFound && 'border-orange-200 bg-orange-50/40',
              )}
            >
              <div className="mb-1 flex items-start gap-2">
                {item.importance === 'required' && (
                  <Badge className="mt-0.5 shrink-0 bg-slate-900 text-white">필수</Badge>
                )}
                <p className="flex items-start gap-1 font-medium leading-relaxed text-slate-900">
                  {item.content}
                  {item.helperText && (
                    <span
                      ref={helperItemId === item.id ? openHelperRef : undefined}
                      className="relative inline-block shrink-0"
                    >
                      <button
                        type="button"
                        onClick={() => setHelperItemId((current) => (current === item.id ? null : item.id))}
                        className="mt-0.5 text-slate-400 hover:text-slate-600"
                        aria-label="쉬운 설명 보기"
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                      </button>
                      {helperItemId === item.id && (
                        <span className="absolute left-0 top-full z-10 mt-2 w-64 max-w-[80vw] whitespace-pre-line rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal leading-relaxed text-slate-600 shadow-lg">
                          <span className="absolute -top-[5px] left-2 h-2.5 w-2.5 rotate-45 border-l border-t border-slate-200 bg-white" />
                          {renderWithBold(item.helperText)}
                        </span>
                      )}
                    </span>
                  )}
                </p>
              </div>
              {item.guideText && <p className="mb-3 text-xs text-slate-500">{item.guideText}</p>}

              {item.itemType === 'check' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleComplete(item)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-bold transition',
                        item.checked && item.userNote === null
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      완료
                    </button>
                    <button
                      onClick={() => handleToggleInsufficient(item)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-bold transition',
                        item.userNote !== null
                          ? 'border-orange-200 bg-orange-50 text-orange-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      미흡
                    </button>
                  </div>
                  {item.userNote !== null && (
                    <textarea
                      key={item.id}
                      defaultValue={item.userNote}
                      onBlur={(event) => handleMarkInsufficient(item, event.target.value)}
                      placeholder="어떤 점이 미흡했나요? (선택)"
                      rows={2}
                      maxLength={255}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    />
                  )}
                </div>
              )}

              {item.itemType === 'yesNo' && (
                <div className="grid grid-cols-2 gap-2">
                  {(['Y', 'N'] as const).map((option) => (
                    <button
                      key={option}
                      onClick={() => handleAnswer(item, option)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-bold transition',
                        item.value === option
                          ? 'border-teal-200 bg-teal-50 text-teal-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      {option === 'Y' ? '예' : '아니오'}
                    </button>
                  ))}
                </div>
              )}

              {item.itemType === 'date' && (
                <input
                  type="date"
                  value={item.value ?? ''}
                  onChange={(event) => handleAnswer(item, event.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              )}

              {item.itemType === 'documentRequest' && (
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['PROVIDED', '제공받음'],
                      ['NOT_PROVIDED', '미제공'],
                    ] as const
                  ).map(([option, label]) => (
                    <button
                      key={option}
                      onClick={() => handleAnswer(item, option)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-bold transition',
                        item.value === option
                          ? 'border-teal-200 bg-teal-50 text-teal-700'
                          : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {itemErrors[item.id] && <p className="mt-2 text-xs text-red-600">{itemErrors[item.id]}</p>}
            </div>
          ))}
        </div>

        {uncheckedCount > 0 && (
          <p className="mt-6 text-center text-xs text-slate-400">
            아직 확인하지 않은 항목이 {uncheckedCount}개 남았어요 (일반 항목 포함 전체 확인 시 완료 가능)
          </p>
        )}

        <div className={cn('flex flex-col gap-3 md:flex-row', uncheckedCount > 0 ? 'mt-2' : 'mt-6')}>
          <button
            type="button"
            disabled={summary.progressPercent < 100}
            onClick={() => setIsCompleteModalOpen(true)}
            className="ansim-button-primary flex-1 px-5 py-3 disabled:cursor-not-allowed disabled:opacity-40"
          >
            체크리스트 완료
          </button>

          <Link
            href="/contract/upload"
            className="ansim-button-secondary flex flex-1 items-center justify-center gap-2 px-5 py-3"
          >
            특약사항도 AI로 분석해보세요 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <NoticeBox icon={Info} iconClassName="text-slate-400" className="mt-6">
          {summary.disclaimer ?? '체크리스트 결과는 점수나 안전 등급이 아닙니다.'} 확인한 항목과 주의가 필요한 항목을
          정리하는 참고용 기록이며, 실제 계약 전 등기부등본과 보증보험 가능 여부를 함께 확인하세요.
        </NoticeBox>
      </div>

      <Modal open={isCompleteModalOpen} onClose={() => setIsCompleteModalOpen(false)}>
        <h2 className="mb-2 text-lg font-bold text-slate-950">정말로 체크 다 하셨나요?</h2>
        <p className="mb-5 text-sm text-slate-500">
          현장에서 직접 확인한 내용이 맞는지 다시 한 번 확인해 주세요. 확인 후에는 홈으로 이동해요.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setIsCompleteModalOpen(false)}
            className="ansim-button-secondary flex-1 py-3"
          >
            취소
          </button>
          <button type="button" onClick={() => router.push('/home')} className="ansim-button-primary flex-1 py-3">
            확인
          </button>
        </div>
      </Modal>
    </div>
  );
}
