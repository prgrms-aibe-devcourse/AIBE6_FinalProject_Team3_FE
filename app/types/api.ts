import { type PropertyTradeType } from './domain';

export type ApiErrorBody = {
  code: string;
  message: string;
};

export type ApiResponse<T> =
  { success: true; data: T; error?: null } | { success: false; data?: undefined; error: ApiErrorBody };

// BE PageResponse<T> 그대로 - Spring Data Pageable 기반 목록 조회 응답의 공용 래퍼.
export type PageResponseDto<T> = {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
};

export type ApiStatusTone = 'orange' | 'emerald' | 'red' | 'slate';

export type PropertySummaryDto = {
  id: number;
  title: string;
  address: string;
  tradeType: PropertyTradeType;
  depositText: string;
  maintenanceText: string;
  marketDelta: string;
  checkSignalCount: number;
  signalSummary: string;
  jeonseRatio: number;
  checklistProgress: number;
  statusTone: ApiStatusTone;
  latitude: number;
  longitude: number;
};

export type ChecklistItemTypeDto = 'CHECK' | 'YES_NO' | 'DATE' | 'DOCUMENT_REQUEST' | 'MULTIPLE_CHOICE';
export type ChecklistImportanceDto = 'REQUIRED' | 'GENERAL';
export type ChecklistCategoryDto = 'INDOOR' | 'NOISE' | 'SAFETY' | 'DOCUMENTS' | 'AREA';
export type ChecklistStatusDto = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export type ChecklistItemDto = {
  id: number;
  category: ChecklistCategoryDto;
  content: string;
  guideText: string | null;
  // Backend checklist_item_template.helper_text 컬럼 — 일부 필수 항목에만 값이 있고 나머지는 null.
  helperText: string | null;
  importance: ChecklistImportanceDto;
  itemType: ChecklistItemTypeDto;
  checked: boolean;
  issueFound: boolean;
  value: string | null;
  userNote: string | null;
  // 문항 템플릿에 딸린 참고 이미지 URL 목록(관리자 등록, AI 생성 예시). 대부분 빈 배열.
  images: string[];
  // MULTIPLE_CHOICE 타입 문항의 선택지 목록(예: ["가스보일러", "기름보일러", ...]). 그 외 타입은 빈 배열.
  options: string[];
};

export type ChecklistDto = {
  id: number;
  propertyId: number;
  templateVersion: number;
  status: ChecklistStatusDto;
  items: ChecklistItemDto[];
};

// GET /checklists/{checklistId}/result 응답. Backend가 @JsonInclude(NON_NULL)이라
// message는 NOT_STARTED일 때만 오고, 그 외에는 필드 자체가 응답에서 빠진다.
export type ChecklistResultDto = {
  status: ChecklistStatusDto;
  checkedCount: number;
  totalCount: number;
  requiredMissingCount: number;
  issueCount: number;
  message?: string;
  // 상태와 무관하게 항상 내려오는 고정 문구("이 결과는 매물의 안전을 보장하지 않습니다.") — message와
  // 달리 NOT_STARTED 여부에 따라 생략되지 않는다.
  disclaimer: string;
};

// PATCH 요청 바디. checked만 바뀌는 CHECK 타입 문항은 { checked }, 값 입력이 필요한 YES_NO/DATE/
// DOCUMENT_REQUEST는 { value }, CHECK 타입을 "미흡"으로 표시(+메모)할 때는 { userNote }만 보낸다.
export type ChecklistItemUpdateRequestDto = { checked: boolean } | { value: string } | { userNote: string };

// GET /checklists 응답 원소 하나. checklistId는 아직 시작 안 한 매물이면 null.
export type ChecklistOverviewDto = {
  propertyId: number;
  title: string;
  checklistId: number | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  propertyType: PropertyTypeDto;
  transactionType: PropertyTransactionTypeDto;
  status: ChecklistStatusDto;
  // 체크리스트가 있으면 checklist.updatedAt, 없으면 property.updatedAt으로 Backend가 대체해서 내려준다.
  lastCheckedAt: string;
  // 체크리스트를 아직 시작 안 했으면 null(0%와 구분) - GROUP BY 집계 쿼리로 N+1 없이 계산된다.
  progressPercent: number | null;
  cautionCount: number | null;
};

