import { type UserProfileDto } from '../../types/api';

export const initUserProfileDto: UserProfileDto = {
  id: 1,
  email: 'ansim@example.com',
  nickname: '김안심',
  profileImageUrl: null,
  status: 'ACTIVE',
  interestRegion: '서울 관악구',
  transactionType: 'MONTHLY_RENT',
  currentStage: '자취 경험 있음',
  hasPassword: false,
};
