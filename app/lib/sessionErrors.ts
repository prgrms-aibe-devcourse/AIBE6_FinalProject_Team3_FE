import { ApiError, isSessionInvalidErrorCode } from './api/http';

// 세션이 확실히 무효(401)인지 판별하는 순수 함수. 리다이렉트 자체는 호출부(Client Component)가
// useRouter()로 수행한다 - next/navigation의 redirect()는 렌더링 중(Server Component)에만
// 안정적으로 동작하고, useEffect 등 이벤트성 컨텍스트에서는 보장되지 않는다.
//
// 클라이언트에서 나가는 요청은 이미 app/lib/api/http.ts의 requestJson()이 401을 감지하면
// 자동으로 refresh-then-retry를 시도하고, 그래도 확실히 거부된 경우(rejected)는 자체적으로
// /auth/session-recover로 이동시킨다(다시는 resolve되지 않는 Promise를 반환) - 그래서 이 함수가
// true를 반환하는 시점은 대부분 'unreachable'(네트워크 오류 등으로 refresh 자체를 확인 못한 경우)
// 뿐이다. 그 경우까지 포함해 재로그인 화면으로 보내는 건 기존 Server Component 버전과 동일한
// 판단이다(세션 상태를 확신할 수 없으면 안전한 쪽으로 재로그인을 유도).
export function isSessionInvalidError(error: unknown): boolean {
  return error instanceof ApiError && isSessionInvalidErrorCode(error.body?.code);
}

export type ProfileLoadFailure = 'session-invalid' | 'not-found' | 'unknown';

// getMyProfile() 실패를 세 갈래로 나눈다:
// - 세션 무효(401): 호출부가 이 값을 보고 재로그인 화면으로 보낸다.
// - 존재하지 않음/탈퇴(404): UserService.getActiveUserOrThrow()가 둘을 같은 코드로 합쳐서 내려주므로
//   FE에서도 더 세분화할 방법이 없다 — 'not-found'로 반환해, 호출부가 세션을 정리하고 랜딩 페이지로
//   보내게 한다(AccountUnavailableRedirect 참고).
// - 그 외(네트워크 오류, 5xx 등): 'unknown'으로 반환해, 호출부가 기존처럼 "잠시 후 다시 시도" 문구를
//   보여주게 한다.
export function classifyProfileLoadError(error: unknown): ProfileLoadFailure {
  if (isSessionInvalidError(error)) {
    return 'session-invalid';
  }
  if (error instanceof ApiError && error.status === 404) {
    return 'not-found';
  }
  return 'unknown';
}