// 계약 문구 분석 4단계 파이프라인: 입력 제출 -> OCR -> 마스킹 -> AI 분석.
// 서버는 분석 결과를 포함해 아무 것도 저장하지 않는 정책이라, ID로 이전 단계 상태를 참조하는
// 구조가 아니다 - 각 단계의 응답값을 클라이언트가 들고 있다가 다음 단계 요청에 그대로 실어 보낸다.
export type ContractInputType = 'TEXT' | 'IMAGE';
export type ContractInputNextStep = 'OCR' | 'MASKING';

// 이 요청은 JSON 바디가 아니라 multipart/form-data로 보낸다(TEXT/IMAGE 둘 다). 아래 타입은 각
// 필드가 폼 파트로 무엇을 담는지 문서화하는 용도이고, image는 File이라 여기 타입엔 포함하지 않는다.
export type ContractInputRequestDto = {
  inputType: ContractInputType;
  text?: string;
  propertyId?: number;
};

export type ContractInputResponseDto = {
  inputType: ContractInputType;
  readyForNextStep: boolean;
  nextStep: ContractInputNextStep;
};

// OCR 요청은 JSON 바디가 아니라 multipart/form-data(image 파일)라 별도 request DTO가 없다.
// OCR은 더 이상 신뢰도가 낮다고 422로 거부하지 않고 항상 200으로 응답하며, 대신 신뢰도가
// 낮았던 구간을 uncertainFields로 같이 내려줘서 사용자가 확인 단계에서 직접 검토하게 한다.
export type ContractOcrUncertainField = {
  text: string;
  index: number;
};

export type OcrExtractResponseDto = {
  extractedText: string;
  confidence: number;
  editable: boolean;
  uncertainFields: ContractOcrUncertainField[];
  // 인식된 텍스트 자체가 매우 짧을 때(흐린 사진, 잘못된 촬영 등) true - uncertainFields(특정 구간의
  // 낮은 신뢰도)와 달리 결과 전체의 신뢰도가 낮다는 신호라 더 강하게 안내해야 한다.
  shortTextWarning: boolean;
};

// upload -> result 페이지 전달용 조합 페이로드. 백엔드가 내려주는 단일 응답이 아니라, OCR 단계의
// uncertainFields와 마스킹 단계의 maskedText/maskedCount를 FE가 한 번에 묶어 query string에 싣는다.
// 텍스트 직접 입력 경로는 OCR을 안 거치므로 uncertainFields가 항상 빈 배열이다.
// propertyId는 매물 상세/체크리스트 화면에서 "계약분석하기"로 넘어온 경우에만 있고, 그 외에는
// undefined - result 페이지가 "계약 체크리스트로 이동" 버튼을 보여줄지 결정하는 데도 쓰인다.
export type ContractMaskingReviewPayload = {
  maskedText: string;
  maskedCount: number;
  uncertainFields: ContractOcrUncertainField[];
  // OCR 응답의 shortTextWarning 그대로 - 텍스트 직접 입력 경로는 OCR을 안 거치므로 항상 false다.
  shortTextWarning: boolean;
  // upload 화면에서 실제로 선택한 입력 경로 그대로("TEXT"/"IMAGE") - analyzeContract 요청에도
  // 그대로 실어 보낸다.
  inputType: ContractInputType;
  propertyId?: number;
};

export type ContractMaskingRequestDto = {
  text: string;
};

export type ContractMaskingResponseDto = {
  maskedText: string;
  maskedCount: number;
  requiresUserConfirmation: boolean;
};

export type ContractAnalyzeRequestDto = {
  maskedText: string;
  userConfirmed: boolean;
  inputType: ContractInputType;
  propertyId?: number;
};

export type ContractClauseDto = {
  originalText: string;
  riskFlag: boolean;
  explanation: string;
  question: string;
  suggestedText: string;
};

export type ContractAnalysisResultDto = {
  clauses: ContractClauseDto[];
  summary: string;
  aiGeneratedNotice: string;
  disclaimer: string;
};

// POST /contract-analysis/chat. 조항 카드 안 미니 채팅에서 쓰는 추가 질문 - 이 조항 하나에 한정된
// 대화라 clause 원문/위험여부/설명을 매번 같이 실어 보내고(서버 무저장 정책과 같은 이유로 이전 대화도
// history로 들고 다님), 조항 카드 밖의 다른 대화와는 섞이지 않는다.
export type ContractChatClauseContext = {
  originalText: string;
  riskFlag: boolean;
  explanation: string;
};

