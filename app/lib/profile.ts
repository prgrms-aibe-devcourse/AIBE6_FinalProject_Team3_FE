import { type UserProfile } from '../types/domain';

export function hasRegisteredProfile(profile: UserProfile): boolean {
  return Boolean(profile.interestRegion) && Boolean(profile.transactionType);
}

// 로그인은 email+passwordHash 조합으로만 되므로(services/auth.ts login 참고), email이 없는 계정
// (카카오는 profile_nickname 스코프만 요청해 이메일 동의항목이 아직 없음)은 비밀번호를 설정해봐야
// 그걸로 로그인할 방법이 없다 — 이미 비밀번호가 있는 계정은 email이 반드시 있었을 때만 그렇게 될
// 수 있으므로 이 케이스에 해당하지 않는다. mypage/password/page.tsx와 MyPageClient.tsx 두 곳이
// 각자 이 규칙을 따로 재구현하고 있어서, 규칙이 바뀌면 한쪽만 고치고 넘어갈 드리프트 위험이
// 있었다 - 하나로 합친다.
export function canSetPassword(profile: Pick<UserProfile, 'hasPassword' | 'email'>): boolean {
  return profile.hasPassword || profile.email !== null;
}
