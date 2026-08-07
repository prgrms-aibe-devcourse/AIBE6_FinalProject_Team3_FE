'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  FileText,
  HelpCircle,
  Info,
  Loader2,
  MessageCircle,
  MessageSquare,
  Send,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { contractTabs, depositRatioMarkers, depositSafetyActions, missingItems } from '../../../data/contract-analysis';
import { encodeBase64Url } from '../../../lib/base64Url';
import { analyzeContract, sendContractClauseQuestion } from '../../../services/contract-analysis';
import { type ContractOcrUncertainField } from '../../../types/api';
import {
  type ContractAnalysisResult,
  type ContractAnalysisTab,
  type ContractClause,
  type ContractSummaryCard,
} from '../../../types/domain';
import { Badge } from '../../../ui/Badge';
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

type ContractResultClientProps = {
  maskedText: string;
  maskedCount: number;
  // OCR이 신뢰도 낮게 추출한 구간(이미지 입력 경로에서만 존재). 텍스트 직접 입력 경로는 OCR을
  // 거치지 않으므로 항상 빈 배열이고, 그 경우 이 안내 자체가 보이지 않는다.
  uncertainFields: ContractOcrUncertainField[];
  loadError?: string;
  // 계약 체크리스트로 이동하는 버튼은 특약사항이 어느 매물에 대한 것인지 알아야 하는데, 지금
  // 파이프라인엔 매물 연결 UI 자체가 없어 항상 undefined다 - propertyId가 없으면 버튼을 숨긴다.
  propertyId?: number;
};