// Backend ContractAnalysisChatMessage(role/content만 받음)와 동일한 형태 - 한 번의 질문/답변
// 턴이 "user" 메시지 하나 + "assistant" 메시지 하나로 나뉘어 시간순으로 배열에 들어간다.
export type ContractChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type ContractChatRequestDto = {
  clause: ContractChatClauseContext;
  question: string;
  history?: ContractChatMessage[];
};

// 응답 형태는 명세받은 게 없어 analyzeContract 응답(ContractAnalysisResultDto)과 같은 패턴으로
// 맞춰 추정했다 - answer 하나에 aiGeneratedNotice/disclaimer가 매 답변마다 같이 내려온다고 가정.
// 실제 백엔드 응답이 다르면 이 타입과 mapper만 고치면 된다.
export type ContractChatResponseDto = {
  answer: string;
  aiGeneratedNotice: string;
  disclaimer: string;
};

// GET /users/me/contract-history 응답 목록 원소 하나(PageResponseDto<ContractHistoryItemDto>로 감싸짐).
// 분석 성공 후에만 생성되는 불변 기록 - status는 Backend에 "COMPLETED" 한 종류뿐이라 FE에서 옮기지
// 않는다. propertyId는 매물과 연결하지 않고 분석했으면 null.
export type ContractHistoryItemDto = {
  id: number;
  propertyId: number | null;
  inputType: ContractInputType;
  summary: string;
  clauseCount: number;
  riskCount: number;
  status: string;
  createdAt: string;
};

// GET /users/me/contract-history/{id} 응답의 조항 하나. 원문(originalText)은 계약 원문을 DB에
// 남기지 않는 정책상 애초에 저장되지 않아 이 응답엔 없다 - analyze 응답의 ContractClauseDto와
// 다른 점(originalText 유무)이 이 타입을 따로 둔 이유다.
export type ContractHistoryClauseDto = {
  riskFlag: boolean;
  explanation: string;
  question: string;
  suggestedText: string;
};

// GET /users/me/contract-history/{id} 응답. 목록(ContractHistoryItemDto)과 겹치는 필드에
// disclaimer/aiGeneratedNotice/clauses가 추가된 형태 - 이 화면(마이페이지 이력 아코디언)은
// clauses만 쓰므로 서비스 계층에서 나머지는 버린다.
export type ContractHistoryDetailDto = {
  id: number;
  propertyId: number | null;
  inputType: ContractInputType;
  summary: string;
  clauseCount: number;
  riskCount: number;
  disclaimer: string;
  aiGeneratedNotice: string;
  status: string;
  createdAt: string;
  clauses: ContractHistoryClauseDto[];
};

export type ActivityHistoryItemDto = {
  title: string;
  type: string;
  date: string;
  status: string;
};

export type MeResponseDto = {
  userId: number;
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  // AdminRoleDto('USER' | 'ADMIN')와 같은 값이다 - admin 게이트 3곳(MainLayoutGate, (main)/layout.tsx,
  // admin/layout.tsx)이 전부 이 필드 하나로 관리자 여부를 판단하는데, 예전엔 그냥 string이라
  // 오타("Admin" 등)나 백엔드 계약 변경을 컴파일 타임에 전혀 못 잡았다.
  role: AdminRoleDto;
};

export type PasswordPolicyDto = {
  // <input pattern="..."> 속성값으로 그대로 쓸 수 있는 정규식(앞뒤 ^/$ 없음).
  pattern: string;
  message: string;
};

// 관심 거래유형(User 도메인) 표기 - property 도메인의 PropertyTransactionTypeDto와 같은 전세/월세
// 개념이고 현재는 값도 동일하다('MONTHLY_RENT', 2026-08-14 확인 - 이전엔 'WOLSE'로 잘못 알고 있었음,
// backend `com.algogyeyak.user.enums.TransactionType` 참고). 다만 User/Property 도메인 각자의
// 백엔드 enum이라 독립적으로 바뀔 수 있으니 같은 타입으로 합치지 말고 따로 둔다.
export type UserTransactionTypeDto = 'JEONSE' | 'MONTHLY_RENT';

export type UserProfileDto = {
  id: number;
  email: string | null;
  nickname: string;
  profileImageUrl: string | null;
  status: string;
  interestRegion: string | null;
  transactionType: UserTransactionTypeDto | null;
  currentStage: string | null;
  hasPassword: boolean;
};

