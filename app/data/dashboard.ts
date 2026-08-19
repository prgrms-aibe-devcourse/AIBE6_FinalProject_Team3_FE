import { CheckCircle2, FileSearch, PlusCircle, ShieldAlert } from 'lucide-react';
import { type QuickAction, type QuickActionTone } from '../types/domain';

export const quickActionToneMap: Record<QuickActionTone, string> = {
  teal: 'bg-teal-100 text-teal-700',
  orange: 'bg-orange-100 text-orange-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  blue: 'bg-blue-100 text-blue-700',
};

export const quickActions: QuickAction[] = [
  {
    to: '/properties/register',
    icon: PlusCircle,
    title: '매물 검증하기',
    description: '주소와 보증금으로 시세 대비 적정성과 확인 필요 신호를 봅니다.',
    tone: 'teal',
  },
  {
    // 매물/신호 상태별로 다르게 연결하는 방향도 검토했으나(getRiskCheckHref, 지금은 삭제됨),
    // 신호만 걸러 보는 필터가 매물 목록에 아직 없어 실효성이 애매해 일단 전체 목록으로 통일함 -
    // 그 필터가 생기면 다시 검토.
    to: '/properties',
    icon: ShieldAlert,
    title: '위험 신호 확인',
    description: '허위매물 의심 신호와 보증금 안전성 수치를 한 번에 확인합니다.',
    tone: 'orange',
  },
  {
    to: '/checklists',
    icon: CheckCircle2,
    title: '현장 체크리스트',
    description: '매물 유형에 맞춘 방문 확인 항목을 기록합니다.',
    tone: 'emerald',
  },
  {
    to: '/contract/upload',
    icon: FileSearch,
    title: '특약사항 분석',
    description: '계약서 전체가 아닌 특약사항 핵심 문구를 쉽게 풀어봅니다.',
    tone: 'blue',
  },
];
