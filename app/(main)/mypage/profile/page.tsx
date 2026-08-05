'use client';

import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { hasRegisteredProfile } from '../../../lib/profile';
import { classifyProfileLoadError } from '../../../lib/sessionErrors';
import { getMyProfile } from '../../../services/user';
import { type UserProfile } from '../../../types/domain';
import { AccountUnavailableRedirect } from '../../../ui/AccountUnavailableRedirect';
import { ProfileClient } from './ProfileClient';

const emptyProfile: UserProfile = {
  nickname: '',
  email: null,
  profileImageUrl: null,
  interestRegion: null,
  transactionType: null,
  currentStage: null,
  hasPassword: false,
};

export default function Page() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile>(emptyProfile);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [profileNotFound, setProfileNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((result) => {
        if (!cancelled) setProfile(result);
      })
      .catch((error) => {
        if (cancelled) return;
        switch (classifyProfileLoadError(error)) {
          case 'session-invalid':
            router.push('/login?error=session_expired');
            break;
          case 'not-found':
            setProfileNotFound(true);
            break;
          default:
            setLoadError('프로필 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  const mode = hasRegisteredProfile(profile) ? 'edit' : 'register';

  return (
    <>
      {profileNotFound && <AccountUnavailableRedirect />}
      <ProfileClient profile={profile} mode={mode} loadError={loadError} />
    </>
  );
}
