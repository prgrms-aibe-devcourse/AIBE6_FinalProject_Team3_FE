'use client';

import { useState } from 'react';
import {
  createAdminChecklistItemTemplate,
  deleteAdminChecklistItemTemplate,
  updateAdminChecklistItemTemplate,
} from '../../../services/adminActions';
import {
  type AdminChecklistItemTemplateCreateRequestDto,
  type AdminChecklistItemTemplateDto,
  type ChecklistCategoryDto,
  type ChecklistImportanceDto,
  type ChecklistItemCodeDto,
  type ChecklistItemTypeDto,
} from '../../../types/api';
import { Badge } from '../../../ui/Badge';
import { Modal } from '../../../ui/Modal';
import { Table } from '../../../ui/Table';

type AdminChecklistTemplatesClientProps = {
  data?: AdminChecklistItemTemplateDto[];
  loadError?: string;
  onMutated: () => void;
};

const CATEGORY_LABEL: Record<ChecklistCategoryDto, string> = {
  INDOOR: '실내 상태',
  NOISE: '소음·환경',
  SAFETY: '보안·안전',
  DOCUMENTS: '서류·행정',
  AREA: '주변 환경',
};

const IMPORTANCE_LABEL: Record<ChecklistImportanceDto, string> = {
  REQUIRED: '필수',
  GENERAL: '일반',
};

const ITEM_TYPE_LABEL: Record<ChecklistItemTypeDto, string> = {
  CHECK: '단순 확인',
  YES_NO: 'Y/N 응답',
  DATE: '날짜 입력',
  DOCUMENT_REQUEST: '서류 요청',
};

// 백엔드 ChecklistItemCode 자바독 기준 설명 - 이 값이 있는 문항은 특정 응답값에서 자동으로
// "주의 항목(issueFound)"으로 표시된다(ChecklistItem.answer() 참고). 문구/순서만 고치려는
// 의도로 이 값을 건드리면 그 자동 판정이 조용히 끊길 수 있어 폼에 명시적으로 노출한다.
const NONE_CODE = '';
const CODE_LABEL: Record<ChecklistItemCodeDto, string> = {
  TRUST_REGISTRATION: '신탁등기 여부 (Y면 자동 주의)',
  OWNERSHIP_MATCH: '소유자-임대인 명의 불일치 여부 (Y면 자동 주의)',
  OWNERSHIP_ACQUISITION_DATE: '소유권 취득일',
  TAX_DELINQUENCY_NOTICE: '세금체납 확인 안내',
  DATE_OF_CONFIRMATION_REQUEST: '확정일자 부여현황 요청 (미제공 시 자동 주의)',
  RESIDENT_REGISTRATION_REQUEST: '전입세대열람원 요청 (미제공 시 자동 주의)',
};

type FormState = {
  category: ChecklistCategoryDto;
  content: string;
  guideText: string;
  helperText: string;
  importance: ChecklistImportanceDto;
  itemType: ChecklistItemTypeDto;
  code: ChecklistItemCodeDto | typeof NONE_CODE;
  displayOrder: string;
  applicablePropertyTypes: string;
  active: boolean;
};

const EMPTY_FORM: FormState = {
  category: 'INDOOR',
  content: '',
  guideText: '',
  helperText: '',
  importance: 'GENERAL',
  itemType: 'CHECK',
  code: NONE_CODE,
  displayOrder: '1',
  applicablePropertyTypes: '',
  active: true,
};

function toFormState(template: AdminChecklistItemTemplateDto): FormState {
  return {
    category: template.category,
    content: template.content,
    guideText: template.guideText ?? '',
    helperText: template.helperText ?? '',
    importance: template.importance,
    itemType: template.itemType,
    code: template.code ?? NONE_CODE,
    displayOrder: String(template.displayOrder),
    applicablePropertyTypes: template.applicablePropertyTypes ?? '',
    active: template.active,
  };
}

