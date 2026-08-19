import { describe, expect, it } from 'vitest';
import { canSetPassword } from './profile';

describe('canSetPassword', () => {
  // 회귀 테스트 - 이 규칙이 mypage/password/page.tsx와 MyPageClient.tsx 두 곳에 각각 따로
  // 구현돼 있어 규칙이 바뀌면 한쪽만 고치고 넘어갈 드리프트 위험이 있었다 - 하나로 합친 뒤
  // 두 곳 모두가 실제로 이 함수를 쓰는지는 각 파일에서 확인하고, 여기서는 규칙 자체만 검증한다.
  it('이미 비밀번호가 있으면 email이 없어도 true', () => {
    expect(canSetPassword({ hasPassword: true, email: null })).toBe(true);
  });

  it('비밀번호가 없어도 email이 있으면 true', () => {
    expect(canSetPassword({ hasPassword: false, email: 'user@example.com' })).toBe(true);
  });

  it('비밀번호도 없고 email도 없으면 false', () => {
    expect(canSetPassword({ hasPassword: false, email: null })).toBe(false);
  });
});