export type ProfileUpdateRequestDto = {
  nickname?: string;
  interestRegion?: string;
  transactionType?: UserTransactionTypeDto;
  currentStage?: string;
};

// POST /users/me/profile-image/presign 요청/응답. S3에 직접 PUT하기 전 업로드용 presigned URL과
// 그 업로드가 저장될 key를 발급받는다 - 실제 파일 바이트는 이 엔드포인트가 아니라 uploadUrl로 보낸다.
export type ProfileImagePresignRequestDto = {
  fileExtension: string;
  contentType: string;
  fileSize: number;
};

export type ProfileImagePresignResponseDto = {
  uploadUrl: string;
  key: string;
  // S3 PUT 요청에 그대로 실어 보내야 하는 x-amz-tagging 헤더 값(예: "status=pending"). presign 시
  // 서명에 이 태그가 포함되므로, 값이 다르면 S3가 서명 불일치(403)로 거부한다 - 값 자체를 프론트가
  // 하드코딩하지 않고 이 응답을 그대로 쓰는 이유는 PasswordPolicyDto와 동일하다.
  tagging: string;
};

// POST /users/me/profile-image/confirm 요청. presign으로 받은 uploadUrl에 실제 PUT이 끝난 뒤,
// 그 key로 업로드가 완료됐는지 서버가 재확인하고 profileImageUrl을 갱신한다.
export type ProfileImageConfirmRequestDto = {
  key: string;
};

export type ProfileRegisterRequestDto = {
  interestRegion: string;
  transactionType: UserTransactionTypeDto;
  currentStage?: string;
};

export type NicknameCheckResponseDto = {
  available: boolean;
};

export type NicknamePolicyDto = {
  // <input pattern="..."> 속성값으로 그대로 쓸 수 있는 정규식(앞뒤 ^/$ 없음).
  pattern: string;
  message: string;
};

// --- Property CRUD (실제 백엔드 응답 형태. PropertySummaryDto는 아직 없는 기능(신호/전세가율/
// 체크리스트 등)까지 포함한 목업 전용 타입이라 분리해서 둔다) ---

export type PropertyTypeDto = 'OFFICETEL' | 'MULTI_FAMILY' | 'DETACHED_HOUSE';
// User 도메인의 UserTransactionTypeDto와 같은 전세/월세 개념이고 현재 값도 동일하다
// ('MONTHLY_RENT') - 서로 다른 백엔드 enum(Property/User 도메인 각자의 TransactionType)이라
// 독립적으로 바뀔 수 있으니 같은 타입으로 합치지 말고 따로 둔다.
export type PropertyTransactionTypeDto = 'JEONSE' | 'MONTHLY_RENT';
export type PropertyStatusDto = 'ACTIVE' | 'DELETED';

// 매물 이미지가 어느 공간을 찍은 사진인지 라벨. 선택값 - 라벨 없이 올릴 수도 있다(null).
export type RoomTypeDto =
  'LIVING_ROOM' | 'BEDROOM' | 'BATHROOM' | 'KITCHEN' | 'ENTRANCE' | 'VERANDA' | 'EXTERIOR' | 'ETC';

// 등록/수정 요청과 상세 응답 양쪽에서 공용으로 쓰는 이미지 한 장의 형태.
// imageUrl은 이미지 업로드 API(POST /properties/images/upload-url → S3 PUT → confirm)를 거쳐
// 받은 확정 URL이어야 한다.
export type PropertyImageDto = {
  imageUrl: string;
  roomType: RoomTypeDto | null;
};

export type CreatePropertyRequestDto = {
  title: string;
  address: string;
  propertyType: PropertyTypeDto;
  transactionType: PropertyTransactionTypeDto;
  deposit: number;
  monthlyRent?: number | null;
  area: number;
  // 선택 입력 - 관리비 없는 매물도 있어 생략 가능. 값이 있으면 0 이상이어야 한다(BE @PositiveOrZero).
  maintenanceFee?: number | null;
  description?: string | null;
  images?: PropertyImageDto[];
};

// POST /properties/images/upload-url 요청/응답. 업로드할 파일의 확장자/컨텐츠타입/바이트수를
// 보내면 presigned PUT URL과 그 URL이 가리키는 S3 key를 받는다.
export type PropertyImageUploadUrlRequestDto = {
  fileExtension: string;
  contentType: string;
  fileSize: number;
};

