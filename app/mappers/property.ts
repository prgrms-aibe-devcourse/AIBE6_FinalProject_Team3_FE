import {
  type ApiStatusTone,
  type MarketComparisonDto,
  type PropertyDetailResponseDto,
  type PropertyImageDto,
  type PropertyListItemDto,
  type PropertySummaryDto,
  type PropertyTransactionTypeDto,
  type PropertyTypeDto,
  type RoomTypeDto,
} from '../types/api';
import {
  type PropertyDetail,
  type PropertyImage,
  type PropertyMarketComparison,
  type PropertySummary,
  type PropertyTradeType,
} from '../types/domain';

const propertyStatusColorMap: Record<ApiStatusTone, string> = {
  orange: 'bg-orange-100 text-orange-700',
  emerald: 'bg-emerald-100 text-emerald-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function mapPropertySummaryDto(dto: PropertySummaryDto): PropertySummary {
  return {
    id: dto.id,
    title: dto.title,
    address: dto.address,
    type: dto.tradeType,
    deposit: dto.depositText,
    maintenance: dto.maintenanceText,
    marketDelta: dto.marketDelta,
    checkSignalCount: dto.checkSignalCount,
    signalSummary: dto.signalSummary,
    jeonseRatio: dto.jeonseRatio,
    checklist: dto.checklistProgress,
    statusColor: propertyStatusColorMap[dto.statusTone],
    location: {
      latitude: dto.latitude,
      longitude: dto.longitude,
    },
  };
}

export const propertyTypeLabelMap: Record<PropertyTypeDto, string> = {
  OFFICETEL: '오피스텔',
  MULTI_FAMILY: '연립다세대',
  DETACHED_HOUSE: '단독/다가구',
};

export const propertyTransactionTypeLabelMap: Record<PropertyTransactionTypeDto, PropertyTradeType> = {
  JEONSE: '전세',
  MONTHLY_RENT: '월세',
};

export const roomTypeLabelMap: Record<RoomTypeDto, string> = {
  LIVING_ROOM: '거실',
  BEDROOM: '침실',
  BATHROOM: '화장실',
  KITCHEN: '주방',
  ENTRANCE: '현관',
  VERANDA: '베란다',
  EXTERIOR: '외관',
  ETC: '기타',
};

function mapPropertyImageDto(dto: PropertyImageDto): PropertyImage {
  return { imageUrl: dto.imageUrl, roomType: dto.roomType };
}

