# 인증(auth) 도메인 — Frontend 구현 현황 정리

## 배경 / 성격

Backend `docs/specs/auth-design.md`와 같은 성격의 **요구사항 명세서 대비 실제 구현 대조 문서**입니다. Backend가 API/토큰 발급·검증을 다룬다면, 이 문서는 그 API를 실제로 소비하는 **Frontend 쪽 구현**(로그인/회원가입 화면, 토큰 갱신 흐름, 인증 게이트, 에러 메시지)이 요구사항과 얼마나 일치하는지를 소스 코드 기준으로 확인합니다.

**범위**: `app/login`, `app/signup`, `app/oauth/callback`, `app/services/auth.ts`, `app/lib/api/http.ts`, `proxy.ts`, `app/(main)/layout.tsx`만 다룹니다. 토큰 서명/만료 검증 자체나 소셜 로그인 인가 코드 처리는 전부 Backend 책임이라 이 문서의 범위 밖입니다(Backend `auth-design.md` 참고).

## 주요 화면 / 파일

| 파일 | 역할 |
| --- | --- |
| `app/login/page.tsx` + `LoginFormClient.tsx` | 이메일 로그인 폼, 구글/카카오 로그인 링크, URL 에러 파라미터 → 한글 메시지 매핑 |
| `app/signup/page.tsx` + `SignupFormClient.tsx` | 이메일 회원가입 폼 |
| ~~`app/oauth/callback/route.ts`~~ | ~~소셜 로그인 성공 후 리다이렉트 목적지(온보딩/홈) 결정~~ — ⚠️ **(2026-08-12 정정)** 이 경로 자체가 더 이상 존재하지 않음. `crossOriginAuth` 여부에 따라 갈림: `crossOriginAuth=true`면 클라이언트 컴포넌트인 `app/oauth/callback/page.tsx`가 이 역할을 담당(아래 "전수조사 결과" 코드품질 2번 참고) |
| `app/services/auth.ts` | 로그인/회원가입/로그아웃/비밀번호 변경/`GET /auth/me` 호출 |
| `app/lib/api/http.ts` | 공통 fetch 래퍼(`requestJson`), `refreshSession`. **(2026-07-29)** `requestJson`이 브라우저 컨텍스트에서 401 + 세션 무효 코드를 감지하면 single-flight로 `POST /auth/refresh` → 성공 시 원 요청 1회 재시도까지 자동 처리(아래 "남은 이슈 2번" 참고). Server Component 경로(쿠키를 명시적으로 넘기는 호출)는 이 자동 재시도 대상이 아니라 여전히 `proxy.ts`/`session-recover`가 담당 |
| `proxy.ts` | Next.js 미들웨어 — 보호된 경로 진입 시 access_token 쿠키 존재 여부 확인, 없으면 refresh 시도 |
| `app/(main)/layout.tsx` | ~~`GET /auth/me` 호출로 실제 세션 유효성 재확인, 실패 시 `/login?error=session_expired`~~ — ⚠️ **(2026-08-12 정정)** `crossOriginAuth=true`일 때는 이 서버 컴포넌트 확인을 건너뛰고 클라이언트 컴포넌트 `MainLayoutGate.tsx`에 위임한다 — 항상 이 방식으로 동작하는 게 아님(아래 "전수조사 결과" 코드품질 2번 참고) |

