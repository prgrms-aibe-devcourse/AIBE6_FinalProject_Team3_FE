'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { resolveErrorMessage } from '../../../lib/resolveErrorMessage';
import {
  bulkReviewAdminPropertyReports,
  getAdminPropertyReportDetail,
  reviewAdminPropertyReport,
} from '../../../services/adminActions';
import {
  type AdminBulkActionResponseDto,
  type AdminPropertyReportDetailDto,
  type AdminPropertyReportListItemDto,
  type AdminPropertyReportStatusDto,
  type PageResponseDto,
  type PropertyReportReasonDto,
} from '../../../types/api';
import { Badge } from '../../../ui/Badge';
import { Modal } from '../../../ui/Modal';
import { Pagination } from '../../../ui/Pagination';
import { Table } from '../../../ui/Table';

// 백엔드 AdminPropertyReportReviewRequest의 @Size(max = 500)와 맞춰둔다 - 프론트에서 안 막으면
// 그 길이를 넘겼을 때 제출 후에야 validation 에러로 알게 된다.
const MEMO_MAX_LENGTH = 500;

type Filters = {
  status: string;
  reason: string;
};

type AdminReportsClientProps = {
  data?: PageResponseDto<AdminPropertyReportListItemDto>;
  loadError?: string;
  filters: Filters;
  currentUserId: number;
  onMutated?: () => void;
};

const REASON_LABEL: Record<PropertyReportReasonDto, string> = {
  ALREADY_CONTRACTED: '이미 계약된 매물',
  PRICE_MISMATCH: '실제 가격과 다름',
  INFO_MISMATCH: '매물 정보 불일치',
  DUPLICATE: '중복 등록',
  ETC: '기타',
};

// enum 값에 맞춰 타입을 좁혀둔다 - Record<string, string>이면 AdminPropertyReportStatusDto에 값이
// 추가돼도 컴파일러가 이 매핑에 라벨 추가를 빠뜨린 걸 잡아주지 못한다.
const STATUS_LABEL: Record<AdminPropertyReportStatusDto, string> = {
  RECEIVED: '접수',
  RESOLVED: '조치완료',
  REJECTED: '반려',
};
const STATUS_TONE: Record<AdminPropertyReportStatusDto, string> = {
  RECEIVED: 'bg-orange-50 text-orange-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-slate-100 text-slate-500',
};

type ReportBulkAction = { status: 'RESOLVED' | 'REJECTED' };

// 이미 조치완료/반려된 신고는 backend가 RECEIVED만 재검토 대상으로 허용한다(transitionTo 참고) -
// 상세 모달의 처리 버튼도 RECEIVED일 때만 보여주는 것과 같은 이유로, 일괄처리 체크박스 대상도
// RECEIVED로만 제한한다. 본인이 신고한 건도 backend가 셀프 검토로 거부하므로(AdminUsersClient의
// 본인 계정 제외와 동일한 이유) 같이 제외한다.
function isReportBulkSelectable(row: AdminPropertyReportListItemDto, currentUserId: number): boolean {
  return row.status === 'RECEIVED' && row.reporterId !== currentUserId;
}

