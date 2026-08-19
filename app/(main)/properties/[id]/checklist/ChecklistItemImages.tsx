'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Modal } from '../../../../ui/Modal';

type ChecklistItemImagesProps = {
  images: string[];
};

// 문항 템플릿에 딸린 참고 이미지(관리자 등록, AI 생성 예시)를 가로 스크롤 썸네일로 보여주고,
// 클릭하면 공용 Modal로 확대해서 보여준다. 이미지가 없는 문항이 대부분이라 빈 배열이면 아무것도
// 그리지 않는다.
export function ChecklistItemImages({ images }: ChecklistItemImagesProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (images.length === 0) {
    return null;
  }

  return (
    <div className="mb-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((imageUrl, index) => (
          <button
            key={imageUrl}
            type="button"
            onClick={() => setSelectedIndex(index)}
            className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200"
          >
            <Image src={imageUrl} alt={`참고 이미지 ${index + 1}`} fill sizes="64px" className="object-cover" />
          </button>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-slate-400">이 사진은 AI가 생성한 예시 이미지입니다.</p>

      <Modal open={selectedIndex !== null} onClose={() => setSelectedIndex(null)} maxWidthClassName="max-w-lg">
        {selectedIndex !== null && (
          <div className="relative">
            <div className="relative aspect-square w-full overflow-hidden rounded-lg">
              <Image
                src={images[selectedIndex]}
                alt={`참고 이미지 ${selectedIndex + 1} 확대`}
                fill
                sizes="(min-width: 640px) 512px, 100vw"
                className="object-contain"
              />
            </div>
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((current) => ((current ?? 0) - 1 + images.length) % images.length)}
                  aria-label="이전 사진"
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/50 p-1.5 text-white transition hover:bg-slate-950/70"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedIndex((current) => ((current ?? 0) + 1) % images.length)}
                  aria-label="다음 사진"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-slate-950/50 p-1.5 text-white transition hover:bg-slate-950/70"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <p className="mt-2 text-center text-xs text-slate-400">
                  {selectedIndex + 1} / {images.length}
                </p>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