export type PropertyImageUploadUrlResponseDto = {
  uploadUrl: string;
  key: string;
  // S3에 직접 PUT할 때 x-amz-tagging 헤더에 그대로 실어 보내야 하는 값. presign 서명에 포함돼
  // 있어 값이 다르면 S3가 403을 반환한다 (BE PropertyImageUploadUrlResponse.tagging 참고).
  tagging: string;
};

// POST /properties/images/confirm 요청/응답. S3에 실제 업로드가 끝난 뒤 이 key로 호출하면
// 백엔드가 업로드 완료 여부를 확인하고 영구 조회 URL을 돌려준다 - 이 imageUrl을 등록/수정
// 요청의 images[].imageUrl로 그대로 쓰면 된다.
export type PropertyImageConfirmRequestDto = {
  key: string;
};

export type PropertyImageConfirmResponseDto = {
  imageUrl: string;
};

export type PropertyAddressDto = {
  roadAddress: string | null;
  jibunAddress: string | null;
  latitude: number;
  longitude: number;
};

export type MarketComparisonDto = {
  status: 'UNAVAILABLE' | 'AVAILABLE';
  referencePrice: number | null;
  differenceRate: number | null;
  sampleCount: number | null;
  referenceDate: string | null;
  // 실제 적용된 반경 단계(300 또는 600). status가 UNAVAILABLE이면 null.
  radiusMeters: number | null;
  // 표본 필터링에 쓰인 면적오차 허용율(0.2 = ±20%). status가 UNAVAILABLE이면 null.
  areaErrorRate: number | null;
  // 실거래를 조회한 개월 수. status가 UNAVAILABLE이면 null.
  lookbackMonths: number | null;
  // UNAVAILABLE 사유를 사람이 읽을 수 있는 문장으로 내려준다(월세/단독다가구/좌표없음/표본부족 등).
  // AVAILABLE이면 null.
  message: string | null;
};

export type CreatePropertyResponseDto = {
  propertyId: number;
  status: PropertyStatusDto;
  address: PropertyAddressDto;
  marketComparison: MarketComparisonDto;
  notice: string | null;
};

export type PropertyListItemDto = {
  propertyId: number;
  title: string;
  propertyType: PropertyTypeDto;
  transactionType: PropertyTransactionTypeDto;
  deposit: number;
  monthlyRent: number | null;
  area: number;
  // 관리비 없는 매물이면 null.
  maintenanceFee: number | null;
  roadAddress: string | null;
  jibunAddress: string | null;
  status: PropertyStatusDto;
  createdAt: string;
  // 체크리스트를 아예 시작 안 했으면 null(분모가 없음), 시작했으면 0~100 사이 정수(반올림).
  checklistProgress: number | null;
  marketComparison: MarketComparisonDto;
  // risk-analysis를 한 번도 안 돌린 매물이면 null(0건과 구분됨), 돌렸다면 실제 발견된 신호 개수.
  checkSignalCount: number | null;
  // checkSignalCount가 0 이하이면 null. 발견된 신호들의 설명을 이어붙인 요약 문자열.
  signalSummary: string | null;
  // DepositSafetyCheck.status가 CALCULATED일 때만 값 존재(percent 정수, "%" 미포함).
  jeonseRatio: number | null;
  // 가장 먼저 업로드된 이미지 URL. 매물에 이미지가 한 장도 없으면 null.
  representativeImageUrl: string | null;
};

export type PropertyDetailAddressDto = {
  roadAddress: string | null;
  jibunAddress: string | null;
  latitude: number | null;
  longitude: number | null;
};

// GET /properties/{id} 응답. 목록과 달리 설명/이미지/전체 주소/시세비교까지 포함한다.
export type PropertyDetailResponseDto = {
  propertyId: number;
  title: string;
  propertyType: PropertyTypeDto;
  transactionType: PropertyTransactionTypeDto;
  deposit: number;
  monthlyRent: number | null;
  area: number;
  // 관리비 없는 매물이면 null.
  maintenanceFee: number | null;
  description: string | null;
  address: PropertyDetailAddressDto;
  images: PropertyImageDto[];
  marketComparison: MarketComparisonDto;
  // 로그인한 사용자 본인 기준 - 체크리스트를 생성했는지, 본인이 이 매물을 신고한 적 있는지.
  checklistCreated: boolean;
  reported: boolean;
  status: PropertyStatusDto;
  createdAt: string;
  updatedAt: string;
};

