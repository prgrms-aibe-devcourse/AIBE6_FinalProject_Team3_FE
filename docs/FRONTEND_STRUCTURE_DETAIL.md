# Frontend Structure Detail

이 문서는 [Frontend Structure Guide](FRONTEND_STRUCTURE.md)의 상세 설명입니다.
빠르게 구조만 확인하려면 요약 문서를 먼저 보고, 실제 구현 중 기준이 필요할 때 이 문서를 참고합니다.

## 설계 의도

현재 프론트는 백엔드 작업 전에도 화면 개발을 진행할 수 있도록 구성되어 있습니다.
동시에 백엔드가 준비되면 mock data를 걷어내지 않고 환경변수만 바꿔 실제 API를 받을 수 있게 설계했습니다.

핵심은 다음 분리입니다.

```txt
API DTO       백엔드 응답 형태
mapper        DTO -> 화면 타입 변환
domain        화면에서 쓰는 타입
service       화면의 데이터 진입점
repository    mock 모드 전용 데이터 제공
```

## 실제 API 흐름

예: 매물 목록

```txt
app/(main)/properties/page.tsx
  -> getProperties()
  -> requestJson<PropertySummaryDto[]>('/properties')
  -> ApiResponse<PropertySummaryDto[]>
  -> data unwrap
  -> mapPropertySummaryDto()
  -> PropertiesClient props
```

`page.tsx`는 Server Component입니다. API 호출은 서버에서 먼저 처리하고, 검색/필터처럼 브라우저 상태가 필요한 UI만 `PropertiesClient.tsx`에서 처리합니다.

## mock 흐름

`NEXT_PUBLIC_USE_MOCK_DATA=true`일 때 service는 실제 API를 호출하지 않고 repository를 사용합니다.

예: 매물 목록 mock

```txt
getProperties()
  -> getMockProperties()
  -> initPropertySummaryDtos
  -> mapPropertySummaryDto()
  -> PropertySummary[]
```

mock DTO는 `app/mocks/init`에만 둡니다. 화면 구성용 정적 데이터는 `app/data`에 둡니다.

## `data`와 `mocks/init` 구분

`app/data`:

- 탭 목록
- 카드 문구
- 화면 구성용 상수
- 카테고리/옵션

`app/mocks/init`:

- 백엔드 DTO와 같은 형태의 초기 mock 응답
- `PropertySummaryDto`
- `ChecklistItemDto`
- `ContractAnalysisResultDto`(`ContractClauseDto[]` 포함)

즉, `data`는 UI 구성 데이터이고 `mocks/init`은 API 응답 흉내입니다.

## API 응답 처리

백엔드는 모든 응답을 아래 형태로 내려주는 것을 기준으로 합니다.

```ts
type ApiResponse<T> = {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  } | null;
};
```

`requestJson<T>()`는 `ApiResponse<T>` 전체를 반환하지 않고 `data`만 반환합니다.

```ts
const dtos = await requestJson<PropertySummaryDto[]>('/properties');
```

따라서 service에서는 unwrap을 신경 쓰지 않고 DTO 타입만 다룹니다.

## 에러 처리

`requestJson<T>()`는 다음 상황에서 `ApiError`를 던집니다.

- `NEXT_PUBLIC_API_BASE_URL`이 없고 mock 모드도 아닌 경우
- HTTP status가 2xx가 아닌 경우
- `success: false`인 경우
- JSON 파싱에 실패한 경우

현재 화면은 각 `page.tsx`에서 try/catch로 에러 메시지를 client component에 전달합니다.

예:

```ts
let properties: PropertySummary[] = [];
let loadError: string | undefined;

try {
  properties = await getProperties();
} catch {
  loadError = '매물 정보를 불러오지 못했습니다. API 설정을 확인해 주세요.';
}
```

## 타입 작성 기준

### API 타입

`app/types/api.ts`에는 백엔드와 맞춰야 하는 타입만 둡니다.

예:

```ts
export type PropertySummaryDto = {
  id: number;
  title: string;
  tradeType: PropertyTradeType;
  depositText: string;
  statusTone: ApiStatusTone;
};
```

### Domain 타입

`app/types/domain.ts`에는 화면에서 쓰는 타입을 둡니다.