## 이메일 회원가입 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| 이메일/비밀번호/닉네임 입력 → 가입 요청 | ✅ `SignupFormClient` → `POST /auth/signup` |
| 비밀번호 정책(8자 이상, 영문+숫자) 검증 | ✅ **클라이언트에서도 선제 검증하지만 최종 판단은 아님** — `<input pattern="...">`로 브라우저 단에서 막지만, 실제 정책 판단은 백엔드 응답에 위임. **(2026-07-28)** 정규식은 더 이상 하드코딩이 아니라 `GET /auth/password-policy`(backend `PasswordPolicy`가 유일한 소스)로 런타임에 받아온다 — `signup/page.tsx`/`mypage/password/page.tsx`(Server Component)가 조회해 `SignupFormClient`/`PasswordUpdateFormClient`에 props로 내려줌. 조회 실패 시에만 하드코딩된 폴백 값을 씀(남은 이슈 4번 참고) |
| 성공 시 온보딩(프로필 등록) 화면으로 이동 | ✅ 가입 성공 시 무조건 `/mypage/profile`로 이동(방금 만든 계정이라 프로필이 없다고 가정) |
| 실패: 이메일 중복 / 비밀번호 정책 미충족 / 필수값 누락 | ⚠️ 사유별로 구분된 메시지가 아니라, 백엔드가 내려준 `ApiError.message`를 그대로 표시. 필수값 누락은 `required` 속성으로 애초에 제출 자체가 막힘 |

## 이메일 로그인 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| 이메일/비밀번호로 로그인 요청 | ✅ `LoginFormClient` → `POST /auth/login` |
| 성공 시 로그인 상태가 됨 | ✅ |
| (요구사항엔 없지만) 목적지 화면 분기 | ⚠️ **요구사항에 없는 추가 구현** — OAuth 콜백과 동일한 기준으로 `getMyProfile()` 확인 후 프로필 미등록이면 `/mypage/profile`, 등록돼 있으면 `/home`으로 분기. 요구사항 문서의 "이메일 로그인" 섹션엔 이 분기 언급이 없음(OAuth 섹션에만 있음) — 일관성을 위해 FE가 자체적으로 확장한 부분 |
| 실패: 존재하지 않는 이메일 / 비밀번호 불일치 / 소셜 전용 계정으로 이메일 로그인 시도 | ⚠️ 사유별 구분 없이 백엔드 메시지를 그대로 노출 |

## 소셜 로그인 (구글/카카오) — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| 인증 코드 유효성 확인 / 제공자 사용자 정보 조회 / OAuthAccount 매칭 / 신규 생성 / 계정 연동 | Backend 책임 — FE는 `<a href={getGoogleLoginUrl()}>`로 백엔드 OAuth2 엔드포인트(`/oauth2/authorization/google`)로 브라우저를 그대로 보내는 것만 담당 |
| 성공: 신규 사용자는 온보딩, 기존 사용자는 홈으로 이동 | ✅ ~~`oauth/callback/route.ts`가 `getCurrentUser` → `getMyProfile` 순으로 확인해 분기~~ — **(2026-08-12 정정)** `crossOriginAuth` 여부에 따라 실제로 이 역할을 하는 파일이 다름(`route.ts`는 더 이상 존재하지 않음) — 위 "주요 화면/파일" 표 정정 및 아래 "전수조사 결과" 코드품질 2번 참고 |
| 실패: 인증 토큰 미발급 | ✅ 콜백에 `error` 쿼리 파라미터가 있으면 검증 없이 그대로 `/login?error=...`로 전달, `/login` 페이지가 `oauth_login_failed`를 한글 메시지로 매핑(그 외 값은 기본 문구로 폴백) |