// PATCH /properties/{id} 요청. 주소/매물유형/거래유형은 등록 시 확정값이라 수정 대상에서 제외된다
// (변경하려면 재등록 필요 - BE PropertyUpdateRequest 주석 참고).
// images는 생략하거나 undefined면 "이미지 변경 없음"(기존 유지), 값을 보내면(빈 배열 포함)
// 기존 이미지를 전부 지우고 통째로 교체한다 - BE PropertyUpdateRequest 주석 참고.
export type UpdatePropertyRequestDto = {
  title: string;
  deposit: number;
  monthlyRent?: number | null;
  area: number;
  // 선택 입력 - 관리비 없는 매물도 있어 생략 가능. 값이 있으면 0 이상이어야 한다(BE @PositiveOrZero).
  maintenanceFee?: number | null;
  description?: string | null;
  images?: PropertyImageDto[];
};

// POST /properties/{id}/reports. 마켓플레이스식 "타인 매물 신고"가 아니라 본인이 등록한 매물을
// 본인이 직접 신고하는 자가 플래그 - ETC 선택 시에만 detail이 필수(그 외에는 서버가 null로 강제).
export type PropertyReportReasonDto = 'ALREADY_CONTRACTED' | 'PRICE_MISMATCH' | 'INFO_MISMATCH' | 'DUPLICATE' | 'ETC';

export type ReportPropertyRequestDto = {
  reason: PropertyReportReasonDto;
  detail?: string | null;
};

export type PropertyReportResponseDto = {
  reportId: number;
  propertyId: number;
  reason: PropertyReportReasonDto;
  detail: string | null;
  status: string;
  createdAt: string;
};

// --- 관리자 페이지: 유저 관리 (GET/PATCH /admin/users) ---

export type AdminRoleDto = 'USER' | 'ADMIN';
export type AdminUserStatusDto = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWN';

export type AdminUserListItemDto = {
  id: number;
  email: string | null;
  nickname: string;
  role: AdminRoleDto;
  status: AdminUserStatusDto;
  createdAt: string;
};

export type AdminUserDetailDto = AdminUserListItemDto & {
  profileImageUrl: string | null;
  updatedAt: string;
};

export type AdminUserRoleUpdateRequestDto = {
  role: AdminRoleDto;
};

// WITHDRAWN은 본인 탈퇴 플로우 전용이라 관리자 페이지에서는 ACTIVE/SUSPENDED만 보낸다.
export type AdminUserStatusUpdateRequestDto = {
  status: 'ACTIVE' | 'SUSPENDED';
};

export type AdminUserBulkStatusUpdateRequestDto = {
  userIds: number[];
  status: 'ACTIVE' | 'SUSPENDED';
};

// 일괄 처리는 원자적 전체성공/전체실패가 아니라 항목별로 성공/실패가 갈릴 수 있다(자기 자신 변경
// 금지, 마지막 관리자 보호 등 기존 단건 API의 가드가 그대로 적용됨) - backend
// AdminBulkActionResponse와 대응.
export type AdminBulkActionResponseDto = {
  succeededIds: number[];
  failures: { id: number; message: string }[];
};

// --- 관리자 페이지: 매물 신고 검토 (GET/PATCH /admin/property-reports) ---

export type AdminPropertyReportStatusDto = 'RECEIVED' | 'RESOLVED' | 'REJECTED';

export type AdminPropertyReportListItemDto = {
  id: number;
  propertyId: number;
  propertyAddress: string | null;
  reporterId: number;
  reporterNickname: string | null;
  reason: PropertyReportReasonDto;
  detail: string | null;
  status: AdminPropertyReportStatusDto;
  createdAt: string;
};

export type AdminPropertyReportDetailDto = {
  id: number;
  propertyType: PropertyTypeDto | null;
  transactionType: PropertyTransactionTypeDto | null;
  propertyAddress: string | null;
  reporterId: number;
  reporterNickname: string | null;
  reporterEmail: string | null;
  reason: PropertyReportReasonDto;
  detail: string | null;
  status: AdminPropertyReportStatusDto;
  reviewedAt: string | null;
  reviewMemo: string | null;
  createdAt: string;
};

