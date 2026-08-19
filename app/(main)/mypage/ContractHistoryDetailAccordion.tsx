'use client';

import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getContractAnalysisErrorMessage } from '../../lib/contractAnalysisErrors';
import { getContractHistoryClauses } from '../../services/contract-analysis';
import { type ContractClause } from '../../types/domain';
import { ContractClauseAccordionCard } from '../../ui/ContractClauseAccordionCard';

type ContractHistoryDetailAccordionProps = {
  historyId: number;
};

// 이력 항목을 클릭했을 때 그 아래 펼쳐지는 위험 조항 아코디언. contract/result 화면과 달리 챗봇/
// 요약카드/원문 미리보기/보증금·누락항목 탭은 필요 없어 조항 아코디언만 보여준다 - 그래서
// getContractHistoryClauses가 이미 clauses만 뽑아서 돌려준다(나머지 상세 필드는 서비스 계층에서 버림).
export function ContractHistoryDetailAccordion({ historyId }: ContractHistoryDetailAccordionProps) {
  const [clauses, setClauses] = useState<ContractClause[] | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>();
  // 조항 index별 펼침 상태 - ContractResultClient.tsx의 expandedIndices와 동일한 이유(여러 조항을
  // 서로 독립적으로 펼칠 수 있어야 함)로 Set을 쓴다.
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getContractHistoryClauses(historyId)
      .then((result) => {
        if (!cancelled) {
          setClauses(result);
          setLoadError(undefined);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(
            getContractAnalysisErrorMessage(error, '조항 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [historyId]);

  const toggleExpanded = (index: number) => {
    setExpandedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCopy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1500);
    } catch {
      // 클립보드 접근이 막힌 환경(권한 거부, 비보안 컨텍스트 등)에서는 조용히 무시한다.
    }
  };

  if (loadError) {
    return <div className="mt-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{loadError}</div>;
  }

  if (clauses === null) {
    return (
      <div className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-slate-100 bg-white p-6 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin text-teal-600" /> 조항 정보를 불러오고 있어요...
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      {clauses.map((clause, index) => (
        <ContractClauseAccordionCard
          key={index}
          clause={clause}
          isExpanded={expandedIndices.has(index)}
          onToggle={() => toggleExpanded(index)}
          copiedKey={copiedKey}
          onCopy={handleCopy}
          questionCopyKey={`question-${index}`}
          suggestionCopyKey={`suggestion-${index}`}
        />
      ))}
    </div>
  );
}
