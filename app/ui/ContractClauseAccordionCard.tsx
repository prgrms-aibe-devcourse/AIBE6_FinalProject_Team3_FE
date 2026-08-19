'use client';

import { Check, ChevronDown, Copy, FileText, HelpCircle, MessageSquare } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { type ContractClause } from '../types/domain';
import { Badge } from './Badge';

// contract/result(ContractResultClient.tsx)의 위험 조항 아코디언 카드를 마이페이지 계약분석
// 이력 상세에서도 그대로 재사용하기 위해 뽑아낸 컴포넌트. 이력 상세는 원문(originalText)을
// 저장하지 않아 clause.originalText가 없을 수 있다 - 그 경우 인용구 줄 자체를 생략한다.
// 채팅(미니 챗봇)은 실시간 분석 화면 전용이라 이 컴포넌트에 포함하지 않고, 필요한 쪽(결과 화면)이
// children으로 펼쳐진 영역 맨 아래에 얹는다.
type ContractClauseAccordionCardProps = {
  clause: ContractClause;
  isExpanded: boolean;
  onToggle: () => void;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
  questionCopyKey: string;
  suggestionCopyKey: string;
  children?: ReactNode;
};

export function ContractClauseAccordionCard({
  clause,
  isExpanded,
  onToggle,
  copiedKey,
  onCopy,
  questionCopyKey,
  suggestionCopyKey,
  children,
}: ContractClauseAccordionCardProps) {
  return (
    <div className="ansim-card overflow-hidden border-l-4 border-l-slate-200 transition-all hover:border-l-teal-500">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isExpanded}
        className="flex w-full items-center gap-4 p-6 text-left"
      >
        <Badge className={`shrink-0 rounded border ${clause.levelColor}`}>{clause.levelLabel}</Badge>
        {clause.originalText && (
          <p className="flex-1 text-sm italic text-slate-700">
            <span aria-hidden="true">&quot;</span>
            {clause.originalText}
            <span aria-hidden="true">&quot;</span>
          </p>
        )}
        <ChevronDown
          className={cn('h-5 w-5 shrink-0 text-slate-400 transition-transform', isExpanded && 'rotate-180')}
        />
      </button>

      {isExpanded && (
        <div className="border-t border-slate-100 p-6">
          <div>
            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-950">
              <MessageSquare className="h-4 w-4 text-teal-600" /> 설명
            </h4>
            <p className="text-sm leading-relaxed text-slate-600">{clause.explanation}</p>
          </div>
          <div className="mt-8 rounded-xl border border-teal-100 bg-teal-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-bold text-teal-950">중개사에게 이렇게 확인해 보세요</span>
            </div>
            <p className="mb-4 text-sm text-teal-800">
              <span aria-hidden="true">&quot;</span>
              {clause.question}
              <span aria-hidden="true">&quot;</span>
            </p>
            <button
              type="button"
              onClick={() => onCopy(questionCopyKey, clause.question)}
              className="flex items-center gap-2 text-xs font-bold text-teal-700"
            >
              {copiedKey === questionCopyKey ? (
                <>
                  <Check className="h-3 w-3" /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> 질문 문구 복사하기
                </>
              )}
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" />
              <span className="text-sm font-bold text-slate-950">수정 요청 문구 예시</span>
            </div>
            <p className="mb-4 text-sm text-slate-700">
              <span aria-hidden="true">&quot;</span>
              {clause.suggestedText}
              <span aria-hidden="true">&quot;</span>
            </p>
            <button
              type="button"
              onClick={() => onCopy(suggestionCopyKey, clause.suggestedText)}
              className="flex items-center gap-2 text-xs font-bold text-slate-600"
            >
              {copiedKey === suggestionCopyKey ? (
                <>
                  <Check className="h-3 w-3" /> 복사됨
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> 문구 복사하기
                </>
              )}
            </button>
          </div>

          {children}
        </div>
      )}
    </div>
  );
}