## 토큰 검증 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| Access Token 서명/만료/사용자 상태 검증 | Backend 책임 — FE는 검증 로직 자체가 없음 |
| 실패 시 접근 제한 | ✅ 2단계로 구현: ① `proxy.ts`가 보호 경로 진입 시 `access_token` 쿠키 존재만 가볍게 확인 ② ~~`(main)/layout.tsx`가 `GET /auth/me` 실제 호출로 최종 확인~~ — **(2026-08-13 정정)** `crossOriginAuth=false`(같은 도메인 배포)일 때만 이 경로. `crossOriginAuth=true`면 서버 컴포넌트 확인 자체를 건너뛰고 클라이언트 컴포넌트 `MainLayoutGate.tsx`가 브라우저에서 직접 `getCurrentUser()`를 호출해 확인한다(아래 "전수조사 결과" 코드품질 2번 참고). 실패 시 `/login?error=session_expired`로 보내는 결과는 두 경로 다 동일 |
| 실패 사유 제공 | ✅ **화면 문구는 의도적으로 통합, 코드 분기는 구분해서 인식.** FE는 전부 동일한 "로그인 세션을 확인할 수 없습니다" 문구로 보여준다 — 토큰이 없든/무효하든/만료됐든 사용자가 취해야 할 행동은 "다시 로그인" 하나뿐이라 문구를 나눠도 실질적 이득이 없고, `AUTH_INVALID_CREDENTIALS`(이메일/비밀번호 오류 통합)와 같은 철학의 연장. **(2026-07-28)** 백엔드가 `ErrorCode.AUTH_TOKEN_MISSING`/`AUTH_TOKEN_INVALID`/`AUTH_TOKEN_EXPIRED`로 사유를 세분화하면서(`fix/auth-access_token&refresh_token` 브랜치, `dev` 머지 대기 중), FE의 "재로그인 필요 여부" 판단 로직(`isSessionInvalidErrorCode`)이 이 네 코드를 전부 인식하도록 갱신했다 — **화면에 보여줄 문구를 나누자는 게 아니라, "재로그인 페이지로 보낼지 말지"를 정확히 판단하려면 새 코드들도 "세션 무효"로 인식해야 하기 때문**(안 그러면 만료/무효 케이스에서 재로그인 유도 자체가 아예 안 걸림 — 아래 "남은 이슈 2번" 참고). 사유별로 다른 문구/로깅이 필요해지면 이 함수 내부만 확장하면 됨 |

## 토큰 재발급 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| Refresh Token 서명/만료만으로 검증(별도 저장소 조회 없음) | Backend 책임 — FE는 검증 방식 자체에 관여하지 않고 `POST /auth/refresh` 응답을 신뢰하기만 함(FE 자체 저장소는 없음). **참고**: 이 요구사항 문구가 원한 "서명/만료만으로 검증"은 실제 Backend 구현과 다르다(DB 조회 방식 — backend `docs/specs/auth-design.md`의 "토큰 재발급" 섹션 참고) — FE 관점에서 ✅로 표시하면 backend 문서와 모순돼 보일 수 있어 판정 없이 서술로만 남김 |
| 성공 시 새 Access Token 발급 | ✅ `refreshSession()`은 백엔드의 `Set-Cookie` 응답 헤더를 그대로 반환만 하고, 그 결과를 실제로 현재 요청 헤더와 브라우저 응답에 반영하는 건 호출부인 `proxy.ts`다(`mergeCookieHeader`로 이번 요청 헤더에 병합 + `response.headers.append('Set-Cookie', ...)`로 브라우저에도 내려줌) |
| 실패 시 재발급 안 되고 재로그인 요청 | ✅ `proxy.ts`에서 refresh 실패 시 `/login`으로 리다이렉트 |
| (사용성) Access Token 만료 시 자동 재발급 시도 | ✅ **(2026-07-29) 화면 전환(`proxy.ts`/`session-recover`)과 브라우저 클라이언트 컴포넌트 호출(`requestJson()`) 양쪽 다 커버.** 예전엔 `requestJson`에 있던 `retryAfterRefresh`(Server Component 전용, 서버-서버 fetch라 응답의 Set-Cookie가 브라우저에 자동 전달 안 되는 문제로 제거)만 있고 순수 브라우저 컨텍스트용 재시도는 없었는데, `typeof window !== 'undefined'`로 서버/브라우저를 구분해 브라우저에서만 자동 refresh-then-retry를 켜는 방식으로 다시 구현함(상세는 아래 "남은 이슈 2번" 참고) — Server Component 쪽은 여전히 기존 `proxy.ts`/`session-recover` 흐름 그대로라 이 문제가 재발하지 않음 |

## 로그아웃 — 요구사항 대비