function toCreateRequest(form: FormState): AdminChecklistItemTemplateCreateRequestDto {
  return {
    category: form.category,
    content: form.content.trim(),
    guideText: form.guideText.trim() || undefined,
    helperText: form.helperText.trim() || undefined,
    importance: form.importance,
    itemType: form.itemType,
    code: form.code || undefined,
    displayOrder: Number(form.displayOrder),
    applicablePropertyTypes: form.applicablePropertyTypes.trim() || undefined,
  };
}

type ModalState =
  | { type: 'create'; form: FormState }
  | { type: 'edit'; template: AdminChecklistItemTemplateDto; form: FormState }
  | { type: 'delete'; template: AdminChecklistItemTemplateDto }
  | null;

// 백엔드가 INVALID_CODE/DUPLICATE_CODE/LAST_ITEM처럼 관리자가 바로 고칠 수 있는 400/409를 이미
// 사람이 읽을 문구로 내려주므로(ErrorCode 참고, requestJson의 ApiError.message), 그 메시지를
// 그대로 보여준다 - 뭉뚱그린 일반 문구로는 어떤 필드를 고쳐야 하는지 알 수 없다. mock 모드의
// postMockAdminAction도 plain Error로 메시지를 던지므로 ApiError로 좁히지 않고 Error 전체를 본다.
function resolveErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AdminChecklistTemplatesClient({ data, loadError, onMutated }: AdminChecklistTemplatesClientProps) {
  const [modal, setModal] = useState<ModalState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | undefined>();

  function closeModal() {
    if (submitting) return;
    setModal(null);
    setFormError(undefined);
  }

  function updateForm(patch: Partial<FormState>) {
    setModal((current) => {
      if (!current || current.type === 'delete') return current;
      return { ...current, form: { ...current.form, ...patch } };
    });
  }

  async function submitForm() {
    if (!modal || modal.type === 'delete') return;
    const { form } = modal;

    if (!form.content.trim()) {
      setFormError('문항 내용을 입력해주세요.');
      return;
    }
    const displayOrder = Number(form.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 1) {
      setFormError('노출 순서는 1 이상의 숫자여야 합니다.');
      return;
    }

    setSubmitting(true);
    setFormError(undefined);
    try {
      if (modal.type === 'create') {
        await createAdminChecklistItemTemplate(toCreateRequest(form));
      } else {
        await updateAdminChecklistItemTemplate(modal.template.id, { ...toCreateRequest(form), active: form.active });
      }
      setModal(null);
      onMutated();
    } catch (error) {
      setFormError(resolveErrorMessage(error, '저장 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!modal || modal.type !== 'delete') return;
    setSubmitting(true);
    setFormError(undefined);
    try {
      await deleteAdminChecklistItemTemplate(modal.template.id);
      setModal(null);
      onMutated();
    } catch (error) {
      setFormError(resolveErrorMessage(error, '삭제 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="ansim-page-title">체크리스트 관리</h1>
        <button
          onClick={() => setModal({ type: 'create', form: EMPTY_FORM })}
          className="ansim-button-primary px-4 py-2 text-sm"
        >
          문항 추가
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        여기서 수정·삭제해도 이미 만들어진 유저 체크리스트에는 영향이 없어요. 다음에 새로 생성되는 체크리스트부터 반영됩니다.
      </p>

      {loadError && <div className="ansim-card mb-4 border-red-100 bg-red-50 p-6 text-sm text-red-700">{loadError}</div>}

      {data && (
        <Table
          columns={[
            { key: 'category', header: '카테고리', render: (row) => CATEGORY_LABEL[row.category] },
            { key: 'content', header: '문항 내용', render: (row) => row.content, className: 'max-w-sm' },
            {
              key: 'importance',
              header: '중요도',
              render: (row) => (
                <Badge className={row.importance === 'REQUIRED' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}>
                  {IMPORTANCE_LABEL[row.importance]}
                </Badge>
              ),
            },
            { key: 'itemType', header: '응답 방식', render: (row) => ITEM_TYPE_LABEL[row.itemType] },
            { key: 'displayOrder', header: '순서', render: (row) => row.displayOrder },
            {
              key: 'active',
              header: '노출 상태',
              render: (row) => (
                <Badge className={row.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}>
                  {row.active ? '노출중' : '숨김'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              render: (row) => (
                <div className="flex gap-2">
                  <button
                    onClick={() => setModal({ type: 'edit', template: row, form: toFormState(row) })}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => setModal({ type: 'delete', template: row })}
                    className="rounded-lg border border-red-200 px-3 py-1 text-xs font-bold text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
              ),
            },
          ]}
          rows={data}
          rowKey={(row) => row.id}
          emptyMessage="등록된 체크리스트 문항이 없습니다."
        />
      )}

      <Modal open={modal !== null} onClose={closeModal}>
        {modal && modal.type === 'delete' && (
          <div>
            <h2 className="mb-2 text-lg font-bold text-slate-950">이 문항을 삭제할까요?</h2>
            <p className="mb-4 text-sm text-slate-500">{modal.template.content}</p>
            {formError && <p className="mb-3 text-sm text-red-600">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
              >
                취소
              </button>
              <button
                onClick={confirmDelete}
                disabled={submitting}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                삭제
              </button>
            </div>
          </div>
        )}

        {modal && modal.type !== 'delete' && (
          <div>
            <h2 className="mb-4 text-lg font-bold text-slate-950">
              {modal.type === 'create' ? '문항 추가' : '문항 수정'}
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-600">
                  카테고리
                  <select
                    value={modal.form.category}
                    onChange={(event) => updateForm({ category: event.target.value as ChecklistCategoryDto })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600">
                  중요도
                  <select
                    value={modal.form.importance}
                    onChange={(event) => updateForm({ importance: event.target.value as ChecklistImportanceDto })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    {Object.entries(IMPORTANCE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block text-xs font-bold text-slate-600">
                문항 내용
                <input
                  value={modal.form.content}
                  onChange={(event) => updateForm({ content: event.target.value })}
                  placeholder="예: 창문 잠금장치가 정상 작동하나요?"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-xs font-bold text-slate-600">
                안내 문구 (선택 - 실무 안내, 짧게)
                <textarea
                  value={modal.form.guideText}
                  onChange={(event) => updateForm({ guideText: event.target.value })}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-xs font-bold text-slate-600">
                쉬운 설명 (선택 - 부동산 지식이 없어도 이해할 수 있게 풀어쓴 설명, 사용자 화면에 노출됨)
                <textarea
                  value={modal.form.helperText}
                  onChange={(event) => updateForm({ helperText: event.target.value })}
                  rows={4}
                  className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-bold text-slate-600">
                  응답 방식
                  <select
                    value={modal.form.itemType}
                    onChange={(event) => updateForm({ itemType: event.target.value as ChecklistItemTypeDto })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  >
                    {Object.entries(ITEM_TYPE_LABEL).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-bold text-slate-600">
                  노출 순서
                  <input
                    type="number"
                    min={1}
                    value={modal.form.displayOrder}
                    onChange={(event) => updateForm({ displayOrder: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="block text-xs font-bold text-slate-600">
                자동 판정 코드 (선택 - 특수 문항이 아니면 비워두세요)
                <select
                  value={modal.form.code}
                  onChange={(event) => updateForm({ code: event.target.value as FormState['code'] })}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  <option value={NONE_CODE}>없음</option>
                  {Object.entries(CODE_LABEL).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-xs font-bold text-slate-600">
                적용 매물유형 (선택, 콤마로 구분 - 예: OFFICETEL,MULTI_FAMILY / 비우면 전체 적용)
                <input
                  value={modal.form.applicablePropertyTypes}
                  onChange={(event) => updateForm({ applicablePropertyTypes: event.target.value })}
                  placeholder="비우면 전체 매물유형에 적용"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                />
              </label>

              {modal.type === 'edit' && (
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={modal.form.active}
                    onChange={(event) => updateForm({ active: event.target.checked })}
                  />
                  새 체크리스트 생성 시 이 문항 노출
                </label>
              )}
            </div>

            {formError && <p className="mt-3 text-sm text-red-600">{formError}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={closeModal}
                disabled={submitting}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
              >
                취소
              </button>
              <button
                onClick={submitForm}
                disabled={submitting}
                className="ansim-button-primary px-4 py-2 text-sm disabled:opacity-50"
              >
                저장
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
