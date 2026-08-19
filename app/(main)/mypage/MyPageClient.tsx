'use client';

import { Lock, LogOut, Pencil, Plus, User, UserX } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ENABLE_ANALYSIS_HISTORY } from '../../config/features';
import { ApiError } from '../../lib/api/http';
import { canSetPassword, hasRegisteredProfile } from '../../lib/profile';
import { useLogout } from '../../lib/useLogout';
import { logout } from '../../services/auth';
import { withdraw } from '../../services/user';
import {
  type ActivityHistoryItem,
  type ChecklistProgress,
  type PropertySummary,
  type UserProfile,
} from '../../types/domain';
import { Badge } from '../../ui/Badge';
import { InfoRow } from '../../ui/InfoRow';
import { PropertyListItem } from '../../ui/PropertyListItem';
import { ContractHistorySection } from './ContractHistorySection';
import { WithdrawConfirmModal } from './WithdrawConfirmModal';

type MyPageClientProps = {
  activityHistory: ActivityHistoryItem[];
  activityHistoryLoadError?: string;
  properties: PropertySummary[];
  propertiesTotalCount: number;
  propertiesLoadError?: string;
  checklistProgressByPropertyId: Record<number, ChecklistProgress>;
  nickname: string;
  profile: UserProfile;
  profileLoadError?: string;
};

