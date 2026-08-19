import { ApiError } from './api/http';

// 세션이 실제로 무효인 경우(401 rejected)는 이미 app/lib/api/http.ts의 requestJson()이 401을
// 감지해 자동으로 refresh-then-retry를 시도하고, 그래도 확실히 거부되면 자체적으로
// /auth/session-recover로 이동시킨다(다시는 resolve되지 않는 Promise를 반환) - 그래서 이 모듈을
// 쓰는 (main)/* 페이지들의 catch 블록에는 애초에 도달하지 않는다. 인증 판단/리다이렉트는
// MainLayoutGate.tsx 한 곳에서만 하고, 그 아래 개별 페이지는 자기 데이터 조회 실패를 각자
// 재로그인 필요로 판단하지 않는다 - 예전엔 페이지마다 독립적으로 판단해 리다이렉트를 걸었는데,
// 그 판단 기준(세션 코드만 봄, unreachable도 구분 없이 포함)이 MainLayoutGate의 기준과 달라서
// 저속 네트워크 등에서 실제로는 멀쩡한 세션인데도 로그인 화면으로 튕기는 원인이 됐다.
export type ProfileLoadFailure = 'not-found' | 'unknown';

// getMyProfile() 실패를 두 갈래로 나눈다:
// - 존재하지 않음/탈퇴(404): UserService.getActiveUserOrThrow()가 둘을 같은 코드로 합쳐서 내려주므로
//   FE에서도 더 세분화할 방법이 없다 — 'not-found'로 반환해, 호출부가 세션을 정리하고 랜딩 페이지로
//   보내게 한다(AccountUnavailableRedirect 참고).
// - 그 외(세션 무효/네트워크 오류/5xx 등): 'unknown'으로 반환해, 호출부가 "잠시 후 다시 시도" 문구를
//   보여주게 한다 - 세션이 실제로 무효였다면 MainLayoutGate가 이미 재로그인으로 보냈을 것이다.
export function classifyProfileLoadError(error: unknown): ProfileLoadFailure {
  if (error instanceof ApiError && error.status === 404) {
    return 'not-found';
  }
  return 'unknown';
}
