'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, ArrowRight, CheckCircle2, Info, Loader2, RotateCcw, Upload } from 'lucide-react';
import { getContractAnalysisErrorMessage } from '../../../lib/contractAnalysisErrors';
import { saveContractMaskingReview } from '../../../lib/contractResultStorage';
import { extractOcrText, maskContractText, submitContractInput } from '../../../services/contract-analysis';
import { type ContractMaskingReviewPayload } from '../../../types/api';

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png'];
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const SUBMIT_BUTTON_LABEL = '특약사항 분석하기';

type ProcessingStep = 'submitting-input' | 'ocr' | 'masking' | null;

const PROCESSING_STEP_LABELS: Record<Exclude<ProcessingStep, null>, string> = {
  'submitting-input': '입력을 확인하고 있어요...',
  ocr: '이미지에서 문구를 읽어오고 있어요...',
  masking: '개인정보를 마스킹하고 있어요...',
};

export default function Page() {
  const router = useRouter();
  // 죽은 코드 아님 - propertyId 전달에 사용됨. 매물 상세/체크리스트 화면의 "계약분석하기" 버튼이
  // /contract/upload?propertyId={id}로 넘어올 때만 값이 있고, 그 외(직접 접속 등)엔 없거나 파싱에
  // 실패해도 undefined로 안전하게 처리해 기존처럼 propertyId 없이 그대로 동작한다.
  const searchParams = useSearchParams();
  const propertyIdParam = searchParams.get('propertyId');
  const parsedPropertyId = propertyIdParam ? Number(propertyIdParam) : NaN;
  const propertyId = Number.isFinite(parsedPropertyId) ? parsedPropertyId : undefined;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [text, setText] = useState('');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>(null);
  // 마스킹은 이제 시스템(maskContractText)이 처리하고, 분석 진행 동의는 result 페이지의
  // "이대로 분석 진행" 버튼이 대신하므로, 여기 체크박스는 업로드 범위 자가 확인 하나만 남긴다.
  const [checks, setChecks] = useState({
    specialClauseOnly: false,
  });
  const [submitError, setSubmitError] = useState<string | undefined>();

  const isProcessing = processingStep !== null;

  // objectURL은 selectedImage로부터 파생된 값이라 state가 아니라 useMemo로 계산하고,
  // effect는 이전 URL을 정리(revoke)하는 부수효과만 담당한다.
  const imagePreviewUrl = useMemo(() => (selectedImage ? URL.createObjectURL(selectedImage) : null), [selectedImage]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const toggleCheck = (key: keyof typeof checks) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleImageFile = (file: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setSubmitError('JPG 또는 PNG 이미지만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setSubmitError('10MB 이하 이미지만 업로드 가능합니다.');
      return;
    }
    setSubmitError(undefined);
    setText('');
    setSelectedImage(file);
  };

  const handleResetImage = () => {
    setSelectedImage(null);
    setText('');
  };

  const allChecked = Object.values(checks).every(Boolean);
  const hasInput = selectedImage != null || text.trim().length > 0;
  const isButtonEnabled = allChecked && hasInput && !isProcessing;

  const navigateToMaskingReview = (payload: ContractMaskingReviewPayload) => {
    saveContractMaskingReview(payload);
    router.push('/contract/result');
  };

  // "특약사항 분석하기" 버튼 하나로 텍스트든 이미지든 상관없이 (이미지면 OCR까지) 마스킹까지 자동으로
  // 이어서 처리한다. 중간에 멈춰서 확인받는 단계는 없고, 완료되면 곧장 result 페이지로 이동한다.
  const handleSubmit = async () => {
    if (!isButtonEnabled) {
      return;
    }

    setSubmitError(undefined);

    try {
      if (selectedImage) {
        setProcessingStep('submitting-input');
        const inputResult = await submitContractInput({ inputType: 'IMAGE', image: selectedImage, propertyId });
        if (inputResult.nextStep !== 'OCR') {
          throw new Error('예상하지 못한 응답입니다.');
        }

        setProcessingStep('ocr');
        const ocrResult = await extractOcrText(selectedImage);

        setProcessingStep('masking');
        const maskResult = await maskContractText(ocrResult.extractedText);
        navigateToMaskingReview({
          ...maskResult,
          uncertainFields: ocrResult.uncertainFields,
          shortTextWarning: ocrResult.shortTextWarning,
          inputType: 'IMAGE',
          propertyId,
        });
        return;
      }

      // 텍스트 직접 입력: 항상 nextStep이 'MASKING'이어야 정상이다. OCR을 거치지 않으므로
      // uncertainFields는 항상 빈 배열이고 shortTextWarning도 항상 false다.
      setProcessingStep('submitting-input');
      const inputResult = await submitContractInput({ inputType: 'TEXT', text, propertyId });
      if (inputResult.nextStep === 'OCR') {
        throw new Error('이미지 입력이 필요합니다.');
      }

      setProcessingStep('masking');
      const maskResult = await maskContractText(text);
      navigateToMaskingReview({
        ...maskResult,
        uncertainFields: [],
        shortTextWarning: false,
        inputType: 'TEXT',
        propertyId,
      });
    } catch (error) {
      setSubmitError(
        getContractAnalysisErrorMessage(error, '특약사항 분석에 실패했습니다. 잠시 후 다시 시도해 주세요.'),
      );
      setProcessingStep(null);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8 md:py-16">
      <div className="mb-10 text-center">
        <h1 className="ansim-page-title mb-4">특약사항 AI 분석</h1>
        <p className="ansim-page-description">
          계약서 전체가 아니라 특약사항 핵심 문구만 촬영하거나 입력해 위험 문구, 쉬운 설명, 다시 물어볼 질문을
          확인합니다.
        </p>
      </div>

      <div
        className={`ansim-card mb-10 flex cursor-pointer flex-col items-center border-2 border-dashed p-10 text-center transition-all md:p-16 ${
          isDragging ? 'border-teal-500 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50/50'
        }`}
        onClick={() => {
          if (!selectedImage && !isProcessing) {
            fileInputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (isProcessing) {
            return;
          }
          const file = event.dataTransfer.files?.[0];
          if (file) {
            handleImageFile(file);
          }
        }}
      >
        {selectedImage && imagePreviewUrl ? (
          <div className="flex w-full flex-col items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- blob: 미리보기 URL이라 next/image로 최적화 불가 */}
            <img
              src={imagePreviewUrl}
              alt="선택한 특약사항 이미지 미리보기"
              className="max-h-64 rounded-lg object-contain"
            />
            <p className="text-sm text-slate-500">{selectedImage.name}</p>
            <button
              type="button"
              disabled={isProcessing}
              onClick={(event) => {
                event.stopPropagation();
                handleResetImage();
              }}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:pointer-events-none disabled:opacity-50"
            >
              <RotateCcw className="h-4 w-4" /> 다시 선택
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100">
              <Upload className="h-8 w-8 text-teal-600" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-950">특약사항 문구 업로드</h3>
            <p className="max-w-sm text-slate-500">클릭하거나 파일을 끌어다 놓으세요.</p>
          </>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            handleImageFile(file);
          }
          event.target.value = '';
        }}
      />

      <div className="mb-10">
        <label className="mb-3 block text-sm font-bold text-slate-700">직접 입력</label>
        <textarea
          className="ansim-input min-h-36 resize-y"
          placeholder="예: 임대인은 개인 사정에 따라 계약 기간 중 목적물 명도를 요청할 수 있다."
          value={text}
          disabled={isProcessing}
          onChange={(event) => {
            const value = event.target.value;
            setText(value);
            // 이미지가 선택돼 있는 상태로 타이핑을 시작하면, 텍스트 입력으로 전환하는 것으로 보고
            // 이미지 선택을 해제한다(이미지/텍스트 동시 입력으로 헷갈리지 않도록).
            if (selectedImage) {
              setSelectedImage(null);
            }
          }}
        />
      </div>

      <div className="mb-10 grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="ansim-card border-blue-100 bg-blue-50/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <h4 className="font-bold text-slate-950">분석 범위</h4>
          </div>
          <ul className="space-y-3">
            {[
              '특약사항과 핵심 문구만 분석합니다.',
              'AI 결과는 법률 자문이 아니라 참고용 설명입니다.',
              '수정 문구는 임대인에게 요청할 수 있는 예시로만 제공합니다.',
            ].map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="ansim-card border-orange-100 bg-orange-50/50 p-6">
          <div className="mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <h4 className="font-bold text-slate-950">개인정보 확인</h4>
          </div>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3 rounded-lg bg-white/70 p-3">
              <input
                type="checkbox"
                checked={checks.specialClauseOnly}
                onChange={() => toggleCheck('specialClauseOnly')}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-sm leading-relaxed text-slate-700">특약사항 부분만 올렸습니다.</span>
            </label>
          </div>
        </div>
      </div>

      {submitError && <p className="mb-4 text-center text-sm text-red-600">{submitError}</p>}

      {isProcessing && processingStep && (
        <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
          <span>{PROCESSING_STEP_LABELS[processingStep]}</span>
        </div>
      )}

      <button
        type="button"
        disabled={!isButtonEnabled}
        onClick={handleSubmit}
        className={`flex w-full items-center justify-center gap-2 rounded-lg px-6 py-4 font-bold transition ${
          isButtonEnabled
            ? 'bg-teal-600 text-white hover:bg-teal-700'
            : 'pointer-events-none bg-slate-200 text-slate-400'
        }`}
      >
        {isProcessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            {SUBMIT_BUTTON_LABEL} <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
    </div>
  );
}
