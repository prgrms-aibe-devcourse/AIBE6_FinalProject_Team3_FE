'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { resolveErrorMessage } from '../../../lib/resolveErrorMessage';
import { bulkUpdateAdminUserStatus, updateAdminUserRole, updateAdminUserStatus } from '../../../services/adminActions';
import {
  type AdminBulkActionResponseDto,
  type AdminRoleDto,
  type AdminUserListItemDto,
  type AdminUserStatusDto,
  type PageResponseDto,
} from '../../../types/api';
import { Badge } from '../../../ui/Badge';
import { Modal } from '../../../ui/Modal';
import { Pagination } from '../../../ui/Pagination';
import { Table } from '../../../ui/Table';

type Filters = {
  email: string;
  nickname: string;
  role: string;
  status: string;
};

type AdminUsersClientProps = {
  data?: PageResponseDto<AdminUserListItemDto>;
  loadError?: string;
  filters: Filters;
  currentUserId: number;
  onMutated?: () => void;
};

// enum 값에 맞춰 타입을 좁혀둔다 - Record<string, string>이면 AdminRoleDto/AdminUserStatusDto에
// 값이 추가돼도 컴파일러가 이 매핑에 라벨 추가를 빠뜨린 걸 잡아주지 못한다.
const ROLE_LABEL: Record<AdminRoleDto, string> = { USER: '일반', ADMIN: '관리자' };
const STATUS_LABEL: Record<AdminUserStatusDto, string> = { ACTIVE: '활성', SUSPENDED: '정지', WITHDRAWN: '탈퇴' };
const STATUS_TONE: Record<AdminUserStatusDto, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700',
  SUSPENDED: 'bg-red-50 text-red-700',
  WITHDRAWN: 'bg-slate-100 text-slate-500',
};

type ActiveAction = { type: 'role'; user: AdminUserListItemDto } | { type: 'status'; user: AdminUserListItemDto };
type BulkAction = { status: 'ACTIVE' | 'SUSPENDED' };

// 탈퇴 유저와 본인 계정은 단건 액션 버튼도 이미 숨기고 있다(actions 컬럼 render 참고) - 같은 이유로
// 일괄처리 체크박스 대상에서도 제외한다.
function isUserBulkSelectable(row: AdminUserListItemDto, currentUserId: number): boolean {
  return row.status !== 'WITHDRAWN' && row.id !== currentUserId;
}

