'use client';

import { useCallback, useState } from 'react';

// 다음(Daum) 우편번호 서비스 - 카카오 계열이 운영하는 무료 주소 검색 팝업으로, API 키 없이
// 스크립트 태그만으로 붙는다(#170). 등록 폼에서 직접 타이핑 대신 이 팝업으로 고른 주소만
// 받게 해서, 존재하지 않는 주소가 애초에 입력되지 않도록 한다. 팝업이 주는 값은 도로명/지번
// 주소 문자열뿐이라 좌표 변환은 여전히 BE의 KakaoAddressClient.resolve()가 담당한다.
type DaumPostcodeData = {
  roadAddress: string;
  jibunAddress: string;
};

type DaumPostcodeSdk = {
  Postcode: new (options: { oncomplete: (data: DaumPostcodeData) => void }) => { open: () => void };
};

declare global {
  interface Window {
    daum?: DaumPostcodeSdk;
  }
}

// KakaoMap.tsx의 loadKakaoMap()과 동일한 패턴 - 이미 로드됐으면 즉시 resolve, 로딩 중이면 그
// Promise를 공유해서 버튼을 여러 번 눌러도 스크립트 태그가 중복 삽입되지 않게 한다.
let daumPostcodeLoader: Promise<DaumPostcodeSdk> | null = null;

function loadDaumPostcode(): Promise<DaumPostcodeSdk> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Daum Postcode can only be loaded in the browser.'));
  }

  if (window.daum?.Postcode) {
    return Promise.resolve(window.daum);
  }

  if (daumPostcodeLoader) {
    return daumPostcodeLoader;
  }

  daumPostcodeLoader = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>('script[data-daum-postcode-sdk="true"]');

    const handleLoad = () => {
      if (window.daum?.Postcode) {
        resolve(window.daum);
      } else {
        reject(new Error('Daum Postcode SDK is not available.'));
      }
    };

    if (existingScript) {
      existingScript.addEventListener('load', handleLoad, { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Daum Postcode SDK.')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.dataset.daumPostcodeSdk = 'true';
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    script.onload = handleLoad;
    script.onerror = () => {
      daumPostcodeLoader = null;
      reject(new Error('Failed to load Daum Postcode SDK.'));
    };
    document.head.appendChild(script);
  });

  return daumPostcodeLoader;
}

type AddressSearchFieldProps = {
  value: string;
  onChange: (address: string) => void;
  disabled?: boolean;
};

export function AddressSearchField({ value, onChange, disabled }: AddressSearchFieldProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const openPostcode = useCallback(() => {
    setStatus('loading');
    loadDaumPostcode()
      .then((daum) => {
        setStatus('idle');
        new daum.Postcode({
          oncomplete: (data) => {
            // 도로명주소가 없는 예외적인 경우(신축 등)에만 지번주소로 대체한다 - BE
            // KakaoAddressClient가 어느 쪽 문자열이든 검색해서 정규화하므로 둘 다 유효한 입력이다.
            onChange(data.roadAddress || data.jibunAddress);
          },
        }).open();
      })
      .catch(() => {
        setStatus('error');
      });
  }, [onChange]);

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={value}
          readOnly
          onClick={disabled ? undefined : openPostcode}
          disabled={disabled}
          placeholder="주소 검색 버튼을 눌러 주소를 선택하세요"
          className="ansim-input flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="button"
          onClick={openPostcode}
          disabled={disabled || status === 'loading'}
          className="shrink-0 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {status === 'loading' ? '불러오는 중...' : '주소 검색'}
        </button>
      </div>
      {status === 'error' && (
        <p className="mt-2 text-xs text-red-600">주소 검색 서비스를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
      )}
    </div>
  );
}
