import { CheckCircle2, FileSearch, Search, Shield } from 'lucide-react';
import { type SummaryItem, type TonedFeatureCardData } from '../types/domain';

export const landingFeatures: TonedFeatureCardData[] = [
  {
    icon: Search,
    title: '시세 기반 매물 검증',
    description: '주변 실거래가와 보증금 수준을 함께 비교해 과도한 가격 신호를 먼저 보여줍니다.',
    tone: 'bg-teal-50 text-teal-700',
    demoKey: 'market',
  },
  {
    icon: FileSearch,
    title: 'AI 특약사항 분석',
    description: '특약사항 핵심 문구를 쉬운 말로 풀고, 임차인에게 불리한 표현을 표시합니다.',
    tone: 'bg-blue-50 text-blue-700',
    demoKey: 'contract',
  },
  {
    icon: Shield,
    title: '보증금 안전성 확인',
    description: '전세가율과 선순위 권리 확인 필요 여부를 계약 전 체크할 수 있게 돕습니다.',
    tone: 'bg-orange-50 text-orange-700',
    demoKey: 'deposit',
  },
  {
    icon: CheckCircle2,
    title: '현장 체크리스트',
    description: '방문 전후로 확인해야 할 항목을 매물 유형과 계약 단계에 맞춰 정리합니다.',
    tone: 'bg-indigo-50 text-indigo-700',
    demoKey: 'checklist',
  },
];

export const landingSummaryItems: SummaryItem[] = [
  ['시세 대비', '+12%'],
  ['확인 신호', '3개'],
  ['체크 완료', '68%'],
];