| 요구사항 | 실제 구현 |
| --- | --- |
| 클라이언트에 저장된 토큰 제거 | ✅(간접) — 토큰이 애초에 httpOnly 쿠키라 FE가 직접 지울 수 없고, `POST /auth/logout` 응답의 `Set-Cookie`로 백엔드가 지움. **(2026-07-29 수정)** 예전엔 `logout()` 성공/실패와 무관하게 `finally`에서 항상 `/login`으로 이동했는데, 실패(네트워크 오류 등)해도 로그아웃된 것처럼 보이는 문제가 있어 고침 — 지금은 `useLogout` 훅(`app/lib/useLogout.ts`)이 성공했을 때만 `/login`으로 이동하고, 실패하면 현재 페이지에 그대로 남겨 에러 문구를 보여줌(재시도 가능) |

## 비기능 요구사항 — 대조

| 항목 | 요구사항 | 실제 |
| --- | --- | --- |
| Access/Refresh 만료 시간 분리 | O | Backend 책임, FE 범위 밖 |
| Refresh Token을 HttpOnly/Secure/SameSite 쿠키로 관리 | O | Backend 책임 — FE는 `credentials: 'include'`로 쿠키를 자동 첨부하는 것만 담당, 속성 자체는 확인 불가 |
| Refresh Token을 Local Storage에 저장하지 않음 | O | ✅ refresh/access 토큰은 httpOnly 쿠키로만 관리되고 `localStorage`/`sessionStorage`에는 저장되지 않음. 다만 dev-login 전용 부트스트랩 키(`DEV_LOGIN_SECRET`)는 `localStorage`에 저장됨(`devLoginKey.ts`) — 이건 실제 인증 토큰이 아니라 개발 편의 기능의 보조 값이라 이 요구사항의 대상은 아님 |
| 서명키/소셜 인증키를 소스코드에 미포함 | O | ✅ FE는 `NEXT_PUBLIC_KAKAO_MAP_APP_KEY`(지도용 공개 키)만 env로 노출하고, OAuth client secret/JWT 서명키는 애초에 FE에 존재하지 않음 |
| 인증 실패 사유 과다 노출 방지 | O | ⚠️ FE는 백엔드가 내려준 메시지를 그대로 표시만 함 — 메시지 수위 조절은 전적으로 백엔드 책임, FE 자체 필터링 없음 |
| 운영 환경 HTTPS | O | 배포 인프라 영역, FE 코드 범위 밖 |
| 이해 가능한 오류 메시지 | O | ⚠️ 부분적 — URL 파라미터 기반 에러(`oauth_login_failed`, `session_expired`, `session_unavailable`, `account_blocked`, `email_conflict`, `social_account_conflict`, `token_issue_failed`)는 FE가 직접 한글 매핑(`login/page.tsx`의 `ERROR_MESSAGES`), 로그인/회원가입 폼 실패는 백엔드 메시지 그대로 노출 |
| Access Token 만료 시 자동 재발급 시도 | O | ⚠️ 위 "토큰 재발급" 표 참고 — 화면 전환 시점만 커버, 클라이언트 사이드 호출 전반은 미커버 |
| Refresh Token까지 만료 시 재로그인 안내 | O | ✅ `/login`으로 리다이렉트 |
| 소셜 로그인 실패 시 재시도 가능 | O | ✅ `/login` 화면에 구글/카카오 버튼이 항상 노출돼 있어 실패해도 즉시 재시도 가능 |
| 소셜 로그인 장애 시 일관된 실패 응답 | O | FE는 `error` 쿼리 파라미터가 매핑 테이블에 없으면 기본 문구로 폴백 ✅ |
| 공통 인증 예외 형식 | O | ✅ `ApiError`(status, body.error) 하나로 모든 인증 실패를 통일 처리 |
| 동일 소셜 계정 중복 생성 방지 | O | Backend 책임, FE 범위 밖 |
| 불필요한 외부 API 호출 없이 토큰 검증 | O | FE는 토큰을 자체 검증하지 않고 항상 백엔드에 위임 — 범위 밖 |
| 인증 API 응답시간/실패율 모니터링 | O | Backend 인프라(Actuator/Prometheus) 영역, FE 범위 밖 |

