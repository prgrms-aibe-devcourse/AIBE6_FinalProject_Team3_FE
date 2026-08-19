'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { contractTabs, depositSafetyActions } from '../../../data/contract-analysis';
import { apiStatusToneClassMap, getJeonseRatioTone, riskSignalTypeMeta } from '../../../data/risk-analysis';
import { getContractAnalysisErrorMessage } from '../../../lib/contractAnalysisErrors';
import { analyzeContract, sendContractClauseQuestion } from '../../../services/contract-analysis';
import { getDepositSafety, getRiskSignals } from '../../../services/risk-analysis';
import { type ContractChatMessage, type ContractInputType, type ContractOcrUncertainField } from '../../../types/api';
import {
  type ContractAnalysisResult,
  type ContractAnalysisTab,
  type ContractClause,
  type ContractSummaryCard,
  type DepositSafetyCheck,
  type RiskSignalList,
} from '../../../types/domain';
import { Badge } from '../../../ui/Badge';
import { ContractClauseAccordionCard } from '../../../ui/ContractClauseAccordionCard';
import { NoticeBox } from '../../../ui/NoticeBox';
import { SummaryCard } from '../../../ui/SummaryCard';

// 조항 카드 하나 안의 미니 채팅 대화 한 턴. 응답의 aiGeneratedNotice/disclaimer는 매 턴마다 반복
// 표시하지 않고(채팅 섹션 상단에 고정 문구 한 번만 표시), 턴별로 저장하지도 않는다.
// answer가 null이면 질문은 이미 보냈고 응답을 기다리는 중이라는 뜻 - 그 자리에 로딩을 표시한다.
type ClauseChatEntry = {
  question: string;
  answer: string | null;
};

type ClauseChatState = {
  input: string;
  history: ClauseChatEntry[];
  error?: string;
};

const EMPTY_CHAT_STATE: ClauseChatState = { input: '', history: [] };

// 화면 표시 전용 정리 - 실제 분석/재제출에 쓰이는 원본 maskedText는 절대 건드리지 않는다.
// OCR로 추출된 텍스트는 원본 문서의 줄바꿈을 그대로 따라가서 문장 중간에 어색하게 끊기는 경우가
// 많아, 너무 짧은 줄은 다음 줄과 이어붙이고 빈 괄호/연속 빈 줄 같은 잡음만 걷어낸다.
const SHORT_LINE_MERGE_THRESHOLD = 5;

function formatMaskedTextForDisplay(text: string): string {
  const lines = text
    .split('\n')
    // 마스킹 후 남은 빈 괄호("( )", "（　）" 등) 같은 의미 없는 잔여물을 제거.
    .map((line) => line.replace(/[（(]\s*[）)]/g, '').trim());

  const mergedLines: string[] = [];
  let carry = '';

  for (const line of lines) {
    if (line.length === 0) {
      if (carry) {
        mergedLines.push(carry);
        carry = '';
      }
      // 연속된 빈 줄은 하나의 문단 구분으로만 남기고 나머지는 접는다.
      if (mergedLines.length > 0 && mergedLines[mergedLines.length - 1] !== '') {
        mergedLines.push('');
      }
      continue;
    }

    const combined = carry ? `${carry} ${line}` : line;
    if (combined.length <= SHORT_LINE_MERGE_THRESHOLD) {
      // 아직도 너무 짧으면 다음 줄까지 계속 이어붙인다.
      carry = combined;
    } else {
      mergedLines.push(combined);
      carry = '';
    }
  }
  if (carry) {
    mergedLines.push(carry);
  }

  while (mergedLines.length > 0 && mergedLines[0] === '') {
    mergedLines.shift();
  }
  while (mergedLines.length > 0 && mergedLines[mergedLines.length - 1] === '') {
    mergedLines.pop();
  }

  return mergedLines.join('\n');
}

const UNCERTAIN_FIELDS_PREVIEW_COUNT = 5;

// 화면 표시 전용 필터 - 백엔드 uncertainFields 데이터 자체는 건드리지 않는다. 글자 하나뿐이거나
// 마침표/괄호/체크박스 기호/슬래시 등 순수 기호로만 된 항목은 "인식이 애매했다"고 봐도 사용자가
// 확인할 실익이 없어 화면에서만 걸러낸다. \p{L}(문자)/\p{N}(숫자)이 하나도 없으면 순수 기호로 본다.
function isMeaningfulUncertainField(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 1 && /[\p{L}\p{N}]/u.test(trimmed);
}