// 백엔드는 원(KRW) 단위 정수를 그대로 내려주고, 화면에는 만원 단위 한글 표기로 보여준다: "1억 8,000만원".
// 전세/월세 어느 쪽이든 항상 같은 형식으로 단위를 붙인다 - 예전엔 월세 쪽(보증금/월세 두 금액)만
// 단위 없이 숫자만 보여줘서 "9,000만원"과 "보증금 3,000 / 월세 55"처럼 표기가 안 맞았다.
function formatManwon(amountWon: number): string {
  const manwon = Math.round(amountWon / 10_000);
  const eok = Math.floor(manwon / 10_000);
  const remainder = manwon % 10_000;

  if (eok > 0) {
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만원` : `${eok}억원`;
  }

  return `${manwon.toLocaleString()}만원`;
}

function formatDepositText(
  transactionType: PropertyTransactionTypeDto,
  deposit: number,
  monthlyRent: number | null,
): string {
  if (transactionType === 'MONTHLY_RENT' && monthlyRent) {
    return `보증금 ${formatManwon(deposit)} / 월세 ${formatManwon(monthlyRent)}`;
  }

  return formatManwon(deposit);
}

// 관리비를 아예 입력한 적 없으면(null) undefined("정보 없음"과 구분되는 "관리비 자체를 안 물어본 상태"),
// 0으로 명시했으면 "관리비 없음", 양수면 "관리비 N만원" 형식으로 표시한다.
function formatMaintenanceText(maintenanceFee: number | null): string | undefined {
  if (maintenanceFee === null) {
    return undefined;
  }
  if (maintenanceFee === 0) {
    return '관리비 없음';
  }
  return `관리비 ${formatManwon(maintenanceFee)}`;
}

/**
 * 실제 GET /properties 응답(PropertyListItemDto) -> PropertySummary 변환.
 * checkSignalCount/signalSummary/jeonseRatio는 risk-analysis를 한 번도 안 돌린 매물이면 BE가
 * null을 내려주는데, PropertySummary 쪽은 undefined일 때 "준비 중"으로 표시하는 구조라
 * null -> undefined로 변환한다(checklistProgress와 동일 패턴). 시세대비(marketDelta)는
 * marketComparison이 AVAILABLE일 때만 채우고, UNAVAILABLE/판정불가면 undefined로 둬서
 * "준비 중"이 아니라 상세페이지처럼 사유가 있는 판정불가 상태임을 구분할 수 있게 한다 - 다만
 * 카드 UI 자체는 아직 이 둘을 구분해 보여주지 않고 둘 다 "준비 중"으로만 표시한다(추후 개선 여지).
 * location도 목록 응답엔 좌표가 없어 0,0으로 채우는데, 목록 카드에서는 좌표를 쓰지 않는다.
 */
export function mapPropertyListItemDto(dto: PropertyListItemDto): PropertySummary {
  return {
    id: dto.propertyId,
    title: dto.title,
    address: dto.roadAddress ?? dto.jibunAddress ?? '주소 정보 없음',
    type: propertyTransactionTypeLabelMap[dto.transactionType],
    deposit: formatDepositText(dto.transactionType, dto.deposit, dto.monthlyRent),
    propertyType: propertyTypeLabelMap[dto.propertyType],
    maintenance: formatMaintenanceText(dto.maintenanceFee),
    checklist: dto.checklistProgress ?? undefined,
    checkSignalCount: dto.checkSignalCount ?? undefined,
    signalSummary: dto.signalSummary ?? undefined,
    jeonseRatio: dto.jeonseRatio ?? undefined,
    marketDelta:
      dto.marketComparison.status === 'AVAILABLE' && dto.marketComparison.differenceRate !== null
        ? formatMarketDelta(dto.marketComparison.differenceRate)
        : undefined,
    statusColor: propertyStatusColorMap.slate,
    location: { latitude: 0, longitude: 0 },
    representativeImageUrl: dto.representativeImageUrl ?? undefined,
  };
}

// "2026-07-24T10:26:13.9" -> "2026.07.24"
export function formatDateText(isoDateTime: string): string {
  const date = new Date(isoDateTime);
  if (Number.isNaN(date.getTime())) {
    return isoDateTime;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
}

function formatMarketDelta(differenceRate: number): string {
  const percent = Math.round(differenceRate * 100);
  return percent >= 0 ? `+${percent}%` : `${percent}%`;
}

/**
 * BE MarketComparisonDto -> 화면 표시용 PropertyMarketComparison 변환. status와 무관하게
 * 항상 객체를 만든다 - UNAVAILABLE이어도 사유(message)를 보여줘야 하기 때문에 "값이 없으면
 * undefined"가 아니라 "값이 있고 status로 분기"가 맞는 형태다.
 */
function mapMarketComparisonDto(dto: MarketComparisonDto): PropertyMarketComparison {
  return {
    status: dto.status,
    referencePriceText: dto.referencePrice !== null ? formatManwon(dto.referencePrice) : undefined,
    differenceRateText: dto.differenceRate !== null ? formatMarketDelta(dto.differenceRate) : undefined,
    sampleCount: dto.sampleCount ?? undefined,
    referenceDate: dto.referenceDate ? formatDateText(dto.referenceDate) : undefined,
    radiusMeters: dto.radiusMeters ?? undefined,
    areaErrorRate: dto.areaErrorRate ?? undefined,
    lookbackMonths: dto.lookbackMonths ?? undefined,
    message: dto.message ?? undefined,
  };
}

/**
 * 실제 GET /properties/{id} 응답(PropertyDetailResponseDto) -> PropertyDetail 변환.
 * marketComparison은 BE의 실거래가 비교 로직이 실제로 계산한 결과(AVAILABLE/UNAVAILABLE)를
 * 그대로 옮겨 담는다. 신호(기능4)/전세가율(기능5)는 아직 API 자체가 없어 항상 undefined.
 * checklistCreated/reported는 체크리스트 생성 여부·본인 신고 여부 필드가 추가되면서 함께 반영된다.
 */
export function mapPropertyDetailResponseDto(dto: PropertyDetailResponseDto): PropertyDetail {
  return {
    id: dto.propertyId,
    title: dto.title,
    address: dto.address.roadAddress ?? dto.address.jibunAddress ?? '주소 정보 없음',
    type: propertyTransactionTypeLabelMap[dto.transactionType],
    deposit: formatDepositText(dto.transactionType, dto.deposit, dto.monthlyRent),
    propertyType: propertyTypeLabelMap[dto.propertyType],
    depositAmount: dto.deposit,
    monthlyRentAmount: dto.monthlyRent,
    maintenance: formatMaintenanceText(dto.maintenanceFee),
    maintenanceFeeAmount: dto.maintenanceFee,
    area: dto.area,
    description: dto.description ?? undefined,
    imageUrls: dto.images.map((image) => image.imageUrl),
    images: dto.images.map(mapPropertyImageDto),
    marketComparison: mapMarketComparisonDto(dto.marketComparison),
    statusColor: propertyStatusColorMap.slate,
    location: {
      latitude: dto.address.latitude ?? 0,
      longitude: dto.address.longitude ?? 0,
    },
    createdAt: formatDateText(dto.createdAt),
    checklistCreated: dto.checklistCreated,
    reported: dto.reported,
  };
}

const detailMockImageUrls = [
  'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&q=80&w=1000',
  'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&q=80&w=500',
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&q=80&w=500',
];

/**
 * mock 저장소는 PropertySummary(목록과 동일한 목업 타입)까지만 가지고 있어, 상세 화면 전용
 * 필드(설명/이미지/등록일)는 실제 API가 없으니 데모용 값으로 채워 PropertyDetail 형태로 맞춘다.
 * DTO를 다시 파싱하는 매퍼가 아니라 목업 호환용 어댑터라는 점에서 위 함수들과 성격이 다르다.
 */
export function mapPropertySummaryToMockDetail(property: PropertySummary): PropertyDetail {
  return {
    ...property,
    imageUrls: detailMockImageUrls,
    images: detailMockImageUrls.map((imageUrl) => ({ imageUrl, roomType: null })),
    description: '깨끗하고 채광이 좋은 매물입니다. 역과 가까워 통근이 편리해요.',
    marketComparison: {
      status: 'AVAILABLE',
      referencePriceText: '1억 8,000만원',
      differenceRateText: '+3%',
      sampleCount: 5,
      referenceDate: '2026.06.20',
      radiusMeters: 300,
      areaErrorRate: 0.2,
      lookbackMonths: 6,
    },
  };
}