export function MyPageClient({
  activityHistory,
  activityHistoryLoadError,
  properties,
  propertiesTotalCount,
  propertiesLoadError,
  checklistProgressByPropertyId,
  nickname,
  profile,
  profileLoadError,
}: MyPageClientProps) {
  const router = useRouter();
  const isRegistered = hasRegisteredProfile(profile);
  const signalCount = properties.reduce((sum, property) => sum + (property.checkSignalCount ?? 0), 0);
  const { isLoggingOut, logoutError, handleLogout } = useLogout();
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  function handleWithdrawClick() {
    setWithdrawError(null);
    setIsWithdrawModalOpen(true);
  }

  // DELETE /users/me가 세션 무효화(쿠키 삭제)까지 best-effort로 처리하지만(UserController.withdraw
  // 참고) 실패해도 조용히 넘어가도록 되어 있어, 확실히 하기 위해 방어적으로 logout()을 한 번 더
  // 호출한다. 이미 쿠키/토큰이 없는 상태라 실질적으로는 아무 것도 안 하는 호출이라
  // (SessionLogoutService.logout이 토큰이 없으면 즉시 스킵) await하지 않는다 - 탈퇴 자체는 이미
  // withdraw()에서 끝난 뒤라, 실질적으로 아무 일도 안 하는 이 호출의 응답을 기다리느라 "탈퇴
  // 처리 중..." 화면이 불필요하게 더 오래 떠 있을 이유가 없다. 실패해도 무시한다.
  async function confirmWithdraw() {
    setWithdrawError(null);
    setIsWithdrawing(true);
    try {
      await withdraw();
      logout().catch(() => {});
      router.push('/');
      router.refresh();
    } catch (error) {
      setWithdrawError(
        error instanceof ApiError ? error.message : '탈퇴 처리에 실패했습니다. 잠시 후 다시 시도해 주세요.',
      );
      setIsWithdrawing(false);
    }
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 md:py-10">
      <div className="mb-8">
        <h1 className="ansim-page-title mb-2">마이페이지</h1>
        <p className="ansim-page-description">프로필, 관심 매물, 최근 확인 이력을 한 곳에서 확인합니다.</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-3 md:grid-cols-[1.3fr_1fr]">
        <div className="ansim-card p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-100">
                {profile.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.profileImageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User className="h-7 w-7 text-teal-700" />
                )}
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="font-bold text-slate-950">{profile.nickname || nickname}</p>
                  {profile.currentStage && <Badge className="bg-teal-50 text-teal-700">{profile.currentStage}</Badge>}
                </div>
                {!profile.currentStage && <p className="text-sm text-slate-500">프로필 정보를 등록해 주세요</p>}
              </div>
            </div>
            <Link
              href="/mypage/profile"
              className="flex shrink-0 items-center gap-1 text-sm font-bold text-teal-700 hover:text-teal-800"
            >
              <Pencil className="h-4 w-4" />
              {isRegistered ? '수정' : '등록'}
            </Link>
          </div>

          {profileLoadError && <p className="mb-3 text-sm text-red-600">{profileLoadError}</p>}

          <div className="space-y-1 border-t border-slate-100 pt-4 text-sm">
            <InfoRow
              label="관심 거래"
              value={profile.transactionType ?? '미설정'}
              className="border-b-0 py-1"
              labelClassName="text-slate-500"
              valueClassName="font-bold"
            />
            <InfoRow
              label="관심 지역"
              value={profile.interestRegion ?? '미설정'}
              className="border-b-0 py-1"
              labelClassName="text-slate-500"
              valueClassName="font-bold"
            />
          </div>
        </div>

        <div className="ansim-card p-6">
          <p className="mb-3 text-sm font-bold text-slate-950">계정 관리</p>
          <div className="space-y-1">
            {/* 이메일 없는 카카오 계정(profile_nickname 스코프만 요청 — 아직 email 동의항목 없음)은
                비밀번호를 설정해도 로그인에 쓸 이메일이 없어 결국 비밀번호 화면에서 막힌다
                (password/page.tsx 참고) — 여기서도 클릭 가능한 링크 대신 비활성 상태로 미리 안내한다.
                단, profileLoadError(일시적 조회 실패로 emptyProfile 폴백)일 땐 email이 실제로 없는
                게 아니라 "모르는" 상태이므로 "이메일 미연동"이 아니라 조회 실패로 별도 안내한다. */}
            {profileLoadError ? (
              <div
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-400"
                title="새로고침하거나 잠시 후 다시 시도해 주세요"
              >
                <Lock className="h-4 w-4 text-slate-300" />
                비밀번호 설정 (정보를 불러오지 못함)
              </div>
            ) : canSetPassword(profile) ? (
              <Link
                href="/mypage/password"
                className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Lock className="h-4 w-4 text-slate-400" />
                {profile.hasPassword ? '비밀번호 변경' : '비밀번호 설정'}
              </Link>
            ) : (
              <div
                className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-400"
                title="이메일이 연동된 계정만 비밀번호를 설정할 수 있어요"
              >
                <Lock className="h-4 w-4 text-slate-300" />
                비밀번호 설정 (이메일 미연동)
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4 text-slate-400" />
              {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
            </button>
            {logoutError && <p className="px-3 text-xs text-red-600">{logoutError}</p>}
            <button
              type="button"
              onClick={handleWithdrawClick}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              <UserX className="h-4 w-4 text-red-500" />
              회원 탈퇴
            </button>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-950">등록 매물</h2>
          <Link
            href="/properties/register"
            className="flex items-center gap-1 text-sm font-bold text-teal-700 hover:text-teal-800"
          >
            <Plus className="h-4 w-4" /> 매물 등록
          </Link>
        </div>
        <p className="mb-4 text-sm text-slate-500">
          등록 매물 {propertiesTotalCount}개 · 확인 필요 신호 {signalCount}개
        </p>

        {propertiesLoadError && (
          <div className="ansim-card mb-4 border-red-100 bg-red-50 p-4 text-sm text-red-700">{propertiesLoadError}</div>
        )}

        {!propertiesLoadError && properties.length === 0 && (
          <div className="ansim-card p-6 text-center text-sm text-slate-500">
            <p className="mb-4">아직 등록한 매물이 없어요</p>
            <Link href="/properties/register" className="ansim-button-primary inline-flex w-fit px-5 py-3">
              <Plus className="h-4 w-4" /> 매물 등록하기
            </Link>
          </div>
        )}

        {properties.length > 0 && (
          <div className="space-y-4">
            {properties.map((property) => (
              <PropertyListItem
                key={property.id}
                property={property}
                checklistProgress={checklistProgressByPropertyId[property.id]}
              />
            ))}
          </div>
        )}
      </div>

      <ContractHistorySection />

      {ENABLE_ANALYSIS_HISTORY && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="ansim-card p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">최근 이력</h2>
              <button className="text-sm font-bold text-teal-700">전체보기</button>
            </div>
            <div className="space-y-3">
              {activityHistoryLoadError ? (
                <p className="text-sm text-slate-500">이 기능은 준비 중입니다.</p>
              ) : (
                activityHistory.map((item) => (
                  <div key={`${item.title}-${item.type}`} className="rounded-xl border border-slate-100 p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-bold text-slate-950">{item.title}</p>
                      <Badge className="shrink-0 bg-slate-100 text-slate-600">{item.type}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">{item.date}</span>
                      <span className="font-bold text-orange-600">{item.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <WithdrawConfirmModal
        open={isWithdrawModalOpen}
        isWithdrawing={isWithdrawing}
        error={withdrawError}
        onClose={() => setIsWithdrawModalOpen(false)}
        onConfirm={confirmWithdraw}
      />
    </div>
  );
}