// "보증금 안전성"/"누락 항목" 탭은 risk-analysis 도메인 API를 쓰는데, 이 API들이 매물 단위라
// propertyId 없이는(=매물 상세를 거치지 않고 직접 접속) 호출할 수 없다. 두 탭에서 동일하게 쓰는
// 안내 카드라 별도 컴포넌트로 뺀다.
function PropertyLinkRequiredNotice() {
  return (
    <div className="ansim-card p-10 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100">
        <Info className="h-7 w-7 text-slate-400" />
      </div>
      <p className="text-sm text-slate-500">매물과 연결하면 확인할 수 있어요.</p>
    </div>
  );
}

function RiskDataLoading() {
  return (
    <div className="ansim-card flex items-center justify-center gap-2 p-10 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" /> 매물 위험 정보를 불러오고 있어요...
    </div>
  );
}

type ContractResultClientProps = {
  maskedText: string;
  maskedCount: number;
  // OCR이 신뢰도 낮게 추출한 구간(이미지 입력 경로에서만 존재). 텍스트 직접 입력 경로는 OCR을
  // 거치지 않으므로 항상 빈 배열이고, 그 경우 이 안내 자체가 보이지 않는다.
  uncertainFields: ContractOcrUncertainField[];
  // 인식된 텍스트 전체가 매우 짧을 때 true(흐린 사진/잘못된 촬영 등). uncertainFields는 특정
  // 구간만 애매하다는 신호라 차분한 톤으로 보여주는 반면, 이건 결과 자체를 신뢰하기 어렵다는
  // 더 강한 신호라 시각적으로 구분해서 강조한다. 텍스트 직접 입력 경로는 항상 false다.
  shortTextWarning: boolean;
  // upload 화면에서 실제로 선택한 입력 경로("TEXT"/"IMAGE") - analyzeContract 요청에 그대로 실어 보낸다.
  inputType: ContractInputType;
  loadError?: string;
  // 매물 상세/체크리스트 화면에서 "계약분석하기"로 넘어온 경우에만 있고(업로드 페이지 ->
  // ContractMaskingReviewPayload -> 이 컴포넌트로 이어짐), 그 외(직접 접속 등)엔 undefined다.
  // analyzeContract 요청에 실어 보내고, "계약 체크리스트로 이동" 버튼은 없으면 숨긴다.
  propertyId?: number;
};