export function AdminReportsClient({ data, loadError, filters, currentUserId, onMutated }: AdminReportsClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState(filters.status);
  const [reason, setReason] = useState(filters.reason);
  const [detail, setDetail] = useState<AdminPropertyReportDetailDto | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | undefined>();
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // 반려/조치완료 둘 다 확정되면 되돌릴 UI 수단이 없는(모달이 닫기 버튼만 남기는) 되돌릴 수
  // 없는 결정이다 - AdminUsersClient의 권한/정지 변경과 동일하게, 버튼 클릭이 바로 API를
  // 호출하지 않고 확인 단계를 한 번 거치게 한다.
  const [pendingStatus, setPendingStatus] = useState<'RESOLVED' | 'REJECTED' | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<ReportBulkAction | null>(null);
  const [bulkMemo, setBulkMemo] = useState('');
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | undefined>();
  const [bulkResult, setBulkResult] = useState<AdminBulkActionResponseDto | null>(null);

  // A를 열고(응답 느림) 닫은 뒤 B를 열면(응답 빠름), B가 먼저 반영된 뒤 뒤늦게 도착한 A의 응답이
  // detail을 도로 덮어써 B를 보고 있어야 할 화면에 A의 내용이 보일 수 있다 - 응답이 도착했을 때
  // 그게 여전히 가장 최근 요청인지 확인한 뒤에만 반영한다(reports/page.tsx의 requestIdRef와
  // 동일한 패턴).
  const detailRequestIdRef = useRef(0);

  // 필터 select의 로컬 state는 useState(filters.x)로 최초 1회만 seed되므로, 브라우저 뒤로/앞으로
  // 가기로 filters props만 바뀌는 경우엔 반영되지 않아 테이블은 새 필터 결과를 보여주는데 select는
  // 이전 값을 계속 보여주는 것처럼 어긋난다. filters가 바뀔 때마다 로컬 state를 다시 맞춰준다.
  useEffect(() => {
    // filters가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과 동일).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(filters.status);
    setReason(filters.reason);
  }, [filters.status, filters.reason]);

  // data가 바뀔 때(필터 이동/페이지 이동/일괄처리 후 재조회)마다 선택 상태를 비운다 - 이전 목록에서
  // 선택했던 id가 새 목록에 없는 채로 남아있으면 "선택 N건"이 실제 화면과 어긋나 보인다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(new Set());
  }, [data]);

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
    // 아직 응답이 안 온 openDetail()이 있다면, 닫은 뒤 뒤늦게 도착해 모달을 다시 열어버리거나
    // (detail/detailError) 로딩 스피너를 다시 띄우지(finally) 않도록 그 요청도 여기서 무효화하고,
    // 로딩 상태도 즉시 강제로 꺼서 닫기 자체는 진행 중인 요청과 무관하게 항상 바로 반영되게 한다.
    detailRequestIdRef.current += 1;
    setDetail(null);
    setDetailLoading(false);
    setDetailError(undefined);
    setPendingStatus(null);
  }

  async function openDetail(row: AdminPropertyReportListItemDto) {
    const requestId = ++detailRequestIdRef.current;
    setDetailLoading(true);
    setDetailError(undefined);
    setMemo('');
    setPendingStatus(null);
    try {
      const result = await getAdminPropertyReportDetail(row.id);
      if (requestId !== detailRequestIdRef.current) return;
      setDetail(result);
    } catch (error) {
      if (requestId !== detailRequestIdRef.current) return;
      setDetailError(resolveErrorMessage(error, '상세 정보를 불러오지 못했습니다.'));
    } finally {
      if (requestId === detailRequestIdRef.current) setDetailLoading(false);
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
    } catch (error) {
      setDetailError(resolveErrorMessage(error, '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleSelect(key: string | number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key as number)) {
        next.delete(key as number);
      } else {
        next.add(key as number);
      }
      return next;
    });
  }

  function toggleSelectAll(selectableRows: AdminPropertyReportListItemDto[]) {
    setSelectedIds((prev) => {
      const allSelected = selectableRows.length > 0 && selectableRows.every((row) => prev.has(row.id));
      const next = new Set(prev);
      selectableRows.forEach((row) => {
        if (allSelected) {
          next.delete(row.id);
        } else {
          next.add(row.id);
        }
      });
      return next;
    });
  }

  function closeBulkModal() {
    setBulkAction(null);
    setBulkResult(null);
    setBulkError(undefined);
    setBulkMemo('');
  }

  async function confirmBulkAction() {
    if (!bulkAction) return;
    setBulkSubmitting(true);
    setBulkError(undefined);
    try {
      const result = await bulkReviewAdminPropertyReports({
        reportIds: Array.from(selectedIds),
        status: bulkAction.status,
        memo: bulkMemo.trim() || undefined,
      });
      setBulkAction(null);
      setBulkResult(result);
      setSelectedIds(new Set());
      onMutated?.();
    } catch (error) {
      setBulkError(resolveErrorMessage(error, '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setBulkSubmitting(false);
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

      {loadError && (
        <div className="ansim-card mb-4 border-red-100 bg-red-50 p-6 text-sm text-red-700">{loadError}</div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
          <span className="text-sm font-bold text-teal-700">{selectedIds.size}건 선택됨</span>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkAction({ status: 'RESOLVED' })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              선택 조치완료
            </button>
            <button
              onClick={() => setBulkAction({ status: 'REJECTED' })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              선택 반려
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              선택 해제
            </button>
          </div>
        </div>
      )}

      {data && (
        <>
          <Table
            selection={{
              selectedKeys: selectedIds,
              onToggle: toggleSelect,
              onToggleAll: toggleSelectAll,
              isRowSelectable: (row) => isReportBulkSelectable(row, currentUserId),
            }}
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

            {detail.status === 'RECEIVED' && detail.reporterId === currentUserId ? (
              // 본인이 신고한 건은 backend가 셀프 검토로 거부한다(AdminUsersClient의 본인 계정
              // 처리와 동일한 이유) - 실패할 액션을 보여주지 않고 여기서 숨긴다.
              <div>
                <p className="mb-4 text-sm text-slate-500">본인이 신고한 건은 직접 처리할 수 없습니다.</p>
                <div className="flex justify-end">
                  <button
                    onClick={closeModal}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                  >
                    닫기
                  </button>
                </div>
              </div>
            ) : detail.status === 'RECEIVED' && pendingStatus ? (
              // 반려/조치완료는 한 번 확정되면 이 화면에서 되돌릴 방법이 없는 결정이라, 실제
              // 처리 전에 한 번 더 확인받는다(AdminUsersClient의 권한/정지 변경과 동일한 패턴).
              <div>
                <p className="mb-4 text-sm text-slate-700">
                  이 신고를 <strong>{pendingStatus === 'RESOLVED' ? '조치완료' : '반려'}</strong> 처리할까요? 처리
                  후에는 되돌릴 수 없습니다.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setPendingStatus(null)}
                    disabled={submitting}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => submitReview(pendingStatus)}
                    disabled={submitting}
                    className="ansim-button-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : detail.status === 'RECEIVED' ? (
              <div>
                <label className="mb-1 block text-xs font-bold text-slate-600">
                  처리 메모 (선택, {memo.length}/{MEMO_MAX_LENGTH}자)
                </label>
                <textarea
                  value={memo}
                  onChange={(event) => setMemo(event.target.value)}
                  rows={2}
                  maxLength={MEMO_MAX_LENGTH}
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
                    onClick={() => setPendingStatus('REJECTED')}
                    disabled={submitting}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 disabled:opacity-50"
                  >
                    반려
                  </button>
                  <button
                    onClick={() => setPendingStatus('RESOLVED')}
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

      <Modal open={bulkAction !== null || bulkResult !== null} onClose={() => (bulkSubmitting ? undefined : closeBulkModal())}>
        {bulkResult ? (
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-950">일괄 처리 결과</h2>
            <p className="mb-3 text-sm text-slate-700">
              성공 {bulkResult.succeededIds.length}건
              {bulkResult.failures.length > 0 ? `, 실패 ${bulkResult.failures.length}건` : ''}
            </p>
            {bulkResult.failures.length > 0 && (
              <ul className="mb-4 max-h-40 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                {bulkResult.failures.map((failure) => (
                  <li key={failure.id}>
                    ID {failure.id}: {failure.message}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button onClick={closeBulkModal} className="ansim-button-primary px-4 py-2 text-sm">
                확인
              </button>
            </div>
          </div>
        ) : (
          bulkAction && (
            <div>
              <h2 className="mb-2 text-lg font-bold text-slate-950">
                선택한 {selectedIds.size}건을 {bulkAction.status === 'RESOLVED' ? '조치완료' : '반려'} 처리할까요? 처리
                후에는 되돌릴 수 없습니다.
              </h2>
              <label className="mb-1 block text-xs font-bold text-slate-600">
                처리 메모 (선택, 선택한 항목 전체에 동일하게 적용됩니다, {bulkMemo.length}/{MEMO_MAX_LENGTH}자)
              </label>
              <textarea
                value={bulkMemo}
                onChange={(event) => setBulkMemo(event.target.value)}
                rows={2}
                maxLength={MEMO_MAX_LENGTH}
                placeholder="처리 메모 (선택)"
                className="ansim-input mb-3 w-full resize-none"
              />
              {bulkError && <p className="mb-3 text-sm text-red-600">{bulkError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  onClick={closeBulkModal}
                  disabled={bulkSubmitting}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
                >
                  취소
                </button>
                <button
                  onClick={confirmBulkAction}
                  disabled={bulkSubmitting}
                  className="ansim-button-primary px-4 py-2 text-sm disabled:opacity-50"
                >
                  확인
                </button>
              </div>
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
