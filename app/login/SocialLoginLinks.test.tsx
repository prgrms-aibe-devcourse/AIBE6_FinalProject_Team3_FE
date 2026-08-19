import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SocialLoginLinks } from './SocialLoginLinks';

// 회귀 테스트 - oauth_next 쿠키의 max-age가 백엔드 CookieAuthorizationRequestRepository의
// OAuth 인가요청 쿠키 TTL(600초)보다 짧으면(예전엔 300초), 카카오톡 앱 전환/구글 2단계 인증 등으로
// IdP 왕복이 길어졌을 때 로그인 자체는 성공해도 이 쿠키만 먼저 만료돼 원래 가려던 경로 대신 기본
// 경로로 튄다. document.cookie setter를 스파이해 실제로 기록되는 max-age 값을 직접 확인한다.
describe('SocialLoginLinks', () => {
  const originalCookieDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');

  afterEach(() => {
    if (originalCookieDescriptor) {
      Object.defineProperty(document, 'cookie', originalCookieDescriptor);
    }
  });

  it('next가 있으면 백엔드 OAuth 인가요청 쿠키와 동일한 600초 TTL로 oauth_next를 저장한다', () => {
    const cookieSetter = vi.fn();
    Object.defineProperty(document, 'cookie', { set: cookieSetter, configurable: true });

    render(<SocialLoginLinks googleLoginUrl="/oauth/google" kakaoLoginUrl="/oauth/kakao" next="/mypage" />);
    screen.getByText('구글로 로그인').click();

    expect(cookieSetter).toHaveBeenCalledWith(
      expect.stringContaining('oauth_next=%2Fmypage; path=/; max-age=600; samesite=lax'),
    );
  });
});
