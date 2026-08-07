'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { formatDecimalInput, formatIntegerInput } from '../../../../lib/numberFormat';
import { updateProperty } from '../../../../services/properties';
import { type PropertyDetail, type PropertyImage } from '../../../../types/domain';
import { LoadingOverlay } from '../../../../ui/LoadingOverlay';
import { PropertyImageUploader } from '../../../../ui/PropertyImageUploader';

type PropertyEditClientProps = {
  propertyId: number;
  property?: PropertyDetail;
  loadError?: string;
};

export function PropertyEditClient({ propertyId, property, loadError }: PropertyEditClientProps) {
  const router = useRouter();

  const [title, setTitle] = useState(property?.title ?? '');
  const [deposit, setDeposit] = useState(
    property?.depositAmount !== undefined ? formatIntegerInput(String(property.depositAmount)) : '',
  );
  const [monthlyRent, setMonthlyRent] = useState(
    property?.monthlyRentAmount ? formatIntegerInput(String(property.monthlyRentAmount)) : '',
  );
  const [area, setArea] = useState(property?.area !== undefined ? formatDecimalInput(String(property.area)) : '');
  // 관리비 0(관리비 없음으로 명시)과 null(입력 안 함)을 구분해야 하므로 falsy 체크(?)가 아니라
  // != null로 프리필 여부를 판단한다 - monthlyRentAmount처럼 0이 "값 없음"과 같은 의미가 아니다.
  const [maintenanceFee, setMaintenanceFee] = useState(
    property?.maintenanceFeeAmount != null ? formatIntegerInput(String(property.maintenanceFeeAmount)) : '',
  );
  const [description, setDescription] = useState(property?.description ?? '');
  const [images, setImages] = useState<PropertyImage[]>(property?.images ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loadError || !property) {
    return (
      <div className="container mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 text-center">
        <h1 className="mb-3 text-2xl font-bold text-slate-950">
          {loadError ? '매물 정보를 불러오지 못했습니다' : '매물을 찾을 수 없습니다'}
        </h1>
        <p className="mb-6 text-sm text-slate-500">{loadError ?? '삭제되었거나 존재하지 않는 매물입니다.'}</p>
        <Link href="/properties" className="ansim-button-primary">
          매물 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const isMonthlyRent = property.type === '월세';

  async function handleSubmit() {
    setError(null);

    const depositNumber = Number(deposit.replace(/,/g, ''));
    const areaNumber = Number(area.replace(/,/g, ''));

    if (title.trim().length === 0) {
      setError('매물 이름을 입력해주세요.');
      return;
    }
    if (!deposit || Number.isNaN(depositNumber) || depositNumber <= 0) {
      setError('보증금을 올바르게 입력해주세요.');
      return;
    }
    if (!area || Number.isNaN(areaNumber) || areaNumber <= 0) {
      setError('전용면적을 올바르게 입력해주세요.');
      return;
    }

    let monthlyRentNumber: number | null = null;
    if (isMonthlyRent) {
      monthlyRentNumber = Number(monthlyRent.replace(/,/g, ''));
      if (!monthlyRent || Number.isNaN(monthlyRentNumber) || monthlyRentNumber <= 0) {
        setError('월세를 올바르게 입력해주세요.');
        return;
      }
    }

    // 관리비는 선택 입력 - 비워두면 null(관리비 자체를 안 물어본 상태), 입력하면 0 이상이어야 한다.
    let maintenanceFeeNumber: number | null = null;
    if (maintenanceFee.trim().length > 0) {
      maintenanceFeeNumber = Number(maintenanceFee.replace(/,/g, ''));
      if (Number.isNaN(maintenanceFeeNumber) || maintenanceFeeNumber < 0) {
        setError('관리비를 올바르게 입력해주세요.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await updateProperty(propertyId, {
        title: title.trim(),
        deposit: depositNumber,
        monthlyRent: monthlyRentNumber,
        area: areaNumber,
        maintenanceFee: maintenanceFeeNumber,
        description: description.trim().length > 0 ? description.trim() : null,
        images,
      });
      router.push(`/properties/${propertyId}`);
    } catch {
      setError('매물 수정에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <div className="border-b border-slate-200 bg-white">
        <div className="container mx-auto flex h-16 max-w-3xl items-center gap-3 px-4">
          <Link href={`/properties/${propertyId}`} className="-ml-2 p-2 text-slate-500 hover:text-slate-950">
            <ArrowLeft className="h-6 w-6" />
          </Link>
          <h1 className="text-lg font-bold text-slate-950">매물 정보 수정</h1>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 py-8">
        <div className="ansim-card relative mb-6 p-6">
          {isSubmitting && <LoadingOverlay message="실거래가 비교를 다시 계산하고 있어요. 몇 초 정도 걸릴 수 있어요." />}

          <h2 className="mb-2 text-xl font-bold text-slate-950">가격/면적/설명을 수정하세요</h2>
          <p className="mb-6 text-sm text-slate-600">
            주소와 매물·거래 유형은 등록 시 확정된 값이라 수정할 수 없어요. 변경이 필요하면 매물을 새로 등록해주세요.
          </p>

          <div className="mb-6 space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
            <p className="text-slate-500">
              주소 · <span className="font-semibold text-slate-700">{property.address}</span>
            </p>
            <p className="text-slate-500">
              매물/거래 유형 ·{' '}
              <span className="font-semibold text-slate-700">
                {property.propertyType} · {property.type}
              </span>
            </p>
          </div>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">매물 이름</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={isSubmitting}
                className="ansim-input disabled:opacity-60"
                placeholder="예: 강남 오피스텔"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">보증금 (원)</span>
                <input
                  value={deposit}
                  onChange={(event) => setDeposit(formatIntegerInput(event.target.value))}
                  inputMode="numeric"
                  disabled={isSubmitting}
                  className="ansim-input disabled:opacity-60"
                  placeholder="예: 180,000,000"
                />
              </label>
              {isMonthlyRent && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-slate-700">월세 (원)</span>
                  <input
                    value={monthlyRent}
                    onChange={(event) => setMonthlyRent(formatIntegerInput(event.target.value))}
                    inputMode="numeric"
                    disabled={isSubmitting}
                    className="ansim-input disabled:opacity-60"
                    placeholder="예: 550,000"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">전용면적 (㎡)</span>
                <input
                  value={area}
                  onChange={(event) => setArea(formatDecimalInput(event.target.value))}
                  inputMode="decimal"
                  disabled={isSubmitting}
                  className="ansim-input disabled:opacity-60"
                  placeholder="예: 42.5"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">관리비 (원, 선택)</span>
                <input
                  value={maintenanceFee}
                  onChange={(event) => setMaintenanceFee(formatIntegerInput(event.target.value))}
                  inputMode="numeric"
                  disabled={isSubmitting}
                  className="ansim-input disabled:opacity-60"
                  placeholder="예: 100,000"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">설명 (선택)</span>
              <input
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSubmitting}
                className="ansim-input disabled:opacity-60"
                placeholder="예: 역세권, 신축 오피스텔"
              />
            </label>

            <PropertyImageUploader value={images} onChange={setImages} disabled={isSubmitting} />
          </div>
        </div>

        {error && <div className="ansim-card mb-4 border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="ansim-button-primary w-full py-4 text-base disabled:opacity-60"
        >
          {isSubmitting ? '저장 중...' : '수정 완료'}
        </button>
      </div>
    </div>
  );
}
