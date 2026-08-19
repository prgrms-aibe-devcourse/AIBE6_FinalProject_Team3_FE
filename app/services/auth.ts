import { getApiBaseUrl, requestJson } from '../lib/api/http';
import { type MeResponseDto, type PasswordPolicyDto } from '../types/api';

export function getGoogleLoginUrl(): string {
  return `${getApiBaseUrl()}/oauth2/authorization/google`;
}

export function getKakaoLoginUrl(): string {
  return `${getApiBaseUrl()}/oauth2/authorization/kakao`;
}

export async function getCurrentUser(cookieHeader?: string, signal?: AbortSignal): Promise<MeResponseDto> {
  return requestJson<MeResponseDto>('/auth/me', {
    ...(cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined),
    signal,
  });
}

// 랜딩 페이지(공개)처럼 "로그인 여부에 따라 CTA만 살짝 바꾸는" 용도의 비강제 확인용. getCurrentUser()는
// requestJson()을 거치는데, 그건 401을 만나면 브라우저에서 자동으로 refresh를 시도하고 그래도
// 실패하면 /auth/session-recover로 강제 이동시킨다(보호 페이지 전용 동작) - 로그인한 적 없는
// 방문자가 그냥 공개 페이지를 봤을 뿐인데 로그인 화면으로 튕기면 안 되므로, 그 로직을 타지 않는
// 순수 fetch로 성공 여부만 반환한다.
export async function isLoggedIn(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/me`, { credentials: 'include' });
    return response.ok;
  } catch {
    return false;
  }
}

// 회원가입/비밀번호 변경 폼의 <input pattern="..."> 값을 여기서 받아온다 — backend
// PasswordPolicy가 유일한 소스이고, 프론트는 이 값을 하드코딩해두지 않는다.
export async function getPasswordPolicy(): Promise<PasswordPolicyDto> {
  return requestJson<PasswordPolicyDto>('/auth/password-policy');
}

export async function logout(): Promise<void> {
  await requestJson<void>('/auth/logout', { method: 'POST' });
}

export type LocalSignupInput = {
  email: string;
  password: string;
  nickname: string;
};

export type LocalLoginInput = {
  email: string;
  password: string;
};

export async function signup(input: LocalSignupInput): Promise<MeResponseDto> {
  return requestJson<MeResponseDto>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// 회원가입 폼에서 이메일 입력 후 "인증번호 발송"을 누르면 호출한다 - 계정은 아직 만들지 않는다.
export async function requestEmailVerification(email: string): Promise<void> {
  await requestJson<void>('/auth/email-verification/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

// 인증번호 확인에 성공하면 서버가 이 이메일에 대해 30분간 유효한 인증 완료 기록을 남긴다 -
// 이어지는 signup() 호출이 그 기록을 확인한다.
export async function confirmEmailVerification(email: string, code: string): Promise<void> {
  await requestJson<void>('/auth/email-verification/confirm', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

// 항상 성공(200)으로 응답한다 - 계정 존재 여부를 노출하지 않기 위함(백엔드 PasswordResetService 참고).
export async function requestPasswordReset(email: string): Promise<void> {
  await requestJson<void>('/auth/password-reset/request', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  await requestJson<void>('/auth/password-reset/confirm', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
}

export async function login(input: LocalLoginInput): Promise<MeResponseDto> {
  return requestJson<MeResponseDto>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export type PasswordUpdateInput = {
  // 구글/카카오 전용 계정이 처음 비밀번호를 설정하는 경우엔 비교할 기존 비밀번호가 없으므로 생략한다.
  currentPassword?: string;
  newPassword: string;
};

export async function updatePassword(input: PasswordUpdateInput): Promise<void> {
  await requestJson<void>('/auth/password', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// 개발 편의용 "관리자로 로그인" 버튼 전용. 백엔드가 DEV_LOGIN_ENABLED=false(기본값)거나 key가
// DEV_LOGIN_SECRET과 일치하지 않으면 404를 반환하므로, 이 함수 자체는 운영에서 key 없이 호출돼도
// 아무 계정에도 로그인시키지 못한다. key는 쿼리 파라미터가 아니라 헤더로 보낸다 - 쿼리스트링은
// 서버 액세스 로그/프록시 로그/브라우저 히스토리에 평문으로 남기 쉬워 공유 비밀값에 부적절하다.
export async function devLogin(key?: string | null): Promise<MeResponseDto> {
  const headers: HeadersInit = key ? { 'X-Dev-Login-Key': key } : {};
  return requestJson<MeResponseDto>('/auth/dev-login', { method: 'POST', headers });
}