## 요구사항에 없던 추가 구현

- **개발용 "관리자로 로그인" 버튼**(`DevLoginButton.tsx`, `devLogin()`) — `NEXT_PUBLIC_ENABLE_DEV_LOGIN=true`일 때만 렌더링. 백엔드가 `DEV_LOGIN_ENABLED=false`(운영 기본값)면 404를 반환해 운영에서는 무력화됨
- **`notice=account_linked` 안내 배너** — 소셜 로그인이 신규 계정이 아니라 기존 계정에 방금 연동됐을 때, 홈 화면에 안내를 띄우기 위해 콜백이 전달하는 파라미터. 외부에서 접근 가능한 콜백 진입점이라 허용된 값인지 화이트리스트 검증 후에만 전달
- **이메일 로그인에도 온보딩 분기 적용** — 요구사항 문서엔 소셜 로그인 섹션에만 있는 "신규는 온보딩, 기존은 홈" 분기를, 이메일 로그인에도 동일하게 적용(일관성 목적)

## 남은 이슈 / 확인 필요 총정리

1. ~~`proxy.ts`의 `matcher`에 `/checklists`(신규 "내 체크리스트 목록" 화면)가 빠져 있음~~ — ✅ 2026-07-28 완전히 해결(경로 추가 + 실제 리다이렉트 검증 둘 다 완료):
   - `matcher`에 `/checklists/:path*` 추가함
   - **정정 이력**: 최초엔 이 검증을 mock 모드(`NEXT_PUBLIC_USE_MOCK_DATA=true`, `.env.local`)인 채로 해서 `proxy.ts`가 `if (useMockData) return NextResponse.next()`로 통째로 스킵됐고, 그때 관찰한 `/login?error=session_expired`는 `(main)/layout.tsx`의 `GET /auth/me` 폴백 체크가 만든 것이었다(리뷰로 발견) — `proxy.ts`의 matcher 변경 자체는 검증된 적이 없었음
   - `NEXT_PUBLIC_USE_MOCK_DATA=false`로 임시로 바꿔서 재검증: 미인증 상태로 `/checklists` 접속 시 `proxy.ts`가 정확히 코드대로(쿼리 없는 `/login`) 리다이렉트하는 것을 확인함. 검증 후 `.env.local`은 원래 값(`true`)으로 복구함
2. ~~클라이언트 사이드 호출은 Access Token 자동 재발급 대상이 아님~~ — ✅ **2026-07-29 구현 완료.** `app/lib/api/http.ts`의 `requestJson()`이 브라우저 컨텍스트(`typeof window !== 'undefined'`)에서 401 + 세션 무효 코드를 감지하면 자동으로 `POST /auth/refresh` → 성공 시 원 요청 1회 재시도까지 처리한다. 아래에서 우려했던 "동시에 여러 컴포넌트가 401을 만났을 때 refresh를 한 번만 실행하도록 조율"도 모듈 레벨 single-flight(`refreshInFlight`)로 구현됨 — 정확히 예상했던 그 작업이 필요했고, 실제로 그렇게 구현함. refresh까지 실패하면(`rejected`) `/auth/session-recover`로 위임해 쿠키 정리, `unreachable`(네트워크 오류 등)이면 강제 로그아웃하지 않고 `ApiError.sessionRefreshOutcome`으로 구분만 남김. `PasswordUpdateFormClient`/`ChecklistClient`의 개별 `isSessionInvalidErrorCode` 감지는 이제 이 자동 처리가 실패했을 때(주로 `unreachable`)의 fallback 역할만 한다 — 상세 내역은 `docs/specs/2026-07-29-client-side-session-auto-recovery.md` 참고
   - **✅ 파생 버그 발견 및 수정(2026-07-28)**: 위 감지 로직이 원래 `error.code === 'UNAUTHORIZED'` 하나만 봤는데, 백엔드가 실패 사유를 `AUTH_TOKEN_MISSING`/`AUTH_TOKEN_INVALID`/`AUTH_TOKEN_EXPIRED`로 세분화하면서(`fix/auth-access_token&refresh_token` 브랜치) 실제로는 대부분의 만료/무효 케이스에서 이 체크가 안 걸리게 깨져 있었음 — 즉 비밀번호 변경 화면에 머무는 동안 세션이 끊기면 재로그인 유도 없이 그냥 일반 에러 문구만 보였을 것. `app/lib/api/http.ts`에 `isSessionInvalidErrorCode()`를 추가해 네 코드를 전부 인식하도록 고침(화면 문구 자체는 여전히 통합 — 위 "토큰 검증" 섹션 참고)