export function ContractResultClient({
  maskedText,
  maskedCount,
  uncertainFields,
  shortTextWarning,
  inputType,
  loadError,
  propertyId,
}: ContractResultClientProps) {
  const [processingStep, setProcessingStep] = useState<'analyzing' | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ContractAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | undefined>();

  const [activeTab, setActiveTab] = useState<ContractAnalysisTab>('risk');
  // 아코디언 그룹은 서로 독립적으로 여러 개 펼칠 수 있어야 해서 boolean 하나가 아니라 펼쳐진
  // index들의 집합으로 관리한다.
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  // 조항 index별로 독립된 채팅 상태를 들고 있는다 - 다른 조항 카드의 대화와 섞이지 않는다.
  const [chatStates, setChatStates] = useState<Record<number, ClauseChatState>>({});
  const [isMaskedTextExpanded, setIsMaskedTextExpanded] = useState(false);
  // "수정하기"는 이제 페이지 이동 없이 이 값을 인라인으로 바꾼다 - analyzeContract는 항상 이 값을 쓴다.
  const [maskedTextValue, setMaskedTextValue] = useState(maskedText);
  const [isEditingMaskedText, setIsEditingMaskedText] = useState(false);
  const [editDraft, setEditDraft] = useState('');
  // 편집 완료 후에는 maskedCount/uncertainFields가 원래 마스킹 시점 값 그대로라 더 이상 정확하지
  // 않다 - 화면에서 숨기거나 "수정됨"으로 대체하기 위한 플래그.
  const [hasEditedMaskedText, setHasEditedMaskedText] = useState(false);
  const [isUncertainFieldsExpanded, setIsUncertainFieldsExpanded] = useState(false);
  // 조항 index별 채팅 이력 스크롤 컨테이너. 아코디언이 접히면(언마운트) ref 콜백이 자동으로 지운다.
  const chatContainerRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // updateChatState가 마지막으로 건드린 index만 기억해뒀다가, 그 조항의 채팅창만 맨 아래로
  // 스크롤한다 - 여러 조항을 동시에 펼쳐놓고 다른 조항 대화를 읽고 있을 때 그쪽까지 끌려
  // 내려가지 않게 하기 위함이다.
  const lastUpdatedChatIndexRef = useRef<number | null>(null);

  // "보증금 안전성"/"누락 항목" 탭용 매물 위험 정보. AI 분석(analyzeContract)과는 독립적인 데이터라
  // propertyId만 있으면 분석 완료 여부와 상관없이 미리 불러온다.
  const [riskSignals, setRiskSignals] = useState<RiskSignalList | null>(null);
  const [depositSafety, setDepositSafety] = useState<DepositSafetyCheck | null>(null);
  const [isLoadingRiskData, setIsLoadingRiskData] = useState(false);
  const [riskDataError, setRiskDataError] = useState<string | undefined>();

  useEffect(() => {
    if (propertyId == null) {
      return;
    }

    let cancelled = false;
    setIsLoadingRiskData(true);
    setRiskDataError(undefined);

    Promise.all([getRiskSignals(propertyId), getDepositSafety(propertyId)])
      .then(([signals, safety]) => {
        if (!cancelled) {
          setRiskSignals(signals);
          setDepositSafety(safety);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setRiskDataError('매물 위험 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRiskData(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId]);

  const undeterminableSignals = useMemo(
    () => riskSignals?.signals.filter((signal) => signal.status === 'undeterminable') ?? [],
    [riskSignals],
  );

  const isAnalyzing = processingStep === 'analyzing';
  // 표시용으로만 정리한 텍스트 - analyzeContract에는 항상 maskedTextValue가 그대로 쓰인다.
  const displayMaskedText = useMemo(() => formatMaskedTextForDisplay(maskedTextValue), [maskedTextValue]);
  const displayableUncertainFields = useMemo(
    () => uncertainFields.filter((field) => isMeaningfulUncertainField(field.text)),
    [uncertainFields],
  );
  const visibleUncertainFields = isUncertainFieldsExpanded
    ? displayableUncertainFields
    : displayableUncertainFields.slice(0, UNCERTAIN_FIELDS_PREVIEW_COUNT);
  const hiddenUncertainFieldsCount = displayableUncertainFields.length - visibleUncertainFields.length;

  const handleStartEdit = () => {
    setEditDraft(displayMaskedText);
    setIsEditingMaskedText(true);
  };

  const handleFinishEdit = () => {
    setMaskedTextValue(editDraft);
    setHasEditedMaskedText(true);
    setIsEditingMaskedText(false);
  };

  // 분석 결과가 이미 있으면 재분석 자체를 막는다 - 안 그러면 다른 조항 카드에서 채팅 응답을
  // 기다리는 도중 재분석이 끝나 chatStates가 초기화되면서 그 응답이 조용히 유실될 수 있다.
  const canAnalyze = !isAnalyzing && !isEditingMaskedText && analysisResult == null;

  const handleAnalyze = async () => {
    if (!canAnalyze) {
      return;
    }

    setAnalysisError(undefined);
    setProcessingStep('analyzing');

    try {
      const result = await analyzeContract(maskedTextValue, true, inputType, propertyId);
      setAnalysisResult(result);
      // riskFlag=true인 첫 조항을 기본으로 펼쳐둔다. (재분석이 막혀있어 이 handleAnalyze는 이제
      // 세션당 최대 한 번만 성공하므로, 아래 chatStates 초기화는 항상 빈 상태 위에서 실행된다.)
      const firstRiskyIndex = result.clauses.findIndex((clause) => clause.riskFlag);
      setExpandedIndices(firstRiskyIndex === -1 ? new Set() : new Set([firstRiskyIndex]));
      setChatStates({});
    } catch (error) {
      setAnalysisError(getContractAnalysisErrorMessage(error, 'AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setProcessingStep(null);
    }
  };

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

  const getChatState = (index: number): ClauseChatState => chatStates[index] ?? EMPTY_CHAT_STATE;

  // 답변 대기 중인(answer가 null인) 항목이 하나라도 있으면 전송 중인 것으로 본다 - 별도 isSending
  // 플래그 없이도 항상 최대 한 개까지만 대기 상태가 존재하도록 보장된다(아래 send 가드 참고).
  const isChatSending = (index: number): boolean => getChatState(index).history.some((entry) => entry.answer === null);

  const updateChatState = (index: number, updater: (current: ClauseChatState) => ClauseChatState) => {
    lastUpdatedChatIndexRef.current = index;
    setChatStates((prev) => ({ ...prev, [index]: updater(prev[index] ?? EMPTY_CHAT_STATE) }));
  };

  // 새 질문/답변이 추가될 때마다(updateChatState 호출 시) 그 조항의 채팅창만 맨 아래로 스크롤한다.
  useEffect(() => {
    const index = lastUpdatedChatIndexRef.current;
    if (index == null) {
      return;
    }
    const container = chatContainerRefs.current.get(index);
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [chatStates]);

  const handleSendChatMessage = async (index: number, clause: ContractClause) => {
    const state = getChatState(index);
    const question = state.input.trim();
    if (!question || isChatSending(index)) {
      return;
    }

    // Backend ContractAnalysisChatMessage는 role/content만 받아서, 완료된 턴 하나(질문+답변)를
    // "user" 메시지와 "assistant" 메시지 2개로 나눠 시간순으로 펼친다.
    const historyForRequest: ContractChatMessage[] = state.history
      .filter((entry): entry is ClauseChatEntry & { answer: string } => entry.answer !== null)
      .flatMap(({ question: q, answer }): ContractChatMessage[] => [
        { role: 'user', content: q },
        { role: 'assistant', content: answer },
      ]);

    // 응답을 기다리지 않고, 질문 말풍선부터 즉시 추가(answer: null = 로딩 표시 중)하고 입력창을 비운다.
    const pendingEntryIndex = state.history.length;
    updateChatState(index, (current) => ({
      ...current,
      input: '',
      error: undefined,
      history: [...current.history, { question, answer: null }],
    }));

    try {
      const response = await sendContractClauseQuestion(
        // 이 화면(result)의 clauses는 항상 analyzeContract 응답에서 온 것이라 originalText가 실제로는
        // 항상 있다 - ContractClause.originalText가 이력 상세(원문 없음) 경로와 타입을 공유하느라
        // optional이라 폴백만 둔다.
        { originalText: clause.originalText ?? '', riskFlag: clause.riskFlag, explanation: clause.explanation },
        question,
        historyForRequest.length > 0 ? historyForRequest : undefined,
      );
      // 방금 추가했던 대기 중 질문 자리에 답변만 채워 넣는다(말풍선을 새로 만들지 않고 그 자리에서 교체).
      updateChatState(index, (current) => ({
        ...current,
        history: current.history.map((entry, entryIndex) =>
          entryIndex === pendingEntryIndex ? { ...entry, answer: response.answer } : entry,
        ),
      }));
    } catch (error) {
      // 실패하면 대기 중이던 질문 말풍선을 없애고, 입력값을 되살려서 재입력 없이 다시 보낼 수 있게 한다.
      updateChatState(index, (current) => ({
        ...current,
        input: question,
        error: getContractAnalysisErrorMessage(error, '답변을 받아오지 못했습니다. 잠시 후 다시 시도해 주세요.'),
        history: current.history.filter((_, entryIndex) => entryIndex !== pendingEntryIndex),
      }));
    }
  };

  const clauses = analysisResult?.clauses ?? [];
  const riskyClauseCount = clauses.filter((clause) => clause.riskFlag).length;
  const referenceClauseCount = clauses.length - riskyClauseCount;
  const suggestionCount = clauses.filter((clause) => clause.suggestedText.trim().length > 0).length;

  const summaryCards: ContractSummaryCard[] = [
    {
      label: 'AI 분석 결과',
      value: riskyClauseCount > 0 ? '확인 필요' : '특이사항 없음',
      tone: riskyClauseCount > 0 ? 'orange' : 'slate',
    },
    { label: '확인 필요 조항', value: `${riskyClauseCount}개`, tone: riskyClauseCount > 0 ? 'orange' : 'slate' },
    { label: '추가 확인 항목', value: `${referenceClauseCount}개`, tone: 'slate' },
    { label: '요청 문구 예시', value: `${suggestionCount}개`, tone: 'slate' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="container mx-auto max-w-4xl px-4 py-10">
        {loadError ? (
          <div className="ansim-card border-red-100 bg-red-50 p-6 text-sm text-red-700">{loadError}</div>
        ) : (
          <div className="ansim-card p-6">
            <h1 className="ansim-page-title mb-2">마스킹된 문구를 확인해주세요</h1>
            <NoticeBox icon={Info} iconClassName="text-teal-600" className="mb-4 bg-teal-50 text-teal-700">
              {hasEditedMaskedText
                ? '직접 수정한 내용이에요. 아래 내용대로 분석을 진행할까요?'
                : maskedCount > 0
                  ? `개인정보로 보이는 항목 ${maskedCount}개를 가렸어요. 아래 내용대로 분석을 진행할까요?`
                  : '분석 요청할 내용이에요. 아래 내용대로 분석을 진행할까요?'}
            </NoticeBox>
            {isEditingMaskedText ? (
              <textarea
                value={editDraft}
                onChange={(event) => setEditDraft(event.target.value)}
                className="ansim-input min-h-48 resize-y whitespace-pre-wrap bg-slate-50 text-slate-700"
              />
            ) : (
              <>
                <div
                  className={`ansim-input whitespace-pre-wrap bg-slate-50 text-slate-700 ${
                    isMaskedTextExpanded ? 'min-h-36' : 'max-h-[200px] overflow-y-auto'
                  }`}
                >
                  {displayMaskedText}
                </div>
                <button
                  type="button"
                  onClick={() => setIsMaskedTextExpanded((prev) => !prev)}
                  className="mt-2 text-xs font-bold text-teal-700 hover:underline"
                >
                  {isMaskedTextExpanded ? '접기' : '전체 보기'}
                </button>
              </>
            )}

            {!hasEditedMaskedText && shortTextWarning && (
              <div className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 p-4">
                <p className="mb-1 flex items-center gap-2 text-sm font-bold text-red-700">
                  <AlertTriangle className="h-4 w-4" /> 인식된 내용이 매우 적어요
                </p>
                <p className="text-sm text-red-700">
                  이미지가 흐리거나 잘못 촬영됐을 수 있어요. 다시 촬영하거나 직접 입력해주세요.
                </p>
              </div>
            )}

            {!hasEditedMaskedText && displayableUncertainFields.length > 0 && (
              <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-orange-700">
                  <AlertCircle className="h-4 w-4" /> 이 부분들은 인식이 애매했어요, 확인해주세요
                </p>
                <ul className="space-y-1">
                  {visibleUncertainFields.map((field) => (
                    <li key={field.index} className="text-sm text-orange-700">
                      · {field.text}
                    </li>
                  ))}
                </ul>
                {hiddenUncertainFieldsCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsUncertainFieldsExpanded(true)}
                    className="mt-2 text-xs font-bold text-orange-700 hover:underline"
                  >
                    {hiddenUncertainFieldsCount}개 더 보기
                  </button>
                )}
              </div>
            )}

            {analysisError && <p className="mt-4 text-sm text-red-600">{analysisError}</p>}

            {isAnalyzing && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-teal-50 p-4 text-sm font-bold text-teal-700">
                <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                <span>AI가 특약사항을 분석하고 있어요. 최대 40초 정도 걸릴 수 있어요...</span>
              </div>
            )}

            <div className="mt-6 flex flex-col gap-4 md:flex-row">
              <button
                type="button"
                disabled={isAnalyzing}
                onClick={isEditingMaskedText ? handleFinishEdit : handleStartEdit}
                className="ansim-button-secondary flex-1 py-4 disabled:pointer-events-none disabled:opacity-50"
              >
                {isEditingMaskedText ? '수정 완료' : '수정하기'}
              </button>
              <button
                type="button"
                disabled={!canAnalyze}
                title={analysisResult != null ? '이미 분석이 완료됐습니다.' : undefined}
                onClick={handleAnalyze}
                className="ansim-button-primary flex-1 py-4 disabled:pointer-events-none disabled:opacity-50"
              >
                {isAnalyzing ? <Loader2 className="h-5 w-5 animate-spin" /> : '이대로 분석 진행'}
              </button>
            </div>
          </div>
        )}
      </div>

      {analysisResult && (
        <>
          <div className="border-b border-slate-200 bg-white pb-10 pt-8">
            <div className="container mx-auto max-w-6xl px-4">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Badge className="bg-orange-100 px-3 text-orange-700">분석 완료</Badge>
                </div>
                <h2 className="ansim-page-title mb-2">계약서 분석 결과입니다</h2>
                {analysisResult.summary && <p className="ansim-page-description">{analysisResult.summary}</p>}
              </div>

              <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-4">
                {summaryCards.map(({ label, value, tone }) => (
                  <SummaryCard
                    key={label}
                    label={label}
                    value={value}
                    tone={tone === 'orange' ? 'orange' : 'default'}
                  />
                ))}
              </div>

              {(analysisResult.aiGeneratedNotice || analysisResult.disclaimer) && (
                <NoticeBox icon={Info} iconClassName="text-slate-500" className="mt-6 bg-slate-100 text-slate-600">
                  {[analysisResult.aiGeneratedNotice, analysisResult.disclaimer].filter(Boolean).join(' ')}
                </NoticeBox>
              )}
            </div>
          </div>

          <div className="container mx-auto max-w-4xl space-y-8 px-4 py-10">
            <div className="flex w-fit gap-1 rounded-xl bg-slate-200/50 p-1">
              {contractTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition-all md:px-6 ${
                    activeTab === tab.key ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'risk' && (
              <div className="space-y-6">
                {clauses.map((item, index) => {
                  const isExpanded = expandedIndices.has(index);
                  return (
                    <ContractClauseAccordionCard
                      key={index}
                      clause={item}
                      isExpanded={isExpanded}
                      onToggle={() => toggleExpanded(index)}
                      copiedKey={copiedKey}
                      onCopy={handleCopy}
                      questionCopyKey={`question-${index}`}
                      suggestionCopyKey={`suggestion-${index}`}
                    >
                      {isExpanded &&
                        (() => {
                          const chatState = getChatState(index);
                          const sending = isChatSending(index);
                          return (
                            <div className="mt-4 rounded-xl border border-slate-100 bg-white p-4">
                              <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-slate-950">
                                <MessageCircle className="h-4 w-4 text-teal-600" /> 더 궁금한 점이 있으신가요?
                              </h4>
                              <p className="mb-3 text-[10px] leading-relaxed text-slate-400">
                                답변은 AI가 생성한 참고용 정보입니다.
                              </p>

                              {chatState.history.length > 0 && (
                                <div
                                  ref={(el) => {
                                    if (el) {
                                      chatContainerRefs.current.set(index, el);
                                    } else {
                                      chatContainerRefs.current.delete(index);
                                    }
                                  }}
                                  className="mb-4 max-h-72 space-y-4 overflow-y-auto"
                                >
                                  {chatState.history.map((entry, entryIndex) => (
                                    <div key={entryIndex} className="space-y-2">
                                      <p className="ml-auto max-w-[85%] rounded-lg bg-teal-600 px-3 py-2 text-sm text-white">
                                        {entry.question}
                                      </p>
                                      {entry.answer === null ? (
                                        <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-500">
                                          <Loader2 className="h-3 w-3 animate-spin" /> 답변을 준비하고 있어요...
                                        </div>
                                      ) : (
                                        <p className="max-w-[85%] rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">
                                          {entry.answer}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}

                              {chatState.error && <p className="mb-2 text-xs text-red-600">{chatState.error}</p>}

                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={chatState.input}
                                  disabled={sending}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    updateChatState(index, (current) => ({ ...current, input: value }));
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                                      event.preventDefault();
                                      void handleSendChatMessage(index, item);
                                    }
                                  }}
                                  placeholder="이 조항에 대해 더 물어보세요"
                                  className="ansim-input flex-1 py-2 text-sm"
                                />
                                <button
                                  type="button"
                                  disabled={sending || chatState.input.trim().length === 0}
                                  onClick={() => handleSendChatMessage(index, item)}
                                  className="ansim-button-primary shrink-0 px-4 py-2 text-sm disabled:pointer-events-none disabled:opacity-50"
                                >
                                  {sending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                    </ContractClauseAccordionCard>
                  );
                })}
              </div>
            )}

            {activeTab === 'deposit' &&
              (propertyId == null ? (
                <PropertyLinkRequiredNotice />
              ) : isLoadingRiskData ? (
                <RiskDataLoading />
              ) : riskDataError ? (
                <div className="ansim-card p-8 text-center text-sm text-red-600">{riskDataError}</div>
              ) : (
                depositSafety && (
                  <div className="ansim-card p-8">
                    <div className="mb-6 flex items-center justify-between">
                      <h3 className="text-lg font-bold text-slate-950">보증금 안전성</h3>
                      {depositSafety.status === 'calculated' && depositSafety.jeonseRatio !== null ? (
                        <Badge
                          className={
                            apiStatusToneClassMap[
                              getJeonseRatioTone(
                                depositSafety.jeonseRatio,
                                depositSafety.cautionFrom,
                                depositSafety.warnTo,
                              )
                            ]
                          }
                        >
                          전세가율 {depositSafety.jeonseRatio}%
                        </Badge>
                      ) : (
                        <Badge className={apiStatusToneClassMap.slate}>판정 불가</Badge>
                      )}
                    </div>

                    {depositSafety.status === 'calculated' ? (
                      <>
                        <p className="mb-4 text-sm leading-relaxed text-slate-600">{depositSafety.explanation}</p>
                        {depositSafety.referenceDate && (
                          <p className="mb-4 text-xs text-slate-400">기준일: {depositSafety.referenceDate}</p>
                        )}
                        {depositSafety.recentOwnershipChangeWarning && (
                          <NoticeBox icon={AlertTriangle} iconClassName="text-orange-500" className="mb-6">
                            최근 소유권이 바뀐 매물이에요 — 더 꼼꼼히 확인하세요.
                          </NoticeBox>
                        )}
                      </>
                    ) : (
                      <p className="mb-6 text-sm text-slate-500">{depositSafety.reasonText ?? '확인할 수 없어요.'}</p>
                    )}

                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
                      <h4 className="mb-4 flex items-center gap-2 font-bold text-blue-950">
                        <ShieldCheck className="h-5 w-5" /> 보증금을 지키기 위한 조치
                      </h4>
                      <ul className="space-y-3">
                        {depositSafetyActions.map((item) => (
                          <li key={item} className="flex items-start gap-2 text-sm text-blue-800">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {depositSafety.disclaimer && (
                      <p className="mt-6 text-center text-[10px] leading-relaxed text-slate-400">
                        {depositSafety.disclaimer}
                      </p>
                    )}
                  </div>
                )
              ))}

            {activeTab === 'missing' &&
              (propertyId == null ? (
                <PropertyLinkRequiredNotice />
              ) : isLoadingRiskData ? (
                <RiskDataLoading />
              ) : riskDataError ? (
                <div className="ansim-card p-8 text-center text-sm text-red-600">{riskDataError}</div>
              ) : (
                <div className="space-y-4">
                  {undeterminableSignals.length === 0 ? (
                    <div className="ansim-card p-8 text-center text-sm text-slate-500">
                      판정하지 못한 항목이 없어요.
                    </div>
                  ) : (
                    undeterminableSignals.map((signal) => {
                      const meta = riskSignalTypeMeta[signal.signalType];
                      const SignalIcon = meta.icon;
                      return (
                        <div key={signal.signalType} className="ansim-card flex items-start gap-4 p-6">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                            <SignalIcon className="h-5 w-5 text-slate-400" />
                          </div>
                          <div className="flex-1">
                            <h4 className="mb-1 font-bold text-slate-950">{meta.title}</h4>
                            <p className="text-sm text-slate-500">{signal.reasonText ?? '확인할 수 없어요.'}</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  {riskSignals?.disclaimer && (
                    <p className="text-center text-[10px] leading-relaxed text-slate-400">{riskSignals.disclaimer}</p>
                  )}
                </div>
              ))}

            {propertyId != null && (
              <Link href={`/properties/${propertyId}/checklist`} className="ansim-button-primary mt-6 w-full py-4">
                계약 체크리스트로 이동 <ArrowRight className="h-5 w-5" />
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
