import { initUserProfileDto } from '../mocks/init/user';
import { mapProfileFormInputToRegisterDto, mapProfileUpdateInputToDto, mapUserProfileDto } from '../mappers/user';
import { type ProfileUpdateInput, type UserProfile } from '../types/domain';

let mockUserProfileDto = { ...initUserProfileDto };

// 목데이터 환경에서 중복확인 데모용으로 사용 중이라고 가정하는 닉네임 목록
const reservedMockNicknames = ['관리자', 'admin', 'test'];

export function getMockUserProfile(): UserProfile {
  return mapUserProfileDto(mockUserProfileDto);
}

export function checkMockNicknameAvailable(nickname: string): boolean {
  if (nickname === mockUserProfileDto.nickname) {
    return true;
  }
  return !reservedMockNicknames.includes(nickname);
}

export function registerMockUserProfile(input: ProfileUpdateInput): UserProfile {
  const request = mapProfileFormInputToRegisterDto(input);
  mockUserProfileDto = {
    ...mockUserProfileDto,
    interestRegion: request.interestRegion,
    transactionType: request.transactionType,
    currentStage: request.currentStage ?? null,
  };
  return mapUserProfileDto(mockUserProfileDto);
}

export function updateMockUserProfile(input: ProfileUpdateInput): UserProfile {
  const patch = mapProfileUpdateInputToDto(input);
  mockUserProfileDto = {
    ...mockUserProfileDto,
    ...(patch.nickname !== undefined && { nickname: patch.nickname }),
    ...(patch.interestRegion !== undefined && { interestRegion: patch.interestRegion }),
    ...(patch.transactionType !== undefined && { transactionType: patch.transactionType }),
    ...(patch.currentStage !== undefined && { currentStage: patch.currentStage }),
  };
  return mapUserProfileDto(mockUserProfileDto);
}

// 목데이터 환경엔 실제 S3가 없으므로 presign/PUT/confirm 3단계를 흉내내는 대신, 이미 브라우저가
// 들고 있는 로컬 미리보기 URL(object URL)을 그대로 저장된 profileImageUrl처럼 취급한다.
export function uploadMockProfileImage(previewUrl: string): UserProfile {
  mockUserProfileDto = { ...mockUserProfileDto, profileImageUrl: previewUrl };
  return mapUserProfileDto(mockUserProfileDto);
}

export function resetMockProfileImage(): UserProfile {
  mockUserProfileDto = { ...mockUserProfileDto, profileImageUrl: null };
  return mapUserProfileDto(mockUserProfileDto);
}
