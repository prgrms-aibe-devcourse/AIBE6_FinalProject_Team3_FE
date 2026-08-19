import { useMockData } from '../config/dataSource';
import { ApiError, requestJson } from '../lib/api/http';
import { mapProfileFormInputToRegisterDto, mapProfileUpdateInputToDto, mapUserProfileDto } from '../mappers/user';
import {
  checkMockNicknameAvailable,
  getMockUserProfile,
  registerMockUserProfile,
  resetMockProfileImage,
  updateMockUserProfile,
  uploadMockProfileImage,
} from '../repositories/userRepository';
import {
  type NicknameCheckResponseDto,
  type NicknamePolicyDto,
  type ProfileImageConfirmRequestDto,
  type ProfileImagePresignRequestDto,
  type ProfileImagePresignResponseDto,
  type UserProfileDto,
} from '../types/api';
import { type ProfileUpdateInput, type UserProfile } from '../types/domain';

export async function getMyProfile(cookieHeader?: string): Promise<UserProfile> {
  if (useMockData) {
    return getMockUserProfile();
  }

  const dto = await requestJson<UserProfileDto>(
    '/users/me',
    cookieHeader ? { headers: { Cookie: cookieHeader } } : undefined,
  );
  return mapUserProfileDto(dto);
}

export async function registerProfile(input: ProfileUpdateInput): Promise<UserProfile> {
  if (useMockData) {
    return registerMockUserProfile(input);
  }

  const dto = await requestJson<UserProfileDto>('/users/me/profile', {
    method: 'POST',
    body: JSON.stringify(mapProfileFormInputToRegisterDto(input)),
  });
  return mapUserProfileDto(dto);
}

export async function updateMyProfile(input: ProfileUpdateInput): Promise<UserProfile> {
  if (useMockData) {
    return updateMockUserProfile(input);
  }

  const dto = await requestJson<UserProfileDto>('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(mapProfileUpdateInputToDto(input)),
  });
  return mapUserProfileDto(dto);
}

export async function uploadProfileImage(file: File): Promise<UserProfile> {
  if (useMockData) {
    return uploadMockProfileImage(URL.createObjectURL(file));
  }

  // "image/jpeg" -> "jpeg", "image/png" -> "png". 둘 다 백엔드 PROFILE 허용 확장자(jpg/jpeg/png)에
  // 포함되므로, 신뢰할 수 없는 원본 파일명 대신 이미 검증된 MIME 타입에서 바로 뽑아 쓴다.
  const fileExtension = file.type.split('/')[1] ?? '';

  const presigned = await requestJson<ProfileImagePresignResponseDto>('/users/me/profile-image/presign', {
    method: 'POST',
    body: JSON.stringify({
      fileExtension,
      contentType: file.type,
      fileSize: file.size,
    } satisfies ProfileImagePresignRequestDto),
  });

  await putFileToPresignedUrl(presigned.uploadUrl, file, presigned.tagging);

  const dto = await requestJson<UserProfileDto>('/users/me/profile-image/confirm', {
    method: 'POST',
    body: JSON.stringify({ key: presigned.key } satisfies ProfileImageConfirmRequestDto),
  });
  return mapUserProfileDto(dto);
}

export async function resetProfileImage(): Promise<UserProfile> {
  if (useMockData) {
    return resetMockProfileImage();
  }

  const dto = await requestJson<UserProfileDto>('/users/me/profile-image', { method: 'DELETE' });
  return mapUserProfileDto(dto);
}

const UPLOAD_FAILED_MESSAGE = '프로필 사진 업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.';

// presigned URL은 우리 API 서버가 아니라 S3 버킷을 직접 가리키므로 requestJson(항상 API_BASE_URL과
// credentials을 붙임)을 쓸 수 없다 - 인증 쿠키 없이, 서명이 요구하는 Content-Type/x-amz-tagging/바이트만
// 그대로 보낸다. tagging 값은 presign 서명에 포함된 값과 정확히 일치해야 하며(다르면 403), 백엔드가
// 버킷 Lifecycle 규칙과 짝지어 고아 객체(업로드만 하고 confirm 없이 이탈)를 자동 정리하는 데 쓴다.
async function putFileToPresignedUrl(uploadUrl: string, file: File, tagging: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type, 'x-amz-tagging': tagging },
      body: file,
    });
  } catch {
    throw new ApiError(UPLOAD_FAILED_MESSAGE, 0);
  }

  if (!response.ok) {
    throw new ApiError(UPLOAD_FAILED_MESSAGE, response.status);
  }
}

// logout()과 마찬가지로 목데이터 분기를 두지 않는다 - 실제 계정 삭제/익명화가 필요한 동작이라
// 목데이터로 의미 있게 흉내낼 대상이 없다.
export async function withdraw(): Promise<void> {
  await requestJson<void>('/users/me', { method: 'DELETE' });
}

// PasswordPolicy(getPasswordPolicy)와 같은 이유로 목데이터 분기를 두지 않는다 - 이 값은 사용자별
// 데이터가 아니라 서버가 정한 고정 정책이라, 프론트가 하드코딩해두는 대신 항상 이 응답을 그대로 쓴다.
export async function getNicknamePolicy(): Promise<NicknamePolicyDto> {
  return requestJson<NicknamePolicyDto>('/users/nickname-policy');
}

export async function checkNicknameAvailability(nickname: string): Promise<boolean> {
  if (useMockData) {
    return checkMockNicknameAvailable(nickname);
  }

  const dto = await requestJson<NicknameCheckResponseDto>(
    `/users/nickname-check?nickname=${encodeURIComponent(nickname)}`,
  );
  return dto.available;
}