// status는 RESOLVED/REJECTED만 허용한다 - RECEIVED로 되돌리는 것은 이 API의 목적이 아니다.
export type AdminPropertyReportReviewRequestDto = {
  status: 'RESOLVED' | 'REJECTED';
  memo?: string;
};

export type AdminPropertyReportBulkReviewRequestDto = {
  reportIds: number[];
  status: 'RESOLVED' | 'REJECTED';
  memo?: string;
};

// --- 관리자 페이지: 통계 대시보드 (GET /admin/stats/dashboard) ---

// 세 값 전부 "전체 누적"이 아니라 대시보드 조회 기간 내 신규 발생분이다(backend
// AdminStatsService.summary() 참고) - 예전 필드명(totalUsers 등)이 이 사실과 반대로 읽혀
// API 계약을 헷갈리게 했던 것을 backend와 함께 정정했다.
export type AdminStatsSummaryDto = {
  newUsers: number;
  newProperties: number;
  newPendingReports: number;
};

export type AdminStatsTrendPointDto = { date: string; count: number };

export type AdminStatsTrendDto = {
  signups: AdminStatsTrendPointDto[];
  propertyRegistrations: AdminStatsTrendPointDto[];
};

export type AdminPropertyRegistrationCountDto = { registered: boolean; count: number };
export type AdminReportReasonCountDto = { reason: PropertyReportReasonDto; count: number };

export type AdminStatsDistributionDto = {
  byPropertyRegistration: AdminPropertyRegistrationCountDto[];
  byReportReason: AdminReportReasonCountDto[];
};

export type AdminDashboardStatsDto = {
  summary: AdminStatsSummaryDto;
  trends: AdminStatsTrendDto;
  distributions: AdminStatsDistributionDto;
};

// --- 관리자 페이지: 체크리스트 문항 템플릿 관리 (/admin/checklist-templates) ---
// 이 문항 템플릿은 스냅샷 방식으로 유저 체크리스트에 복사되므로(checklist-design.md 참고),
// 여기서의 수정/삭제는 이미 만들어진 유저 체크리스트에는 영향을 주지 않고 이후 생성되는
// 체크리스트에만 반영된다.

export type ChecklistItemCodeDto =
  | 'TRUST_REGISTRATION'
  | 'OWNERSHIP_MATCH'
  | 'OWNERSHIP_ACQUISITION_DATE'
  | 'TAX_DELINQUENCY_NOTICE'
  | 'DATE_OF_CONFIRMATION_REQUEST'
  | 'RESIDENT_REGISTRATION_REQUEST';

export type AdminChecklistItemTemplateDto = {
  id: number;
  version: number;
  code: ChecklistItemCodeDto | null;
  category: ChecklistCategoryDto;
  content: string;
  guideText: string | null;
  helperText: string | null;
  importance: ChecklistImportanceDto;
  itemType: ChecklistItemTypeDto;
  // MULTIPLE_CHOICE 타입 문항의 선택지("가스보일러,기름보일러,전기보일러,지역난방" 형식). 그 외 타입은 null.
  options: string | null;
  displayOrder: number;
  active: boolean;
  applicablePropertyTypes: string | null;
};

// version은 서버가 자동 배정하므로 요청에 포함하지 않는다.
export type AdminChecklistItemTemplateCreateRequestDto = {
  category: ChecklistCategoryDto;
  content: string;
  guideText?: string | null;
  helperText?: string | null;
  importance: ChecklistImportanceDto;
  itemType: ChecklistItemTypeDto;
  // MULTIPLE_CHOICE 타입 문항의 선택지("가스보일러,기름보일러,전기보일러,지역난방" 형식). 그 외 타입은 사용하지 않는다.
  options?: string | null;
  code?: ChecklistItemCodeDto | null;
  displayOrder: number;
  applicablePropertyTypes?: string | null;
};

export type AdminChecklistItemTemplateUpdateRequestDto = AdminChecklistItemTemplateCreateRequestDto & {
  active: boolean;
};

// 문항 템플릿에 딸린 예시 이미지(관리자 관리용). 파일 업로드는 지원하지 않고, 이미 S3에 올라간
// 이미지의 URL만 입력받는다 - Backend AdminChecklistTemplateController 주석 참고.
export type AdminChecklistItemTemplateImageDto = {
  id: number;
  imageUrl: string;
  displayOrder: number;
};