3. ~~로그인/회원가입 실패 메시지가 백엔드 원문 그대로 노출됨~~ — ✅ **의도된 설계로 확인.** 백엔드 `ErrorCode` 메시지는 전부 사용자에게 보여줄 목적으로 이미 다듬어진 한글 문장이고(스택트레이스/내부 예외 노출 경로 없음), 계정 존재 여부 등 민감 정보도 백엔드가 이미 의도적으로 뭉뚱그려 내려줌 — FE가 그대로 표시하는 게 이중 번역 계층 없이 정확한 설계
4. ~~비밀번호 정책이 FE(정규식)와 Backend 양쪽에 각각 하드코딩돼 있음~~ — ✅ 2026-07-28 완전히 해결. `GET /auth/password-policy`(backend `PasswordPolicy.HTML_INPUT_PATTERN`/`MESSAGE`)를 유일한 소스로 삼도록 바꿈:
   - backend: `PasswordPolicy`를 public으로 열고, HTML `pattern` 속성용으로 앞뒤 `^`/`$`를 뗀 `HTML_INPUT_PATTERN`을 `PATTERN`에서 파생(별도 유지보수 값 아님). `AuthController`에 `GET /auth/password-policy`(인증 불필요) 추가
   - frontend: `services/auth.ts`의 `getPasswordPolicy()`가 이 엔드포인트를 호출, `signup/page.tsx`/`mypage/password/page.tsx`(Server Component)가 조회해서 `SignupFormClient`/`PasswordUpdateFormClient`에 props로 전달 — 두 컴포넌트 모두 더 이상 정규식을 하드코딩하지 않음
   - 조회 실패(백엔드 다운 등 극히 드문 경우)에만 각 page.tsx의 하드코딩된 폴백 값을 씀 — 이 폴백이 실제 정책과 어긋나도 서버가 최종 검증에서 걸러주므로 이중 실패로 이어지지 않음
   - 브라우저로 직접 확인: `/signup` 접속 시 실제 백엔드 메시지가 렌더링되고, `input.checkValidity()`로 패턴이 실제 동작함을 검증함

## 전수조사 결과 (2026-08-12)

`app/login`, `app/signup`, `app/oauth`, `app/auth`, `app/services/auth.ts`, `app/lib/api/http.ts`(+테스트), `proxy.ts`, `app/(main)/layout.tsx`, `app/lib/useLogout.ts`, `app/lib/devLoginKey.ts`를 코드 기준으로 전수조사했다. 아래는 기존 문서에 없던 새 발견만 담았다. 계정 정지(SUSPENDED) 상태 노출 수준이 로그인 경로마다 다른 문제는 backend와 걸친 이슈라 backend `docs/specs/auth-design.md`의 전수조사 결과(보안 섹션 1번)에 적었다 — 이 문서에서는 그 결과를 그대로 반영하는 쪽(`login/page.tsx`의 `ERROR_MESSAGES.account_blocked`)만 관련되어 있고 FE 자체 결함은 아니다.

### 버그/정확성