export function AdminUsersClient({ data, loadError, filters, currentUserId, onMutated }: AdminUsersClientProps) {
  const router = useRouter();
  const [email, setEmail] = useState(filters.email);
  const [nickname, setNickname] = useState(filters.nickname);
  const [role, setRole] = useState(filters.role);
  const [status, setStatus] = useState(filters.status);
  const [action, setAction] = useState<ActiveAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | undefined>();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);
  const [bulkError, setBulkError] = useState<string | undefined>();
  const [bulkResult, setBulkResult] = useState<AdminBulkActionResponseDto | null>(null);

  // 검색창 로컬 state는 useState(filters.x)로 최초 1회만 seed되므로, 브라우저 뒤로/앞으로가기로
  // filters props만 바뀌는 경우(page.tsx가 searchParams를 다시 읽어 내려줌)에는 반영되지 않아
  // 테이블은 새 필터 결과를 보여주는데 검색창은 이전 값을 계속 보여주는 것처럼 어긋난다.
  // filters가 바뀔 때마다 로컬 state를 다시 맞춰준다.
  useEffect(() => {
    // filters가 바뀌어 이 effect가 재실행될 때만 의미 있는 재설정이다(최초 실행 시 초기값과 동일).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(filters.email);
    setNickname(filters.nickname);
    setRole(filters.role);
    setStatus(filters.status);
  }, [filters.email, filters.nickname, filters.role, filters.status]);

  // data가 바뀔 때(페이지 이동/검색/일괄처리 후 재조회)마다 선택 상태를 비운다 - 이전 페이지에서
  // 선택했던 id가 새 목록에 없는 채로 남아있으면 "선택 N명"이 실제 화면과 어긋나 보인다.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedIds(new Set());
  }, [data]);

  function navigate(next: Partial<Filters & { page: number }>) {
    const merged = { email, nickname, role, status, page: 0, ...next };
    const query = new URLSearchParams();
    if (merged.email) query.set('email', merged.email);
    if (merged.nickname) query.set('nickname', merged.nickname);
    if (merged.role) query.set('role', merged.role);
    if (merged.status) query.set('status', merged.status);
    if (merged.page) query.set('page', String(merged.page));
    const queryString = query.toString();
    router.push(`/admin/users${queryString ? `?${queryString}` : ''}`);
  }

  function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    navigate({ email, nickname, role, status });
  }

  // 페이지네이션 클릭은 검색창의 로컬 state(email/nickname/role/status)가 아니라 filters
  // prop(마지막으로 실제 적용된, URL에 반영된 값)을 기준으로 이동해야 한다 - 로컬 state로
  // 병합하면, 검색창에 새 값을 입력만 하고 "검색"을 아직 안 눌렀는데 페이지 화살표를 클릭하는
  // 순간 아직 제출하지 않은 검색어가 조용히 함께 적용돼버린다.
  function navigateToPage(page: number) {
    navigate({ ...filters, page });
  }

  async function confirmAction() {
    if (!action) return;
    setSubmitting(true);
    setActionError(undefined);
    try {
      if (action.type === 'role') {
        const nextRole = action.user.role === 'ADMIN' ? 'USER' : 'ADMIN';
        await updateAdminUserRole(action.user.id, { role: nextRole });
      } else {
        const nextStatus = action.user.status === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
        await updateAdminUserStatus(action.user.id, { status: nextStatus });
      }
      setAction(null);
      // router.refresh()는 이 화면이 전부 client component로 바뀌면서 다시 가져올 Server
      // Component 데이터가 없어 실질적으로 no-op이다 - 부모(page.tsx)가 내려준 재조회 콜백을
      // 직접 호출해야 목록에 변경 결과가 반영된다.
      onMutated?.();
    } catch (error) {
      setActionError(resolveErrorMessage(error, '처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
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

  function toggleSelectAll(selectableRows: AdminUserListItemDto[]) {
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
  }

  async function confirmBulkAction() {
    if (!bulkAction) return;
    setBulkSubmitting(true);
    setBulkError(undefined);
    try {
      const result = await bulkUpdateAdminUserStatus({ userIds: Array.from(selectedIds), status: bulkAction.status });
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
      <h1 className="ansim-page-title mb-6">유저 관리</h1>

      <form onSubmit={handleSearchSubmit} className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="ansim-search-icon" />
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="이메일 검색"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
          />
        </div>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          placeholder="닉네임 검색"
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
        />
        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        >
          <option value="">전체 권한</option>
          <option value="USER">일반</option>
          <option value="ADMIN">관리자</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
        >
          <option value="">전체 상태</option>
          <option value="ACTIVE">활성</option>
          <option value="SUSPENDED">정지</option>
          <option value="WITHDRAWN">탈퇴</option>
        </select>
        <button type="submit" className="ansim-button-primary px-5 py-2.5 text-sm">
          검색
        </button>
      </form>

      {loadError && (
        <div className="ansim-card mb-4 border-red-100 bg-red-50 p-6 text-sm text-red-700">{loadError}</div>
      )}

      {selectedIds.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-teal-100 bg-teal-50 px-4 py-3">
          <span className="text-sm font-bold text-teal-700">{selectedIds.size}명 선택됨</span>
          <div className="flex gap-2">
            <button
              onClick={() => setBulkAction({ status: 'SUSPENDED' })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              선택 정지
            </button>
            <button
              onClick={() => setBulkAction({ status: 'ACTIVE' })}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              선택 정지 해제
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
              isRowSelectable: (row) => isUserBulkSelectable(row, currentUserId),
            }}
            columns={[
              { key: 'id', header: 'ID', render: (row) => row.id },
              { key: 'email', header: '이메일', render: (row) => row.email ?? '-' },
              { key: 'nickname', header: '닉네임', render: (row) => row.nickname },
              {
                key: 'role',
                header: '권한',
                render: (row) => (
                  <Badge className={row.role === 'ADMIN' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}>
                    {ROLE_LABEL[row.role]}
                  </Badge>
                ),
              },
              {
                key: 'status',
                header: '상태',
                render: (row) => <Badge className={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
              },
              {
                key: 'createdAt',
                header: '가입일',
                render: (row) => new Date(row.createdAt).toLocaleDateString('ko-KR'),
              },
              {
                key: 'actions',
                header: '',
                render: (row) => {
                  if (row.status === 'WITHDRAWN') return null;
                  // 자기 자신의 권한/상태는 백엔드가 항상 거부한다(스스로 잠기는 사고 방지) — 실패할
                  // 액션을 보여주지 않고 여기서 숨긴다.
                  if (row.id === currentUserId) {
                    return <span className="text-xs text-slate-400">본인 계정</span>;
                  }
                  return (
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setActionError(undefined);
                          setAction({ type: 'role', user: row });
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        {row.role === 'ADMIN' ? '관리자 해제' : '관리자 지정'}
                      </button>
                      <button
                        onClick={() => {
                          setActionError(undefined);
                          setAction({ type: 'status', user: row });
                        }}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                      >
                        {row.status === 'SUSPENDED' ? '정지 해제' : '정지'}
                      </button>
                    </div>
                  );
                },
              },
            ]}
            rows={data.content}
            rowKey={(row) => row.id}
            emptyMessage="조건에 맞는 유저가 없습니다."
          />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={navigateToPage} />
        </>
      )}

      <Modal open={action !== null} onClose={() => (submitting ? undefined : setAction(null))}>
        {action && (
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-950">
              {action.type === 'role'
                ? action.user.role === 'ADMIN'
                  ? '관리자 권한을 해제할까요?'
                  : '관리자로 지정할까요?'
                : action.user.status === 'SUSPENDED'
                  ? '정지를 해제할까요?'
                  : '이 유저를 정지할까요?'}
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {action.user.nickname} ({action.user.email ?? '이메일 없음'})
            </p>
            {actionError && <p className="mb-3 text-sm text-red-600">{actionError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setAction(null)}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
              >
                취소
              </button>
              <button
                onClick={confirmAction}
                disabled={submitting}
                className="ansim-button-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={bulkAction !== null || bulkResult !== null} onClose={() => (bulkSubmitting ? undefined : closeBulkModal())}>
        {bulkResult ? (
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-950">일괄 처리 결과</h2>
            <p className="mb-3 text-sm text-slate-700">
              성공 {bulkResult.succeededIds.length}명
              {bulkResult.failures.length > 0 ? `, 실패 ${bulkResult.failures.length}명` : ''}
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
                선택한 {selectedIds.size}명을 {bulkAction.status === 'SUSPENDED' ? '정지' : '정지 해제'}할까요?
              </h2>
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