예:

```ts
export type PropertySummary = {
  id: number;
  title: string;
  type: PropertyTradeType;
  deposit: string;
  statusColor: string;
};
```

API 타입과 domain 타입이 같아 보여도 바로 합치지 않습니다. 백엔드 필드명 변경, UI 표시값 변경, className 변환을 분리하기 위해서입니다.

## Mapper 작성 기준

mapper는 API DTO를 domain 타입으로 바꿉니다.

예:

```ts
export function mapPropertySummaryDto(dto: PropertySummaryDto): PropertySummary {
  return {
    id: dto.id,
    title: dto.title,
    type: dto.tradeType,
    deposit: dto.depositText,
    statusColor: propertyStatusColorMap[dto.statusTone],
  };
}
```

주의:

- 백엔드 DTO에 Tailwind className을 넣지 않습니다.
- UI 색상은 `statusTone` 같은 의미 값으로 받아 mapper에서 결정합니다.
- mapper 안에서 비즈니스 판단을 새로 만들지 않습니다. 표시 형태 변환에 집중합니다.

## Server Component 기준

데이터가 필요한 라우트는 기본적으로 Server Component로 둡니다.

현재 예:

- `properties/page.tsx`
- `properties/[id]/page.tsx`
- `checklist/page.tsx`
- `contract/result/page.tsx`
- `mypage/page.tsx`

이 파일들은 service를 호출하고, 결과를 client component에 props로 넘깁니다.

## Client Component 기준

다음 중 하나가 필요할 때만 client component로 분리합니다.

- `useState`
- 브라우저 이벤트
- 탭 전환
- 검색/필터
- 지도/차트 렌더링
- 체크리스트 상태 변경

현재 예:

- `PropertiesClient.tsx`
- `PropertyDetailClient.tsx`
- `ChecklistClient.tsx`
- `ContractResultClient.tsx`

## 새 API 추가 예시

예: 매물 등록

1. `types/api.ts`

```ts
export type CreatePropertyRequestDto = {
  title: string;
  address: string;
  tradeType: PropertyTradeType;
  depositAmount: number;
  monthlyRentAmount?: number;
};
```

2. `services/properties.ts`

```ts
export async function createProperty(request: CreatePropertyRequestDto): Promise<PropertySummary> {
  const dto = await requestJson<PropertySummaryDto>('/properties', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  return mapPropertySummaryDto(dto);
}
```

3. mock이 필요하면

```txt
mocks/init/properties.ts
repositories/propertyRepository.ts
```

4. 화면에서는 service만 호출

```txt
properties/register/page.tsx 또는 RegisterClient.tsx
  -> createProperty()
```

## 현재 endpoint 초안

```txt
GET  /properties
GET  /properties/{id}
POST /properties
GET  /checklists/template?tradeType=전세
POST /checklists
POST /contract-analysis/inputs
POST /contract-analysis/ocr
POST /contract-analysis/masking
POST /contract-analysis/analyze
POST /contract-analysis/chat
GET  /mypage
```

백엔드 구현 시 실제 URI가 바뀌면 `services`만 먼저 수정합니다. 화면에서 직접 endpoint 문자열을 쓰지 않습니다.

## 문구 정책 상세

AGENTS.md 기준상 이 서비스는 중개나 법률 판단을 확정하지 않습니다.

피해야 할 표현:

- `안전합니다`
- `위험 매물입니다`
- `허위매물입니다`
- `위험도 HIGH`
- `점수 80점`

권장 표현:

- `확인 필요 신호 2개`
- `전세가율 82%`
- `시세보다 20% 낮은 가격이에요. 이유를 확인해보세요.`
- `이 결과는 참고용 정보이며 안전을 보장하지 않습니다.`

## 작업 전 체크리스트

새 작업을 시작하기 전에 확인합니다.

- 화면이 API를 직접 호출하고 있지 않은가?
- DTO와 domain 타입을 섞고 있지 않은가?
- mock 데이터가 `mocks/init` 밖에 있지 않은가?
- Tailwind className이 API DTO에 들어가 있지 않은가?
- 문구가 확정 판단처럼 보이지 않는가?
- `npm run format:check`, `npm run lint`, `npm run build`가 통과하는가?
