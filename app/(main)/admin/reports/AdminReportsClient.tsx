'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAdminPropertyReportDetail, reviewAdminPropertyReport } from '../../../services/adminActions';
import {
  type AdminPropertyReportDetailDto,
  type AdminPropertyReportListItemDto,
  type PageResponseDto,
  type PropertyReportReasonDto,
} from '../../../types/api';
import { Badge } from '../../../ui/Badge';
import { Modal } from '../../../ui/Modal';
import { Pagination } from '../../../ui/Pagination';
import { Table } from '../../../ui/Table';

type Filters = {
  status: string;
  reason: string;
};

type AdminReportsClientProps = {
  data?: PageResponseDto<AdminPropertyReportListItemDto>;
  loadError?: string;
  filters: Filters;
  onMutated?: () => void;
};

const REASON_LABEL: Record<PropertyReportReasonDto, string> = {
  ALREADY_CONTRACTED: '이미 계약된 매물',
  PRICE_MISMATCH: '실제 가격과 다름',
  INFO_MISMATCH: '매물 정보 불일치',
  DUPLICATE: '중복 등록',
  ETC: '기타',
};

const STATUS_LABEL: Record<string, string> = { RECEIVED: '접수', RESOLVED: '조치완료', REJECTED: '반려' };
const STATUS_TONE: Record<string, string> = {
  RECEIVED: 'bg-orange-50 text-orange-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-slate-100 text-slate-500',
};

