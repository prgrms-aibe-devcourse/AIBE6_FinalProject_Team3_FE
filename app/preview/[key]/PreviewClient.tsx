'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSearch,
  FileText,
  Home,
  HelpCircle,
  MessageSquare,
  Repeat,
  Search,
  Shield,
  TrendingUp,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { isLoggedIn as checkIsLoggedIn } from '../../services/auth';
import { type LandingDemoKey } from '../../types/domain';
import { Badge } from '../../ui/Badge';

type PreviewClientProps = {
  demoKey: LandingDemoKey;
};

const TITLES: Record<LandingDemoKey, string> = {
  market: '시세 기반 매물 검증',
  contract: 'AI 특약사항 분석',
  deposit: '보증금 안전성 확인',
  checklist: '현장 체크리스트',
};

const DESCRIPTIONS: Record<LandingDemoKey, string> = {
  market: '실제 매물 상세 페이지에서 보증금/전세가를 국토교통부 실거래가와 비교해 보여드리는 화면이에요.',
  contract: '계약서를 업로드하면 특약사항을 조항별로 분석해 이렇게 정리해 드려요.',
  deposit: '매물의 허위매물 의심 신호와 보증금 안전성을 함께 확인할 수 있는 화면이에요.',
  checklist: '방문 전후로 확인해야 할 항목을 매물 유형과 계약 단계에 맞춰 정리해 드려요.',
};

// 랜딩페이지 카드 순서(app/data/landing.ts)와 동일하게 맞춘다 - 미리보기 사이를 오갈 때도
// 같은 순서로 보여야 랜딩에서 본 순서와 어긋나지 않는다.
const NAV_ORDER: LandingDemoKey[] = ['market', 'contract', 'deposit', 'checklist'];

const NAV_ICONS: Record<LandingDemoKey, typeof Search> = {
  market: Search,
  contract: FileSearch,
  deposit: Shield,
  checklist: CheckCircle2,
};

