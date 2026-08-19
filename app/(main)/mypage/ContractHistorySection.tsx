'use client';

import { ChevronDown, ChevronLeft, ChevronRight, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { cn } from '../../lib/cn';
import { getMyContractHistory } from '../../services/contract-analysis';
import { type ContractHistoryPage } from '../../types/domain';
import { Badge } from '../../ui/Badge';
import { ContractHistoryDetailAccordion } from './ContractHistoryDetailAccordion';

// BE 기본값(20)과 별개로, 목록 화면 UI상 한 섹션에 보여줄 카드 개수는 FE가 정한다
// (checklists/page.tsx의 PAGE_SIZE와 동일 패턴).
const PAGE_SIZE = 5;

const emptyPage: ContractHistoryPage = {
  items: [],
  page: 0,
  size: PAGE_SIZE,
  totalElements: 0,
  totalPages: 0,
  hasNext: false,
};

// 항목을 클릭하면 그 아래 위험 조항 아코디언이 펼쳐진다(ContractHistoryDetailAccordion) - 원문을
// 저장하지 않는 정책이라 별도 상세 "화면"으로 이동할 상세 내용 자체는 없고, 조항 설명/확인 질문/
// 수정 요청 문구만 그 자리에서 보여준다. 한 번에 하나의 항목만 펼칠 수 있다(expandedHistoryId).
// 마이페이지 전체를 재구성하지 않도록, 이 섹션이 자체 page state로 자신의 데이터만 따로 불러온다
// (checklists/page.tsx처럼 URL 쿼리 파라미터를 쓰지 않음 - 마이페이지 전체 URL을 이 섹션 하나의
// 페이지네이션에 묶고 싶지 않아서).
export function ContractHistorySection() {
  const [page, setPage] = useState(0);
  const [historyPage, setHistoryPage] = useState<ContractHistoryPage>(emptyPage);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    // page가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과 동일) -
    // 페이지 변경 시 새 로딩 상태를 보여줘야 하므로 의도적으로 동기 호출한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);

    getMyContractHistory({ page, size: PAGE_SIZE })
      .then((result) => {
        if (!cancelled) {
          setHistoryPage(result);
          setLoadError(undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('계약분석 이력을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page]);

  const { items, totalPages, hasNext } = historyPage;

  const toggleExpanded = (id: number) => {
    setExpandedHistoryId((current) => (current === id ? null : id));
  };

  return (
    <div className="mb-8">
      <h2 className="mb-4 text-lg font-bold text-slate-950">계약분석 이력</h2>

      {loadError && (
        <div className="ansim-card mb-4 border-red-100 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          {!loadError && items.length === 0 && (
            <div className="ansim-card p-6 text-center text-sm text-slate-500">아직 분석한 특약사항이 없어요.</div>
          )}

          {items.length > 0 && (
            <div className="space-y-3">
              {items.map((item) => {
                const isExpanded = expandedHistoryId === item.id;
                return (
                  <div key={item.id} className="ansim-card overflow-hidden p-4">
                    <button
                      type="button"
                      onClick={() => toggleExpanded(item.id)}
                      aria-expanded={isExpanded}
                      className="w-full text-left"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                          {item.inputType === 'IMAGE' ? (
                            <ImageIcon className="h-3.5 w-3.5" />
                          ) : (
                            <FileText className="h-3.5 w-3.5" />
                          )}
                          {item.inputType === 'IMAGE' ? '이미지 입력' : '텍스트 입력'}
                        </div>
                        <span className="text-xs text-slate-400">{item.createdAt}</span>
                      </div>
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm text-slate-700">{item.summary}</p>
                        <ChevronDown
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform',
                            isExpanded && 'rotate-180',
                          )}
                        />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Badge className="bg-slate-100 text-slate-600">조항 {item.clauseCount}개</Badge>
                        <Badge
                          className={
                            item.riskCount > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                          }
                        >
                          확인 필요 {item.riskCount}개
                        </Badge>
                      </div>
                    </button>

                    {isExpanded && <ContractHistoryDetailAccordion historyId={item.id} />}
                  </div>
                );
              })}
            </div>
          )}

          {!loadError && totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-4">
              {page > 0 ? (
                <button
                  type="button"
                  onClick={() => setPage((current) => current - 1)}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  <ChevronLeft className="h-4 w-4" /> 이전
                </button>
              ) : (
                <span className="flex items-center gap-1 rounded-xl border border-slate-100 px-4 py-2 text-sm font-bold text-slate-300">
                  <ChevronLeft className="h-4 w-4" /> 이전
                </span>
              )}
              <span className="text-sm text-slate-500">
                {page + 1} / {totalPages} 페이지
              </span>
              {hasNext ? (
                <button
                  type="button"
                  onClick={() => setPage((current) => current + 1)}
                  className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                >
                  다음 <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <span className="flex items-center gap-1 rounded-xl border border-slate-100 px-4 py-2 text-sm font-bold text-slate-300">
                  다음 <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
