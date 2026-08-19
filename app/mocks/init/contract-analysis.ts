import {
  type ContractAnalysisResultDto,
  type ContractHistoryClauseDto,
  type ContractHistoryItemDto,
} from '../../types/api';

export const initContractAnalysisResultDto: ContractAnalysisResultDto = {
  clauses: [
    {
      originalText: '임대인은 개인 사정에 따라 계약 기간 중 목적물 명도를 요청할 수 있다.',
      riskFlag: true,
      explanation:
        '집주인이 원하면 계약 기간 중에도 집을 비워달라고 할 수 있다는 뜻으로 읽힐 수 있습니다. 임차인의 거주 기간은 법적으로 보호받아야 하며, 임대인의 개인 사정만으로 퇴거를 요구하는 조항은 분쟁 위험이 큽니다.',
      question: '임대인이 계약 기간 중 임의로 계약 종료나 퇴거를 요구할 수 있는 조건인지 확인해 주세요.',
      suggestedText: '계약 기간 중 퇴거 요청은 법령 또는 상호 합의에 따른 경우로 제한한다.',
    },
    {
      originalText: '보증금 반환은 새로운 임차인이 들어온 이후에 지급하기로 한다.',
      riskFlag: true,
      explanation:
        '다음 세입자가 구해져야 보증금을 돌려받을 수 있다는 뜻입니다. 보증금 반환은 계약 종료와 동시에 이뤄져야 할 핵심 의무이며, 다음 임차인 여부와 묶이면 반환 지연 위험이 큽니다.',
      question: '새 임차인 여부와 관계없이 계약 종료일에 보증금을 반환받을 수 있나요?',
      suggestedText: '임대인은 계약 종료일에 보증금 전액을 즉시 반환한다.',
    },
    {
      originalText: '임대인은 잔금 지급일까지 근저당권을 설정할 수 있다.',
      riskFlag: true,
      explanation:
        '입주 전 집주인이 집을 담보로 추가 대출을 받을 수 있다는 뜻입니다. 선순위 권리가 생기면 보증금보다 먼저 변제되는 채권이 늘어날 수 있습니다.',
      question: '계약 체결 후 잔금일까지 추가 근저당을 설정하지 않는 특약을 넣을 수 있나요?',
      suggestedText: '임대인은 계약 체결일부터 잔금 지급일 다음 날까지 추가 근저당권을 설정하지 않는다.',
    },
  ],
  summary: '주의가 필요한 특약 3개가 발견되었습니다.',
  aiGeneratedNotice: '이 설명은 AI가 자동으로 생성한 참고용 정보입니다.',
  disclaimer:
    '본 분석 결과는 참고 정보이며 법률 자문이나 계약 안전을 보장하지 않습니다. 실제 계약 전에는 전문가 검토를 받으세요.',
};

// 마이페이지 "계약분석 이력" 섹션 mock - 페이지네이션 동작을 확인할 수 있도록 7건을 둔다.
export const initContractHistoryItemDtos: ContractHistoryItemDto[] = [
  {
    id: 7,
    propertyId: 1,
    inputType: 'IMAGE',
    summary: '주의가 필요한 특약 3개가 발견되었습니다.',
    clauseCount: 5,
    riskCount: 3,
    status: 'COMPLETED',
    createdAt: '2026-08-18T14:20:00',
  },
  {
    id: 6,
    propertyId: null,
    inputType: 'TEXT',
    summary: '특이사항이 없는 무난한 특약사항입니다.',
    clauseCount: 3,
    riskCount: 0,
    status: 'COMPLETED',
    createdAt: '2026-08-15T09:05:00',
  },
  {
    id: 5,
    propertyId: 2,
    inputType: 'IMAGE',
    summary: '보증금 반환 조건 관련 확인이 필요합니다.',
    clauseCount: 4,
    riskCount: 1,
    status: 'COMPLETED',
    createdAt: '2026-08-10T18:42:00',
  },
  {
    id: 4,
    propertyId: null,
    inputType: 'TEXT',
    summary: '근저당 설정 관련 특약을 확인해 주세요.',
    clauseCount: 2,
    riskCount: 1,
    status: 'COMPLETED',
    createdAt: '2026-08-05T11:11:00',
  },
  {
    id: 3,
    propertyId: 1,
    inputType: 'IMAGE',
    summary: '퇴거 요구 조건이 임대인에게 유리하게 작성되었습니다.',
    clauseCount: 6,
    riskCount: 2,
    status: 'COMPLETED',
    createdAt: '2026-07-29T16:30:00',
  },
  {
    id: 2,
    propertyId: null,
    inputType: 'TEXT',
    summary: '관리비 부담 주체가 명확하지 않습니다.',
    clauseCount: 3,
    riskCount: 1,
    status: 'COMPLETED',
    createdAt: '2026-07-20T08:47:00',
  },
  {
    id: 1,
    propertyId: null,
    inputType: 'TEXT',
    summary: '특이사항이 없는 무난한 특약사항입니다.',
    clauseCount: 2,
    riskCount: 0,
    status: 'COMPLETED',
    createdAt: '2026-07-12T13:03:00',
  },
];

// 이력 상세(GET /users/me/contract-history/{id}) mock - 실제 응답처럼 originalText가 없다.
// mock에서는 id와 무관하게 항상 이 배열 하나를 돌려준다(getMockContractAnalysisResult와 동일 패턴).
export const initContractHistoryClauseDtos: ContractHistoryClauseDto[] = [
  {
    riskFlag: true,
    explanation:
      '집주인이 원하면 계약 기간 중에도 집을 비워달라고 할 수 있다는 뜻으로 읽힐 수 있습니다. 임차인의 거주 기간은 법적으로 보호받아야 하며, 임대인의 개인 사정만으로 퇴거를 요구하는 조항은 분쟁 위험이 큽니다.',
    question: '임대인이 계약 기간 중 임의로 계약 종료나 퇴거를 요구할 수 있는 조건인지 확인해 주세요.',
    suggestedText: '계약 기간 중 퇴거 요청은 법령 또는 상호 합의에 따른 경우로 제한한다.',
  },
  {
    riskFlag: true,
    explanation:
      '다음 세입자가 구해져야 보증금을 돌려받을 수 있다는 뜻입니다. 보증금 반환은 계약 종료와 동시에 이뤄져야 할 핵심 의무이며, 다음 임차인 여부와 묶이면 반환 지연 위험이 큽니다.',
    question: '새 임차인 여부와 관계없이 계약 종료일에 보증금을 반환받을 수 있나요?',
    suggestedText: '임대인은 계약 종료일에 보증금 전액을 즉시 반환한다.',
  },
  {
    riskFlag: false,
    explanation: '관리비 총액과 포함 항목이 특약에 명시되어 있어 특별히 확인할 위험은 없습니다.',
    question: '관리비에 포함되지 않는 항목이 있는지 확인해 주세요.',
    suggestedText: '',
  },
];
