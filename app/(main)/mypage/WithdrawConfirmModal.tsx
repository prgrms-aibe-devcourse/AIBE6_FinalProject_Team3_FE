'use client';

import { AlertTriangle } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { NoticeBox } from '../../ui/NoticeBox';

type WithdrawConfirmModalProps = {
  open: boolean;
  isWithdrawing: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
};

// PropertyDeleteConfirmModal과 동일한 패턴 - 처리 중에는 배경 클릭으로 안 닫히게 onClose를 넘기지 않는다.
export function WithdrawConfirmModal({ open, isWithdrawing, error, onClose, onConfirm }: WithdrawConfirmModalProps) {
  return (
    <Modal open={open} onClose={isWithdrawing ? undefined : onClose}>
      <h2 className="mb-1 text-lg font-bold text-slate-950">정말 탈퇴하시겠어요?</h2>
      <p className="mb-5 text-sm text-slate-500">
        탈퇴하면 프로필·관심 정보, 등록한 체크리스트, 소셜 로그인 연동이 모두 삭제되며 되돌릴 수 없어요. 등록한
        매물은 다른 사용자의 기록 보존을 위해 목록에서만 숨겨집니다.
      </p>

      {error && (
        <NoticeBox icon={AlertTriangle} iconClassName="text-red-500" className="mb-4 bg-red-50 text-red-600">
          {error}
        </NoticeBox>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={isWithdrawing}
          className="ansim-button-secondary flex-1 disabled:opacity-60"
        >
          취소
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isWithdrawing}
          className="ansim-button-primary flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-60"
        >
          {isWithdrawing ? '탈퇴 처리 중...' : '탈퇴하기'}
        </button>
      </div>
    </Modal>
  );
}
