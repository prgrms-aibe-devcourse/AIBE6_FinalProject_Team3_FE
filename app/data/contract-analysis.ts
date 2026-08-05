import { type ContractMissingItem, type ContractTab } from '../types/domain';

export const contractTabs: ContractTab[] = [
  { key: 'risk', label: '위험 조항 분석' },
  { key: 'deposit', label: '보증금 안전성' },
  { key: 'missing', label: '누락 항목' },
];

export const depositRatioMarkers = ['60% 이하', '80% 초과 시 주의', '90% 이상이면 변동 여지 확인'];

export const depositSafetyActions = [
  '전세보증금반환보증 가입 가능 여부를 확인하세요.',
  '잔금 지급 즉시 전입신고와 확정일자를 받으세요.',
  '등기부등본의 선순위 권리와 보증금 합계를 다시 확인하세요.',
];

export const missingItems: ContractMissingItem[] = [
  {
    title: '관리비 세부 항목 미기재',
    description: '관리비 총액은 있으나 인터넷, 수도, 전기 등 포함 항목이 분명하지 않습니다.',
  },
  {
    title: '수리 비용 책임 범위 불명확',
    description: '소모품 교체와 주요 설비 수리의 책임 주체가 명시되지 않았습니다.',
  },
  {
    title: '생활 조건 안내 부족',
    description: '반려동물, 주차, 층간소음 관련 조건을 추가로 확인하는 것이 좋습니다.',
  },
];
