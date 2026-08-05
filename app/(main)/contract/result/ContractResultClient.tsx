'use client';

import { useState } from 'react';
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
  MessageSquare,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { contractTabs, depositRatioMarkers, depositSafetyActions, missingItems } from '../../../data/contract-analysis';
import { encodeBase64Url } from '../../../lib/base64Url';
import { analyzeContract } from '../../../services/contract-analysis';
import { type ContractOcrUncertainField } from '../../../types/api';
import { type ContractAnalysisResult, type ContractAnalysisTab, type ContractSummaryCard } from '../../../types/domain';
import { Badge } from '../../../ui/Badge';
import { NoticeBox } from '../../../ui/NoticeBox';
import { SummaryCard } from '../../../ui/SummaryCard';

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

  const isAnalyzing = processingStep === 'analyzing';

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
            <div className="ansim-input min-h-36 whitespace-pre-wrap bg-slate-50 text-slate-700">{maskedText}</div>

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
                  {analysisResult.aiGeneratedNotice && (
                    <p className="mt-2 text-xs text-slate-400">{analysisResult.aiGeneratedNotice}</p>
                  )}
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
