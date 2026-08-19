'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CheckCircle2, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { landingFeatures, landingSummaryItems } from './data/landing';
import { DevLoginButton } from './DevLoginButton';
import { captureDevLoginKeyFromUrl, getStoredDevLoginKey } from './lib/devLoginKey';
import { isLoggedIn as checkIsLoggedIn } from './services/auth';
import { Badge } from './ui/Badge';
import { FeatureCard } from './ui/FeatureCard';

export default function Page() {
  // 공개 페이지라 로그인 확인 중에도 나머지 콘텐츠는 바로 보여준다 - 확인 전까지는 startHref가
  // '/login'이다가, 이미 로그인된 상태로 확인되면 '/home'으로 바뀐다(브라우저에서 직접
  // credentials:'include'로 확인해야 crossOriginAuth 배포에서도 정확하다). isLoggedIn()은
  // getCurrentUser()와 달리 실패해도 로그인 화면으로 강제 이동시키지 않는다 - 로그인한 적 없는
  // 첫 방문자가 그냥 공개 페이지를 봤을 뿐인데 튕기면 안 되기 때문.
  const [loggedIn, setLoggedIn] = useState(false);
  // DevLoginButton이 자기 자신의 effect에서 getStoredDevLoginKey()를 따로 읽으면, "먼저 저장하고
  // 나중에 읽기"가 서로 다른 컴포넌트의 effect 사이 순서에 의존하게 된다 - React는 자식 effect를
  // 부모 effect보다 먼저 실행하므로, 자식인 DevLoginButton이 이 페이지의 캡처 effect보다 먼저
  // localStorage를 읽어버려 방금 들어온 `#devkey=` 부트스트랩 링크에서도 버튼이 숨는 문제가 생길 수
  // 있다. 캡처와 조회를 이 effect 하나 안에서 순서대로 실행해 그 경쟁을 원천적으로 없앤다.
  const [devLoginKey, setDevLoginKey] = useState<string | null>(null);

  useEffect(() => {
    // `/#devkey=...` 부트스트랩 링크로 들어온 경우 dev-login 열쇠를 localStorage에 저장하고
    // 즉시 URL에서 지운다(devLoginKey.ts 참고) - 이 키가 없어도 일반 방문자에게는 영향 없다.
    // setDevLoginKey는 effect 본문에서 바로 부르지 않고 아래 .then() 안에서 부른다 - effect 본문에서
    // setState를 동기 호출하면 린트 규칙(react-hooks/set-state-in-effect)에 걸린다.
    captureDevLoginKeyFromUrl();

    let cancelled = false;
    checkIsLoggedIn().then((result) => {
      if (cancelled) return;
      setLoggedIn(result);
      setDevLoginKey(getStoredDevLoginKey());
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const startHref = loggedIn ? '/home' : '/login';

  return (
    <div className="bg-white">
      <section className="relative overflow-hidden border-b border-slate-100">
        <div className="container mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-16 md:grid-cols-[1.05fr_0.95fr] md:py-24">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
              <Shield className="h-3.5 w-3.5" />
              사회초년생과 대학생을 위한 부동산 계약 안전 도우미
            </div>
            <h1 className="mb-6 text-4xl font-extrabold leading-tight text-slate-950 md:text-6xl">
              집을 고르는 순간부터
              <br />
              계약서 확인까지
              <br />
              <span className="text-teal-600">위험 신호를 먼저</span> 봅니다.
            </h1>
            <p className="mb-8 max-w-2xl text-lg leading-relaxed text-slate-600">
              매물 시세, 현장 체크리스트, 계약서 위험 조항, 보증금 안전성 정보를 한 흐름으로 확인해 계약 전 불안을
              줄입니다.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href={startHref} className="ansim-button-primary px-7 py-4 text-base">
                내 조건으로 시작하기 <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/preview/market" className="ansim-button-secondary px-7 py-4 text-base">
                회원가입 없이 예시보기
              </Link>
            </div>
          </div>
          <div className="relative min-h-[360px] overflow-hidden rounded-2xl bg-slate-100">
            <Image
              src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&q=80&w=1200"
              alt="밝은 주거 공간"
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-x-4 bottom-4 rounded-lg bg-white/95 p-4 shadow-lg backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">계약 전 점검 요약</span>
                <Badge className="bg-orange-100 text-orange-700">확인 필요 신호 3개</Badge>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                {landingSummaryItems.map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{label}</p>
                    <p className="font-bold text-slate-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-slate-50 py-16">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="mb-10">
            <h2 className="mb-3 text-2xl font-bold text-slate-950 md:text-3xl">
              처음 계약하는 사람에게 필요한 확인만 모았습니다
            </h2>
            <p className="text-slate-600">
              확정 판단이 아니라, 계약 전 다시 물어봐야 할 신호를 빠르게 잡아주는 것이 목표입니다. 카드를 눌러
              실제 결과 화면 예시를 확인해보세요.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {landingFeatures.map((feature) => (
              <FeatureCard
                key={feature.title}
                {...feature}
                className="p-6"
                iconClassName={`mb-5 h-11 w-11 rounded-xl p-3 ${feature.tone}`}
                descriptionClassName="text-sm text-slate-600"
                href={`/preview/${feature.demoKey}`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto max-w-4xl px-4 text-center">
          <CheckCircle2 className="mx-auto mb-4 h-10 w-10 text-teal-600" />
          <h2 className="mb-4 text-2xl font-bold text-slate-950 md:text-3xl">계약 전 확인할 질문을 바로 준비하세요</h2>
          <p className="mb-8 text-slate-600">
            위험 조항은 쉬운 설명, 집주인 또는 중개사에게 물어볼 문장, 수정 요청 문구까지 함께 제공합니다.
          </p>
          <Link href={startHref} className="ansim-button-primary mx-auto w-fit px-8 py-4">
            서비스 둘러보기 <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      <div className="pb-6 text-center">
        <DevLoginButton devLoginKey={devLoginKey} />
      </div>
    </div>
  );
}
