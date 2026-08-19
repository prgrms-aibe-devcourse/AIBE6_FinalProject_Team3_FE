import { type ContractTab } from '../types/domain';

export const contractTabs: ContractTab[] = [
  { key: 'risk', label: '위험 조항 분석' },
  { key: 'deposit', label: '보증금 안전성' },
  { key: 'missing', label: '누락 항목' },
];

export const depositSafetyActions = [
  '전세보증금반환보증 가입 가능 여부를 확인하세요.',
  '잔금 지급 즉시 전입신고와 확정일자를 받으세요.',
  '등기부등본의 선순위 권리와 보증금 합계를 다시 확인하세요.',
];