// displayOrder는 서버가 자동 배정한다(항상 맨 뒤에 추가).
export type AdminChecklistItemTemplateImageCreateRequestDto = {
  imageUrl: string;
};

// --- risk-analysis 도메인 (Backend: com.algogyeyak.riskanalysis.**) ---

export type RiskSignalTypeDto =
  'PRICE_ANOMALY' | 'DUPLICATE_LISTING' | 'SAME_ACCOUNT_MULTIPLE' | 'SHORT_TERM_RELISTING';
export type RiskCheckStatusDto = 'SUCCESS' | 'UNDETERMINABLE' | 'FAILED';
export type RiskCheckReasonDto =
  | 'NO_COMPARABLE_TRANSACTION'
  | 'ADDRESS_INFO_MISSING'
  | 'PROPERTY_TYPE_UNSUPPORTED'
  // (2026-08-14) 월세(거래유형 미지원)를 PROPERTY_TYPE_UNSUPPORTED와 구분하기 위해 신설됨 -
  // risk-analysis-design.md 전수조사 결과 버그 2번 참고.
  | 'TRANSACTION_TYPE_UNSUPPORTED'
  | 'POLICY_CALCULATION_ERROR'
  | 'DATA_FETCH_FAILURE'
  | 'INTERNAL_ERROR';

// GET /properties/{propertyId}/risk-signals 응답의 원소 하나.
export type RiskSignalDto = {
  signalType: RiskSignalTypeDto;
  status: RiskCheckStatusDto;
  reason: RiskCheckReasonDto | null;
  description: string | null; // SUCCESS이면서 리스크가 실제로 발견된 경우에만 값 있음
  checkedAt: string;
};

// GET /properties/{propertyId}/risk-signals 응답.
export type RiskSignalListDto = {
  propertyId: number;
  signalCount: number;
  signals: RiskSignalDto[];
  disclaimer: string;
};

// POST /properties/{propertyId}/risk-analysis 응답. 화면 렌더링에는 안 쓰고(신호 상세는
// GET /risk-signals가 담당), 판정 트리거 호출의 반환 타입을 명시하기 위해 정의한다.
export type RiskAnalysisSummaryDto = {
  propertyId: number;
  signalCount: number;
  policyVersion: string;
  calculatedAt: string;
};

export type DepositSafetyStatusDto = 'CALCULATED' | 'UNAVAILABLE' | 'FAILED';
export type DepositSafetyCheckReasonDto =
  | 'ESTIMATED_PRICE_MISSING'
  | 'DEPOSIT_INFO_MISSING'
  | 'TRANSACTION_TYPE_UNSUPPORTED'
  | 'CALCULATION_DATA_INVALID'
  | 'INTERNAL_ERROR';

// GET /properties/{propertyId}/deposit-safety, POST .../recalculate 공용 응답.
export type DepositSafetyCheckDto = {
  propertyId: number;
  status: DepositSafetyStatusDto | null; // 한 번도 계산 안 됐으면 null (자동 트리거 덕분에 실사용에선 거의 안 생김)
  jeonseRatio: number | null;
  seniorDepositApplied: boolean;
  seniorDeposit: number | null;
  maxClaimAmount: number | null;
  explanation: string | null;
  referenceDate: string | null;
  sampleCount: number | null; // 기준가 산출에 쓰인 매매 실거래가 표본 수. CALCULATED일 때만
  radiusMeters: number | null; // 표본 탐색 반경(300 또는 600). CALCULATED일 때만
  reason: DepositSafetyCheckReasonDto | null;
  calculatedAt: string | null;
  disclaimer: string;
  recentOwnershipChangeWarning: boolean;
  cautionFrom: number | null; // 전세가율 판정 기준값(%) - 이 값부터 "주의". 계산 여부와 무관하게 항상 내려옴
  warnFrom: number | null; // 이 값부터 "위험"
  warnTo: number | null; // 이 값을 넘으면 "입력값 재확인 안내"
};

// POST /properties/{propertyId}/deposit-safety/recalculate 요청. seniorDeposit(선순위보증금)은
// 필수, maxClaimAmount(근저당 채권최고액)는 선택 - 둘 다 원(KRW) 단위 정수.
export type DepositSafetyRecalculateRequestDto = {
  seniorDeposit: number;
  maxClaimAmount?: number;
};