1. ~~`SignupFormClient.handleCheckNickname()`(`app/signup/SignupFormClient.tsx:30-41`)에 경쟁 상태가 있다. 닉네임을 바꿔가며 중복확인을 연달아 누르면 늦게 도착하는 응답이 최신 입력값과 무관하게 `nicknameCheckStatus`를 덮어쓸 수 있다.~~ — ✅ **(2026-08-12 해결)** `latestNicknameRef`로 입력값의 최신 상태를 추적해, 응답 도착 시점에 요청 당시 값과 다르면(그 사이 입력이 바뀌었으면) 결과를 반영하지 않도록 가드 추가.

### 보안

특별히 발견된 이슈 없음. `sanitizeNextPath()`(`app/lib/nextPath.ts`)의 오픈 리다이렉트 방지가 `LoginFormClient`/`oauth/callback/page.tsx`/`SessionRecoverRetryButton.tsx`/`proxy.ts`/`session-recover/route.ts` 전 경로에서 일관되게 적용되는 것을 확인했고, `devLoginKey.ts`가 fragment(`#devkey=`)만 저장하고 쿼리스트링 값은 저장 없이 URL에서만 제거하는 것도 코드와 주석이 일치함을 확인했다.

### 코드 품질 (중복/구조/일관성)

1. ~~`app/login/page.tsx:16-20`의 주석이 "백엔드 화이트리스트(`OAuth2AuthenticationFailureHandler`의 `DOMAIN_SPECIFIC_ERROR_CODES`)"를 언급하지만, 실제 backend `OAuth2AuthenticationFailureHandler`(`backend/src/main/java/com/algogyeyak/auth/handler/OAuth2AuthenticationFailureHandler.java:41-43`)에는 그런 이름의 화이트리스트가 없다 — `OAuth2AuthenticationException`이면 어떤 에러 코드든 조건 없이 그대로 전달한다.~~ — ✅ **(2026-08-12 해결)** 주석을 "조건 없이 전달되며, 여기 테이블에 없는 코드는 기본 문구로 폴백된다"로 정정함(`app/login/page.tsx:16-18`).
2. ~~이 문서 자체가 현재 코드의 상당 부분(특히 크로스오리진 배포 분기)을 반영하지 못하고 있다. 문서는 `(main)/layout.tsx`가 항상 `GET /auth/me`를 직접 호출하고 `app/oauth/callback/route.ts`가 리다이렉트를 결정한다고 서술한다.~~ — ✅ **(2026-08-12 해결)** 위 "주요 화면/파일" 표(15/19/44번째 줄)에 이미 반영된 정정에 이어, 크로스오리진 분기 전체를 여기 정리한다: `crossOriginAuth=true`(AWS처럼 프론트/백엔드가 서로 다른 도메인일 때)면 `(main)/layout.tsx`(서버 컴포넌트)는 백엔드 도메인 쿠키를 받을 수 없어 로그인 여부 자체를 판단할 수 없으므로, 클라이언트 컴포넌트 `MainLayoutGate.tsx`가 대신 브라우저에서 직접 `getCurrentUser()`(크로스오리진 `credentials:'include'` fetch)를 호출해 로그인 여부를 확인한다 — access token 만료 시의 refresh-then-retry, refresh까지 실패했을 때 `/login?error=session_expired|session_unavailable`로의 이동은 `app/lib/api/http.ts`의 기존 로직이 그대로 처리하고 `MainLayoutGate`는 그 결과만 반영한다. OAuth 콜백도 더 이상 Route Handler(`route.ts`, 이미 삭제됨)가 아니라 클라이언트 컴포넌트 `app/oauth/callback/page.tsx`가 담당하고, `/auth/session-recover` 재시도도 `SessionRecoverRetryButton.tsx`(크로스오리진 전용)가 처리한다. `login/page.tsx`도 `crossOriginAuth` 값에 따라 일부 분기 렌더링이 갈린다. `crossOriginAuth=false`(같은 도메인 배포)일 때만 문서 원래 서술대로 서버 컴포넌트가 직접 `GET /auth/me`를 호출하는 경로를 탄다.