export function AdminReportsClient({ data, loadError, filters, onMutated }: AdminReportsClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(filters.status);
  const [reason, setReason] = useState(filters.reason);
  const [detail, setDetail] = useState<AdminPropertyReportDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>();
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 필터 select의 로컬 state는 useState(filters.x)로 최초 1회만 seed되므로, 브라우저 뒤로/앞으로
  // 가기로 filters props만 바뀌는 경우엔 반영되지 않아 테이블은 새 필터 결과를 보여주는데 select는
  // 이전 값을 계속 보여주는 것처럼 어긋난다. filters가 바뀔 때마다 로컬 state를 다시 맞춰준다.
  useEffect(() => {
    // filters가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과 동일).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(filters.status);
    setReason(filters.reason);
  }, [filters.status, filters.reason]);

  function navigate(next: Partial<Filters & { page: number }>) {
    const merged = { status, reason, page: 0, ...next };
    const query = new URLSearchParams();
    // status는 항상 명시적으로 남긴다 - 생략하면 서버가 최초진입으로 오인해 RECEIVED로
    // 되돌아가버려 "전체(ALL)"를 선택한 사용자의 의도가 새로고침/페이지 이동마다 사라진다.
    query.set('status', merged.status || 'RECEIVED');
    if (merged.reason) query.set('reason', merged.reason);
    if (merged.page) query.set('page', String(merged.page));
    const queryString = query.toString();
    router.push(`/admin/reports${queryString ? `?${queryString}` : ''}`);
  }

  function closeModal() {
    setDetail(null);
    setDetailError(undefined);
  }

  async function openDetail(row: AdminPropertyReportListItemDto) {
    setDetailLoading(true);
    setDetailError(undefined);
    setMemo('');
    try {
      const result = await getAdminPropertyReportDetail(row.id);
      setDetail(result);
    } catch {
      setDetailError('상세 정보를 불러오지 못했습니다.');
    } finally {
      setDetailLoading(false);
    }
  }

  async function submitReview(nextStatus: 'RESOLVED' | 'REJECTED') {
    if (!detail) return;
    setSubmitting(true);
    setDetailError(undefined);
    try {
      const updated = await reviewAdminPropertyReport(detail.id, {
        status: nextStatus,
        memo: memo.trim() || undefined,
      });
      setDetail(updated);
      // router.refresh()는 이 화면이 전부 client component로 바뀌면서 다시 가져올 Server
      // Component 데이터가 없어 실질적으로 no-op이다 - 부모(page.tsx)가 내려준 재조회 콜백을
      // 직접 호출해야 목록에 변경 결과가 반영된다.
      onMutated?.();
    } catch {
      setDetailError('처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="ansim-page-title mb-6">신고 관리</h1>

      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[auto_auto_auto]">
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            navigate({ status: event.target.value });
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        >
          <option value="RECEIVED">접수 (대기중)</option>
          <option value="RESOLVED">조치완료</option>
          <option value="REJECTED">반려</option>
          <option value="ALL">전체</option>
        </select>
        <select
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            navigate({ reason: event.target.value });
          }}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        >
          <option value="">전체 사유</option>
          {Object.entries(REASON_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loadError && <div className="ansim-card mb-4 border-red-100 bg-red-50 p-6 text-sm text-red-700">{loadError}</div>}

      {data && (
        <>
          <Table
            columns={[
              { key: 'id', header: 'ID', render: (row) => row.id },
              { key: 'propertyAddress', header: '매물 주소', render: (row) => row.propertyAddress ?? '-' },
              { key: 'reporterNickname', header: '신고자', render: (row) => row.reporterNickname ?? '-' },
              { key: 'reason', header: '사유', render: (row) => REASON_LABEL[row.reason] },
              {
                key: 'status',
                header: '상태',
                render: (row) => <Badge className={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
              },
              {
                key: 'createdAt',
                header: '접수일',
                render: (row) => new Date(row.createdAt).toLocaleDateString('ko-KR'),
              },
              {
                key: 'actions',
                header: '',
                render: (row) => (
                  <button
                    onClick={() => openDetail(row)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    상세보기
                  </button>
                ),
              },
            ]}
            rows={data.content}
            rowKey={(row) => row.id}
            emptyMessage="조건에 맞는 신고가 없습니다."
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={(page) => navigate({ page })} />
        </>
      )}

      <Modal
        open={detail !== null || detailLoading || detailError !== undefined}
        onClose={() => {
          if (!submitting) closeModal();
        }}
      >
        {detailLoading && <p className="text-sm text-slate-500">불러오는 중...</p>}
        {!detailLoading && !detail && detailError && (
          <div>
            <p className="mb-4 text-sm text-red-600">{detailError}</p>
            <div className="flex justify-end">
              <button
                onClick={closeModal}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
              >
                닫기
              </button>
            </div>
          </div>
        )}
        {detail && !detailLoading && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-950">신고 #{detail.id}</h2>
              <Badge className={STATUS_TONE[detail.status]}>{STATUS_LABEL[detail.status]}</Badge>
            </div>

            <div className="mb-4 space-y-2 text-sm">
              <p>
                <span className="font-bold text-slate-700">매물</span> {detail.propertyAddress ?? '-'} (
                {detail.propertyType ?? '-'} / {detail.transactionType ?? '-'})
              </p>
              <p>
                <span className="font-bold text-slate-700">신고자</span> {detail.reporterNickname ?? '-'} (
                {detail.reporterEmail ?? '이메일 없음'})
              </p>
              <p>
                <span className="font-bold text-slate-700">사유</span> {REASON_LABEL[detail.reason]}
              </p>
              {detail.detail && (
                <p>
                  <span className="font-bold text-slate-700">상세 내용</span> {detail.detail}
                </p>
              )}
              {detail.reviewedAt && (
                <p className="text-slate-500">
                  {new Date(detail.reviewedAt).toLocaleString('ko-KR')}에 처리됨
                  {detail.reviewMemo ? ` - ${detail.reviewMemo}` : ''}
                </p>
              )}
            </div>

            {detailError && <p className="mb-3 text-sm text-red-600">{detailError}</p>}

            {detail.status === 'RECEIVED' ? (
              <div>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  rows={2}
                  placeholder="처리 메모 (선택)"
                  className="ansim-input mb-3 w-full resize-none"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={closeModal}
                    disabled={submitting}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                  >
                    닫기
                  </button>
                  <button
                    onClick={() => submitReview('REJECTED')}
                    disabled={submitting}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
                  >
                    반려
                  </button>
                  <button
                    onClick={() => submitReview('RESOLVED')}
                    disabled={submitting}
                    className="ansim-button-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    조치완료
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end">
                <button
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                >
                  닫기
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