export function ContractResultClient({
  maskedText,
  maskedCount,
  uncertainFields,
  loadError,
  propertyId,
}: ContractResultClientProps) {
  const router = useRouter();

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

  const isAnalyzing = processingStep === 'analyzing';
  // 표시용으로만 정리한 텍스트 - analyzeContract/수정하기에는 항상 원본 maskedText가 그대로 쓰인다.
  const displayMaskedText = useMemo(() => formatMaskedTextForDisplay(maskedText), [maskedText]);

  const handleEdit = () => {
    const encoded = encodeBase64Url(maskedText);
    router.push(`/contract/upload?text=${encoded}`);
  };

  const handleAnalyze = async () => {
    if (isAnalyzing) {
      return;
    }

    setAnalysisError(undefined);
    setProcessingStep('analyzing');

    try {
      const result = await analyzeContract(maskedText, true);
      setAnalysisResult(result);
      // 처음 분석 결과를 받은 시점에만 riskFlag=true인 첫 조항을 기본으로 펼쳐둔다.
      const firstRiskyIndex = result.clauses.findIndex((clause) => clause.riskFlag);
      setExpandedIndices(firstRiskyIndex === -1 ? new Set() : new Set([firstRiskyIndex]));
      // 재분석 시 이전 clauses index에 묶여있던 채팅 이력을 새 결과와 섞이지 않게 초기화한다.
      setChatStates({});
    } catch {
      setAnalysisError('AI 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.');
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
    setChatStates((prev) => ({ ...prev, [index]: updater(prev[index] ?? EMPTY_CHAT_STATE) }));
  };

  const handleSendChatMessage = async (index: number, clause: ContractClause) => {
    const state = getChatState(index);
    const question = state.input.trim();
    if (!question || isChatSending(index)) {
      return;
    }

    const historyForRequest = state.history
      .filter((entry): entry is ClauseChatEntry & { answer: string } => entry.answer !== null)
      .map(({ question: q, answer }) => ({ question: q, answer }));

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
        { originalText: clause.originalText, riskFlag: clause.riskFlag, explanation: clause.explanation },
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
    } catch {
      // 실패하면 대기 중이던 질문 말풍선을 없애고, 입력값을 되살려서 재입력 없이 다시 보낼 수 있게 한다.
      updateChatState(index, (current) => ({
        ...current,
        input: question,
        error: '답변을 받아오지 못했습니다. 잠시 후 다시 시도해 주세요.',
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
              {maskedCount > 0
                ? `개인정보로 보이는 항목 ${maskedCount}개를 가렸어요. 아래 내용대로 분석을 진행할까요?`
                : '분석 요청할 내용이에요. 아래 내용대로 분석을 진행할까요?'}
            </NoticeBox>
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

            {uncertainFields.length > 0 && (
              <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-orange-700">
                  <AlertCircle className="h-4 w-4" /> 이 부분들은 인식이 애매했어요, 확인해주세요
                </p>
                <ul className="space-y-1">
                  {uncertainFields.map((field) => (
                    <li key={field.index} className="text-sm text-orange-700">
                      · {field.text}
                    </li>
                  ))}
                </ul>
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
                onClick={handleEdit}
                className="ansim-button-secondary flex-1 py-4 disabled:pointer-events-none disabled:opacity-50"
              >
                수정하기
              </button>
              <button
                type="button"
                disabled={isAnalyzing}
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
              <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
                <div>
                  <div className="mb-4 flex items-center gap-2">
                    <Badge className="bg-orange-100 px-3 text-orange-700">분석 완료</Badge>
                  </div>
                  <h2 className="ansim-page-title mb-2">계약서 분석 결과입니다</h2>
                  {analysisResult.summary && <p className="ansim-page-description">{analysisResult.summary}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled
                    title="준비 중인 기능이에요."
                    className="ansim-button-secondary cursor-not-allowed px-4 py-2.5 text-sm opacity-50"
                  >
                    <Download className="h-4 w-4" /> PDF 저장
                  </button>
                  <button
                    type="button"
                    disabled
                    title="준비 중인 기능이에요."
                    className="ansim-button-primary cursor-not-allowed px-4 py-2.5 text-sm opacity-50"
                  >
                    <Share2 className="h-4 w-4" /> 결과 공유
                  </button>
                </div>
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
                    <div
                      key={index}
                      className="ansim-card overflow-hidden border-l-4 border-l-slate-200 transition-all hover:border-l-teal-500"
                    >
                      <button
                        type="button"
                        onClick={() => toggleExpanded(index)}
                        aria-expanded={isExpanded}
                        className="flex w-full items-center gap-4 p-6 text-left"
                      >
                        <Badge className={`shrink-0 rounded border ${item.levelColor}`}>{item.levelLabel}</Badge>
                        <p className="flex-1 text-sm italic text-slate-700">
                          <span aria-hidden="true">&quot;</span>
                          {item.originalText}
                          <span aria-hidden="true">&quot;</span>
                        </p>
                        <ChevronDown
                          className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-slate-100 p-6">
                          <div>
                            <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-950">
                              <MessageSquare className="h-4 w-4 text-teal-600" /> 설명
                            </h4>
                            <p className="text-sm leading-relaxed text-slate-600">{item.explanation}</p>
                          </div>
                          <div className="mt-8 rounded-xl border border-teal-100 bg-teal-50 p-4">
                            <div className="mb-3 flex items-center gap-2">
                              <HelpCircle className="h-4 w-4 text-teal-600" />
                              <span className="text-sm font-bold text-teal-950">중개사에게 이렇게 확인해 보세요</span>
                            </div>
                            <p className="mb-4 text-sm text-teal-800">
                              <span aria-hidden="true">&quot;</span>
                              {item.question}
                              <span aria-hidden="true">&quot;</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopy(`question-${index}`, item.question)}
                              className="flex items-center gap-2 text-xs font-bold text-teal-700"
                            >
                              {copiedKey === `question-${index}` ? (
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
                              {item.suggestedText}
                              <span aria-hidden="true">&quot;</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => handleCopy(`suggestion-${index}`, item.suggestedText)}
                              className="flex items-center gap-2 text-xs font-bold text-slate-600"
                            >
                              {copiedKey === `suggestion-${index}` ? (
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

                          {(() => {
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
                                  <div className="mb-4 space-y-4">
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'deposit' && (
              <div className="ansim-card p-8">
                <div className="mb-10 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-orange-100">
                    <AlertTriangle className="h-10 w-10 text-orange-600" />
                  </div>
                  <h3 className="mb-2 text-xl font-bold text-slate-950">보증금 반환 위험 신호가 있어요</h3>
                  <p className="text-slate-600">전세가율이 80%를 초과해 주의가 필요합니다.</p>
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
                    <span className="text-slate-600">전세가율 (보증금 / 추정 매매가)</span>
                    <span className="text-lg font-bold text-orange-600">82%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
                    <div className="h-full w-[82%] bg-orange-500" />
                  </div>
                  <div className="flex justify-between text-xs text-slate-400">
                    {depositRatioMarkers.map((marker) => (
                      <span key={marker}>{marker}</span>
                    ))}
                  </div>
                </div>
                <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50 p-6">
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
              </div>
            )}

            {activeTab === 'missing' && (
              <div className="space-y-4">
                {missingItems.map(({ title, description }) => (
                  <div key={title} className="ansim-card flex items-start gap-4 p-6">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
                      <AlertCircle className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="mb-1 font-bold text-slate-950">{title}</h4>
                      <p className="mb-4 text-sm text-slate-500">{description}</p>
                      <button className="text-xs font-bold text-teal-700 hover:underline">확인 요청하기</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-col gap-4 pt-6 md:flex-row">
              {propertyId != null && (
                <Link href={`/properties/${propertyId}/checklist`} className="ansim-button-primary flex-1 py-4">
                  계약 체크리스트로 이동 <ArrowRight className="h-5 w-5" />
                </Link>
              )}
              <button
                type="button"
                disabled
                title="준비 중인 기능이에요."
                className="ansim-button-secondary flex-1 cursor-not-allowed py-4 opacity-50"
              >
                전문가 상담 안내받기
              </button>
            </div>

            {analysisResult.disclaimer && (
              <p className="text-center text-[10px] leading-relaxed text-slate-400">{analysisResult.disclaimer}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
