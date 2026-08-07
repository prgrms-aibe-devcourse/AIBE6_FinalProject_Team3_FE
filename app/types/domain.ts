import { type LucideIcon } from 'lucide-react';

// 서비스 대상 거래유형은 전세/월세만 지원한다 (반전세/매매는 스코프 밖 — 기획서 "대상 범위" 참고).
export type PropertyTradeType = '전세' | '월세';

export type PropertyLocation = {
  latitude: number;
  longitude: number;
};

// 매물 이미지가 어느 공간을 찍은 사진인지 라벨. 선택값 - 라벨 없이 올릴 수도 있다(null).
export type RoomType = 'LIVING_ROOM' | 'BEDROOM' | 'BATHROOM' | 'KITCHEN' | 'ENTRANCE' | 'VERANDA' | 'EXTERIOR' | 'ETC';

export type PropertyImage = {
  imageUrl: string;
  roomType: RoomType | null;
};

export type PropertySummary = {
  id: number;
  title: string;
  address: string;
  type: PropertyTradeType;
  deposit: string;
  propertyType?: string;
  // checkSignalCount/signalSummary/jeonseRatio는 risk-analysis를 한 번도 안 돌린 매물이면
  // undefined(0건과 구분됨) - PropertyListResponse가 null로 내려주는 걸 매퍼가 undefined로 바꾼다.
  // maintenance는 관리비를 아예 입력 안 했으면(null) undefined, 0으로 입력했으면(관리비 없음)
  // "관리비 없음", 양수면 "관리비 N만원" 형식의 표시용 문자열이다. marketDelta는
  // 시세비교가 AVAILABLE일 때만 채워지고, UNAVAILABLE(판정불가)이거나 아직 계산 전이면 undefined다.
  // mock 데이터는 전부 값을 채워서 내려준다.
  maintenance?: string;
  marketDelta?: string;
  checkSignalCount?: number;
  signalSummary?: string;
  jeonseRatio?: number;
  checklist?: number;
  statusColor: string;
  location: PropertyLocation;
};

/**
 * 매물 상세(GET /properties/{id}) 화면 전용 도메인 타입. PropertySummary(목록)와 달리
 * 설명/이미지/등록일/실거래가 비교 결과를 포함한다. 신호/전세가율/체크리스트는
 * 목록과 동일하게 아직 백엔드에 없어 실제 매물은 undefined, mock 데이터만 값을 채운다.
 * maintenance는 목록과 동일한 규칙(null→undefined, 0→"관리비 없음", 양수→포맷 문자열)으로 채워진다.
 */
export type PropertyDetail = {
  id: number;
  title: string;
  type: PropertyTradeType;
  address: string;
  deposit: string;
  propertyType?: string;
  // 수정 폼 입력값 프리필용 원시 금액(원 단위). 실제 API는 항상 채워지고, mock은 표시용 문자열만
  // 갖고 있어 원본 금액을 복원할 수 없으므로 undefined로 둔다(수정 화면은 실제 API 기준으로 검증).
  depositAmount?: number;
  monthlyRentAmount?: number | null;
  // 수정 폼 프리필용 원시 관리비(원 단위). depositAmount와 동일한 이유로 실제 API만 채워진다.
  // 관리비를 입력한 적 없으면 null, 0으로 명시했으면 0.
  maintenanceFeeAmount?: number | null;
  area?: number;
  description?: string;
  imageUrls: string[];
  // imageUrls와 같은 데이터를 담고 있지만 roomType까지 포함한 구조화된 형태 - 수정 화면에서
  // 기존 이미지를 라벨과 함께 다시 보여주고 편집할 때 쓴다. 상세 화면 캐러셀은 imageUrls만 쓴다.
  images: PropertyImage[];
  maintenance?: string;
  checkSignalCount?: number;
  signalSummary?: string;
  jeonseRatio?: number;
  checklist?: number;
  statusColor: string;
  location: PropertyLocation;
  createdAt?: string;
  // 실거래가 비교(market-data) 결과. 실제 API는 항상 채워진다(status가 AVAILABLE/UNAVAILABLE
  // 둘 중 하나) - "정보 없음"이 아니라 판정 결과 자체가 항상 존재한다는 뜻.
  marketComparison?: PropertyMarketComparison;
  // 로그인한 사용자 본인 기준 체크리스트 생성 여부 / 신고 여부. mock 데이터는 이 필드 자체가
  // 없어 undefined이고, 실제 API는 항상 boolean으로 채워진다.
  checklistCreated?: boolean;
  reported?: boolean;
};