// 실제 매물/계약서/체크리스트 데이터가 아니라 서비스 화면을 미리 보여주기 위한 고정 예시다 -
// 회원가입 전에는 개인화된 데이터가 없으므로, 실제 결과 화면(RiskAnalysisClient/
// ContractResultClient/ChecklistClient)과 같은 시각적 스타일(Badge, ansim-card, 색 언어)만
// 그대로 가져오고 항목 수도 실제 화면과 비슷하게 여러 개 채웠다(모달 1개 예시로는 정보가
// 부족하다는 피드백 반영).
function MarketPreview() {
  return (
    <div className="space-y-6">
      <div className="ansim-card p-6">
        <div className="mb-6">
          <p className="mb-1 text-sm text-slate-500">인근 실거래 12건 기준 (반경 500m)</p>
          <p className="text-xl font-bold text-orange-600">시세보다 15% 높은 가격이에요</p>
        </div>
        <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm">
          <div>
            <p className="mb-1 text-xs text-slate-400">기준 시세(중앙값)</p>
            <p className="font-semibold text-slate-800">3억 4,000만원</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-400">기준일</p>
            <p className="font-semibold text-slate-800">2026-06</p>
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
          국토교통부 실거래가 공개시스템 기준이며, 참고용 정보이니 실제 시세는 별도로 확인해보세요.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-bold text-slate-700">인근 실거래 비교 매물</h2>
        <div className="space-y-2">
          {[
            ['역삼동 ○○아파트 84㎡', '3억 2,000만원', '2026-05'],
            ['역삼동 ○○빌라 82㎡', '3억 5,000만원', '2026-06'],
            ['역삼동 ○○오피스텔 80㎡', '3억 3,000만원', '2026-04'],
          ].map(([title, price, date]) => (
            <div key={title} className="ansim-card flex items-center justify-between p-4">
              <p className="text-sm font-semibold text-slate-800">{title}</p>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-950">{price}</p>
                <p className="text-xs text-slate-400">{date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const CLAUSES = [
  {
    level: '확인 필요' as const,
    quote: '임차인은 계약 만료 전 중도 해지 시 위약금으로 보증금의 20%를 지급한다',
    explanation: '일반적인 위약금 수준(5~10%)보다 높습니다. 과도한 위약금 조항은 임차인에게 불리할 수 있어요.',
    question: '위약금 비율을 낮추거나 삭제할 수 있을까요?',
  },
  {
    level: '확인 필요' as const,
    quote: '임대인은 필요 시 사전 통보 없이 매물에 출입할 수 있다',
    explanation: '임차인의 사생활 보호를 위해 통상 최소 24시간 전 사전 통보 조항이 필요합니다.',
    question: '출입 전 사전 통보 조항을 추가할 수 있을까요?',
  },
  {
    level: '참고' as const,
    quote: '관리비는 별도이며 월 8만원이다',
    explanation: '일반적인 수준의 관리비 안내 조항이에요. 특별히 불리한 내용은 아니에요.',
    question: null,
  },
];

function ContractPreview() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['총 조항 수', '12개'],
          ['확인 필요', '3개'],
          ['참고', '9개'],
          ['분석 상태', '완료'],
        ].map(([label, value]) => (
          <div key={label} className="ansim-card p-4 text-center">
            <p className="mb-1 text-xs text-slate-400">{label}</p>
            <p className="text-lg font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {CLAUSES.map((clause) => (
          <div
            key={clause.quote}
            className={`ansim-card overflow-hidden border-l-4 p-5 ${
              clause.level === '확인 필요' ? 'border-l-orange-400' : 'border-l-slate-200'
            }`}
          >
            <div className="mb-3 flex items-start gap-2">
              <Badge
                className={`shrink-0 rounded border ${
                  clause.level === '확인 필요'
                    ? 'border-orange-100 bg-orange-50 text-orange-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                {clause.level}
              </Badge>
              <p className="text-sm text-slate-600">&quot;{clause.quote}&quot;</p>
            </div>
            <div className="mb-3 flex items-start gap-2">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
              <p className="text-sm text-slate-700">{clause.explanation}</p>
            </div>
            {clause.question && (
              <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-teal-700">
                  <HelpCircle className="h-3.5 w-3.5" />
                  중개사에게 이렇게 확인해 보세요
                </div>
                <p className="text-sm text-teal-900">&quot;{clause.question}&quot;</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function DepositPreview() {
  return (
    <div className="space-y-6">
      <div className="ansim-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">허위매물 의심 신호</span>
          <Badge className="bg-orange-100 text-orange-700">2개 발견</Badge>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5">
              <Repeat className="h-4 w-4 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">단기 재등록 의심</p>
              <p className="text-xs text-slate-500">최근 3개월 내 동일 매물이 3회 재등록됐어요.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-orange-50 p-2.5">
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">가격 이상 신호</p>
              <p className="text-xs text-slate-500">주변 시세 대비 가격 변동폭이 비정상적으로 큽니다.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="ansim-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-bold text-slate-900">보증금 안전성</span>
          <Badge className="bg-orange-100 text-orange-700">전세가율 92%</Badge>
        </div>
        <p className="mb-3 text-sm leading-relaxed text-slate-700">
          전세가율이 80%를 넘으면 집이 경매로 넘어갔을 때 보증금을 온전히 돌려받지 못할 위험이 커집니다.
          선순위 권리 확인이 필요해요.
        </p>
        <div className="flex items-start gap-2 rounded-lg bg-orange-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
          <p className="text-xs text-orange-800">등기부등본에서 소유자 변경 이력이 있는지 확인해 보세요.</p>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">기준일: 2026-06 · 참고용 정보입니다.</p>
      </div>
    </div>
  );
}

const CHECKLIST_GROUPS = [
  {
    category: '실내 상태',
    icon: Home,
    items: [
      { text: '수도/보일러 작동 확인', required: true, status: '미흡' as const },
      { text: '곰팡이/누수 흔적 확인', required: true, status: '완료' as const },
    ],
  },
  {
    category: '소음·환경',
    icon: Volume2,
    items: [
      { text: '낮/밤 소음 확인', required: false, status: '완료' as const },
      { text: '채광 확인', required: false, status: '미흡' as const },
    ],
  },
  {
    category: '보안·안전',
    icon: Shield,
    items: [{ text: '현관문 잠금장치 확인', required: true, status: '완료' as const }],
  },
];

function ChecklistPreview() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {CHECKLIST_GROUPS.map(({ category, icon: Icon }) => (
          <span
            key={category}
            className="inline-flex items-center gap-1.5 rounded-full bg-slate-950 px-4 py-2 text-xs font-bold text-white"
          >
            <Icon className="h-3.5 w-3.5" />
            {category}
          </span>
        ))}
      </div>

      {CHECKLIST_GROUPS.map((group) => (
        <div key={group.category}>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700">
            <group.icon className="h-4 w-4" />
            {group.category}
          </h2>
          <div className="space-y-2">
            {group.items.map((item) => (
              <div
                key={item.text}
                className={`ansim-card p-4 ${item.status === '미흡' ? 'border-orange-200 bg-orange-50/40' : ''}`}
              >
                <div className="mb-2 flex items-center gap-2">
                  {item.required && <Badge className="bg-slate-900 text-white">필수</Badge>}
                  <p className="text-sm font-bold text-slate-900">{item.text}</p>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`rounded-lg border px-3 py-1 text-xs font-bold ${
                      item.status === '미흡'
                        ? 'border-orange-200 bg-orange-100 text-orange-700'
                        : 'border-slate-200 text-slate-400'
                    }`}
                  >
                    미흡
                  </span>
                  <span
                    className={`rounded-lg border px-3 py-1 text-xs font-bold ${
                      item.status === '완료'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 text-slate-400'
                    }`}
                  >
                    완료
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const BODIES: Record<LandingDemoKey, () => React.JSX.Element> = {
  market: MarketPreview,
  contract: ContractPreview,
  deposit: DepositPreview,
  checklist: ChecklistPreview,
};

export function PreviewClient({ demoKey }: PreviewClientProps) {
  const Body = BODIES[demoKey];
  // 비회원 전용 미리보기라 기본값은 '/login'이지만, 이미 로그인된 사용자가 이 페이지를 보고
  // CTA를 누르면 로그인 폼을 다시 보게 되는 어색함을 막기 위해 랜딩페이지(app/page.tsx)와
  // 동일한 방식으로 로그인 여부를 확인한다(실패해도 강제 이동시키지 않는 비강제 확인용 -
  // services/auth.ts의 isLoggedIn() 참고).
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    let cancelled = false;
    checkIsLoggedIn().then((result) => {
      if (!cancelled) setLoggedIn(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const ctaHref = loggedIn ? '/home' : '/login';

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600">
              <FileText className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-950">알고계약</span>
          </Link>
          <Link href="/" className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" />
            홈페이지로 돌아가기
          </Link>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex max-w-3xl gap-2 overflow-x-auto px-4 py-3">
          {NAV_ORDER.map((key) => {
            const Icon = NAV_ICONS[key];
            const active = key === demoKey;
            return (
              <Link
                key={key}
                href={`/preview/${key}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                  active ? 'bg-teal-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                {TITLES[key]}
              </Link>
            );
          })}
        </div>
      </nav>

      <main className="container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-6">
          <Badge className="mb-3 bg-slate-100 text-slate-500">예시 화면</Badge>
          <h1 className="mb-2 text-2xl font-bold text-slate-950">{TITLES[demoKey]}</h1>
          <p className="text-sm text-slate-500">{DESCRIPTIONS[demoKey]}</p>
        </div>

        <Body />

        <div className="ansim-card mt-8 flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-sm text-slate-600">
            실제 값은 매물/계약서 정보에 따라 달라져요. 내 매물로 직접 확인해보세요.
          </p>
          <Link href={ctaHref} className="ansim-button-primary px-7 py-3">
            무료로 시작하기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    </div>
  );
}