/**
 * 목록 조회(GET /properties) 페이지네이션 결과. BE PageResponse를 그대로 옮기되 content만
 * PropertySummary로 매핑한다. mock 모드는 전체 목록을 단일 페이지로 감싸서 동일한 형태로 맞춘다.
 */
export type PropertyListPage = {
  items: PropertySummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

/**
 * BE MarketComparisonDto를 화면 표시용으로 가공한 형태. status가 UNAVAILABLE이면
 * referencePriceText 등 나머지 필드는 비어있고 message에 사유 문구만 채워진다.
 */
export type PropertyMarketComparison = {
  status: 'AVAILABLE' | 'UNAVAILABLE';
  referencePriceText?: string;
  differenceRateText?: string;
  sampleCount?: number;
  referenceDate?: string;
  // 실제 적용된 반경 단계(300 또는 600) - 반경이 확장됐는지 사용자에게 알려주기 위함.
  radiusMeters?: number;
  // UNAVAILABLE일 때 사유(월세/단독다가구/좌표없음/표본부족 등)를 그대로 보여준다.
  message?: string;
};

export type PropertyRiskSummary = {
  icon: LucideIcon;
  title: string;
  description: string;
  iconBoxClass: string;
  iconClass: string;
};

export type ChecklistCategoryId = 'indoor' | 'noise' | 'safety' | 'documents' | 'area';

export type ChecklistCategory = {
  id: ChecklistCategoryId;
  name: string;
  icon: LucideIcon;
};

export type ChecklistItemType = 'check' | 'yesNo' | 'date' | 'documentRequest';
export type ChecklistImportance = 'required' | 'general';

export type ChecklistItem = {
  id: number;
  category: ChecklistCategoryId;
  content: string;
  guideText: string | null;
  // 질문/guideText를 읽어도 남는 배경지식(용어, 왜 문제가 되는지)을 초등학생도 이해할 수 있게 풀어주는 문구.
  // guideText와 달리 일부 필수 항목에만 존재한다(예: 서비스 내에서 별도로 다루는 항목은 null).
  helperText: string | null;
  importance: ChecklistImportance;
  itemType: ChecklistItemType;
  checked: boolean;
  issueFound: boolean;
  value: string | null;
  userNote: string | null;
};

// Backend의 status(NOT_STARTED/IN_PROGRESS/COMPLETED)는 FE가 items로부터 직접 계산하는
// summary(app/lib/checklistSummary.ts)로 대체되므로 domain 타입엔 보관하지 않는다.
export type Checklist = {
  id: number;
  propertyId: number;
  items: ChecklistItem[];
};

export type ChecklistOverviewStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type ChecklistOverview = {
  propertyId: number;
  checklistId: number | null;
  address: string;
  propertyTitle: string;
  tradeType: PropertyTradeType;
  status: ChecklistOverviewStatus;
  // 표시용으로 이미 포맷된 문자열("2026.07.30"). 체크리스트가 있으면 마지막 항목 수정 시각,
  // 시작 전이면 매물 등록/수정 시각으로 Backend가 대체해서 내려준다(항상 값이 있음).
  lastCheckedAt: string;
};

// GET /checklists 페이지네이션 응답. Backend PageResponse를 그대로 옮기되 content만
// ChecklistOverview로 매핑한다(app/types/domain.ts의 PropertyListPage와 동일 패턴).
export type ChecklistOverviewPage = {
  items: ChecklistOverview[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

/**
 * 매물별 체크리스트 진행 상태를 요약 화면(홈/마이페이지)에 표시하기 위한 집계 타입.
 * status는 항상 알 수 있지만(ChecklistOverview 조회 한 번으로 끝남), progressPercent/cautionCount는
 * 체크리스트별로 getChecklistResult()를 추가 호출해야 해서 그 호출이 실패하면 undefined로 빠질 수 있다
 * - 이 경우 상태 문구만 보여주고 숫자는 생략한다(잘못된 숫자를 보여주는 것보다 안전).
 */
export type ChecklistProgress = {
  status: ChecklistOverviewStatus;
  progressPercent?: number;
  cautionCount?: number;
};

export type ContractClause = {
  originalText: string;
  riskFlag: boolean;
  explanation: string;
  question: string;
  suggestedText: string;
  levelLabel: string;
  levelColor: string;
};

export type ContractAnalysisResult = {
  clauses: ContractClause[];
  summary: string;
  aiGeneratedNotice: string;
  disclaimer: string;
};

export type ContractSummaryTone = 'orange' | 'slate';

export type ContractSummaryCard = {
  label: string;
  value: string;
  tone: ContractSummaryTone;
};

export type ContractAnalysisTab = 'risk' | 'deposit' | 'missing';

export type ContractTab = {
  key: ContractAnalysisTab;
  label: string;
};

export type ContractMissingItem = {
  title: string;
  description: string;
};

export type QuickActionTone = 'teal' | 'orange' | 'emerald' | 'blue';

export type QuickAction = {
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: QuickActionTone;
};

export type FeatureCardData = {
  icon: LucideIcon;
  title: string;
  description: string;
};

export type TonedFeatureCardData = FeatureCardData & {
  tone: string;
};

export type SummaryItem = readonly [label: string, value: string];

export type NavigationItem = {
  name: string;
  path: string;
  icon: LucideIcon;
};

export type ActivityHistoryItem = {
  title: string;
  type: string;
  date: string;
  status: string;
};

export type UserTransactionType = '전세' | '월세';

export type UserCurrentStage = '자취 처음' | '자취 경험 있음';

export type UserProfile = {
  nickname: string;
  // 소셜 로그인 provider가 이메일 동의항목을 요청하지 않았거나(카카오, 2026-07-29 기준
  // profile_nickname만 요청) 검증되지 않은 이메일이면 null — 이 경우 비밀번호를 설정해도
  // 로그인에 쓸 이메일이 없다(services/user.ts 비밀번호 설정 관련 화면 참고).
  email: string | null;
  profileImageUrl: string | null;
  interestRegion: string | null;
  transactionType: UserTransactionType | null;
  currentStage: UserCurrentStage | null;
  hasPassword: boolean;
};

export type ProfileUpdateInput = {
  nickname: string;
  interestRegion: string;
  transactionType: UserTransactionType | null;
  currentStage: UserCurrentStage | null;
};

export type HomeSummaryCounts = {
  interestedPropertyCount: number;
  signalsToCheckCount: number;
  activeChecklistCount: number;
  analyzedSpecialTermsCount: number;
};

export type PriorityAction = {
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
};

// --- risk-analysis 도메인 ---

export type RiskSignalTypeId = 'priceAnomaly' | 'duplicateListing' | 'sameAccountMultiple' | 'shortTermRelisting';
export type RiskCheckStatusId = 'success' | 'undeterminable' | 'failed';

export type RiskSignal = {
  signalType: RiskSignalTypeId;
  status: RiskCheckStatusId;
  // UNDETERMINABLE/FAILED일 때만 값 있음 — 이미 화면에 바로 쓸 한글 문구로 변환된 상태(app/data/risk-analysis.ts 매핑 참고).
  reasonText: string | null;
  // SUCCESS이면서 실제 리스크가 발견됐을 때만 값 있음.
  description: string | null;
  checkedAt: string;
};

export type RiskSignalList = {
  propertyId: number;
  signalCount: number;
  signals: RiskSignal[];
  disclaimer: string;
};

export type DepositSafetyStatusId = 'calculated' | 'unavailable' | 'failed' | 'notChecked';

export type DepositSafetyCheck = {
  propertyId: number;
  status: DepositSafetyStatusId;
  jeonseRatio: number | null;
  explanation: string | null;
  referenceDate: string | null;
  reasonText: string | null;
  calculatedAt: string | null;
  disclaimer: string;
  recentOwnershipChangeWarning: boolean;
};
