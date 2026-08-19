'use client';

import { useEffect, useState } from 'react';
import { resolveErrorMessage } from '../../../lib/resolveErrorMessage';
import { propertyTypeLabelMap } from '../../../mappers/property';
import { getAdminChecklistTemplateImages } from '../../../services/admin';
import {
  addAdminChecklistTemplateImage,
  createAdminChecklistItemTemplate,
  deleteAdminChecklistItemTemplate,
  deleteAdminChecklistTemplateImage,
  updateAdminChecklistItemTemplate,
} from '../../../services/adminActions';
import {
  type AdminChecklistItemTemplateCreateRequestDto,
  type AdminChecklistItemTemplateDto,
  type AdminChecklistItemTemplateImageDto,
  type ChecklistCategoryDto,
  type ChecklistImportanceDto,
  type ChecklistItemCodeDto,
  type ChecklistItemTypeDto,
  type PropertyTypeDto,
} from '../../../types/api';

// DB 컬럼 길이 제약(ChecklistItemTemplate 엔티티)과 맞춰둔다 - 프론트에서 안 막으면 그 길이를
// 넘겼을 때 저장 시점에야 원인 불명의 500(데이터 잘림 오류)로 실패한다. helperText는 TEXT
// 컬럼이라 실질적인 길이 제약이 없어 여기 포함하지 않는다.
const CONTENT_MAX_LENGTH = 200;
const GUIDE_TEXT_MAX_LENGTH = 255;
const OPTIONS_MAX_LENGTH = 255;
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
  MULTIPLE_CHOICE: '선택지 응답',
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

// 백엔드 AdminChecklistTemplateService.REQUIRED_ITEM_TYPE_BY_CODE와 동일한 6개 code 전부를
// 그대로 미러링한다 - 여기 없는 code/itemType 조합으로 저장을 시도하면 백엔드 validateCode()가
// ADMIN_CHECKLIST_TEMPLATE_INVALID_CODE로 무조건 거부하므로, 프론트에서 먼저 막지 않으면
// 저장 버튼을 누른 뒤에야 서버 에러로 드러난다. 강제하는 이유는 code마다 다르다 -
// TRUST_REGISTRATION/OWNERSHIP_MATCH/DATE_OF_CONFIRMATION_REQUEST/RESIDENT_REGISTRATION_REQUEST는
// ChecklistItem.answer()의 자동 주의(issueFound) 판정이 그 itemType의 answer 분기에서만 동작하고,
// OWNERSHIP_ACQUISITION_DATE/TAX_DELINQUENCY_NOTICE는 자동 판정과는 무관하지만(각각
// risk-analysis 연계용 보조 신호, 안내 문구 전용) 백엔드가 어차피 고정된 itemType을 요구한다
// (ChecklistItemCode 자바독 참고) - 두 경우 모두 백엔드는 예외 없이 동일하게 거부한다.
const CODE_REQUIRED_ITEM_TYPES: Partial<Record<ChecklistItemCodeDto, ChecklistItemTypeDto[]>> = {
  TRUST_REGISTRATION: ['YES_NO'],
  OWNERSHIP_MATCH: ['YES_NO'],
  OWNERSHIP_ACQUISITION_DATE: ['DATE'],
  TAX_DELINQUENCY_NOTICE: ['CHECK'],
  DATE_OF_CONFIRMATION_REQUEST: ['DOCUMENT_REQUEST'],
  RESIDENT_REGISTRATION_REQUEST: ['DOCUMENT_REQUEST'],
};

type FormState = {
  category: ChecklistCategoryDto;
  content: string;
  guideText: string;
  helperText: string;
  importance: ChecklistImportanceDto;
  itemType: ChecklistItemTypeDto;
  // MULTIPLE_CHOICE일 때만 쓰는 콤마 구분 자유 텍스트("가스보일러,기름보일러,전기보일러,지역난방") -
  // Backend도 enum이 아니라 자유 텍스트 컬럼이라 그대로 통과시킨다.
  options: string;
  code: ChecklistItemCodeDto | typeof NONE_CODE;
  displayOrder: string;
  // 백엔드는 콤마로 구분된 문자열(예: "OFFICETEL,MULTI_FAMILY")로 받지만, 폼에서는 실제
  // PropertyTypeDto 값만 고를 수 있는 체크박스로 관리한다 - 자유 텍스트로 두면 오타/존재하지
  // 않는 값이 그대로 저장돼도 저장 시점엔 아무 에러도 안 나고, 이후 매물유형 필터링에서
  // 조용히 항상 안 맞는 문항이 돼버린다.
  applicablePropertyTypes: PropertyTypeDto[];
  // 백엔드는 이 필드에 대해 enum 검증을 하지 않으므로(자유 텍스트 컬럼), 레거시 데이터나 DB
  // 직접 수정 등으로 프론트가 모르는 값이 들어있을 수 있다. 체크박스에는 못 보여주지만, 그냥
  // 무시하면 저장 시 조용히 사라지므로 값을 보존해뒀다가 저장할 때 다시 합친다.
  unknownPropertyTypeTokens: string[];
  active: boolean;
};

const EMPTY_FORM: FormState = {
  category: 'INDOOR',
  content: '',
  guideText: '',
  helperText: '',
  importance: 'GENERAL',
  itemType: 'CHECK',
  options: '',
  code: NONE_CODE,
  displayOrder: '1',
  applicablePropertyTypes: [],
  unknownPropertyTypeTokens: [],
  active: true,
};

function splitApplicablePropertyTypes(value: string | null): { known: PropertyTypeDto[]; unknown: string[] } {
  if (!value) return { known: [], unknown: [] };
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  return {
    known: tokens.filter((token): token is PropertyTypeDto => token in propertyTypeLabelMap),
    unknown: tokens.filter((token) => !(token in propertyTypeLabelMap)),
  };
}

function toFormState(template: AdminChecklistItemTemplateDto): FormState {
  const { known, unknown } = splitApplicablePropertyTypes(template.applicablePropertyTypes);
  return {
    category: template.category,
    content: template.content,
    guideText: template.guideText ?? '',
    helperText: template.helperText ?? '',
    importance: template.importance,
    itemType: template.itemType,
    options: template.options ?? '',
    code: template.code ?? NONE_CODE,
    displayOrder: String(template.displayOrder),
    applicablePropertyTypes: known,
    unknownPropertyTypeTokens: unknown,
    active: template.active,
  };
}

function toCreateRequest(form: FormState): AdminChecklistItemTemplateCreateRequestDto {
  const allPropertyTypes = [...form.applicablePropertyTypes, ...form.unknownPropertyTypeTokens];
  return {
    category: form.category,
    content: form.content.trim().slice(0, CONTENT_MAX_LENGTH),
    guideText: form.guideText.trim().slice(0, GUIDE_TEXT_MAX_LENGTH) || undefined,
    helperText: form.helperText.trim() || undefined,
    importance: form.importance,
    itemType: form.itemType,
    options:
      form.itemType === 'MULTIPLE_CHOICE' ? form.options.trim().slice(0, OPTIONS_MAX_LENGTH) || undefined : undefined,
    code: form.code || undefined,
    displayOrder: Number(form.displayOrder),
    applicablePropertyTypes: allPropertyTypes.length > 0 ? allPropertyTypes.join(',') : undefined,
  };
}

type ModalState =
  | { type: 'create'; form: FormState }
  | { type: 'edit'; template: AdminChecklistItemTemplateDto; form: FormState }
  | { type: 'delete'; template: AdminChecklistItemTemplateDto }
  | null;

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
    if (form.code) {
      const requiredItemTypes = CODE_REQUIRED_ITEM_TYPES[form.code];
      if (requiredItemTypes && !requiredItemTypes.includes(form.itemType)) {
        setFormError(
          `"${CODE_LABEL[form.code]}" 코드는 응답 방식이 ${requiredItemTypes.map((type) => ITEM_TYPE_LABEL[type]).join('/')}일 때만 사용할 수 있습니다. 응답 방식을 바꾸거나 코드를 "없음"으로 선택해주세요.`,
        );
        return;
      }
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

  // 이미지는 문항 생성 직후(templateId 없음)엔 관리할 수 없어 수정 모달에서만 다룬다.
  const editingTemplateId = modal?.type === 'edit' ? modal.template.id : null;
  const [images, setImages] = useState<AdminChecklistItemTemplateImageDto[]>([]);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [imagesError, setImagesError] = useState<string | undefined>();
  const [newImageUrl, setNewImageUrl] = useState('');
  const [imageActionPending, setImageActionPending] = useState(false);

  useEffect(() => {
    if (editingTemplateId === null) {
      // 모달이 닫히거나 생성/삭제 모달로 바뀌어 editingTemplateId가 null이 될 때만 의미 있는
      // 재설정이다(최초 렌더 시 초기값과 동일) - 다른 문항의 수정 모달을 다시 열었을 때 이전
      // 문항의 이미지 목록/입력값이 잠깐이라도 보이지 않도록 의도적으로 동기 호출한다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImages([]);
      setImagesError(undefined);
      setNewImageUrl('');
      return;
    }
    let cancelled = false;
    setImagesLoading(true);
    getAdminChecklistTemplateImages(editingTemplateId)
      .then((result) => {
        if (!cancelled) setImages(result);
      })
      .catch((error) => {
        if (!cancelled) setImagesError(resolveErrorMessage(error, '예시 이미지를 불러오지 못했습니다.'));
      })
      .finally(() => {
        if (!cancelled) setImagesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editingTemplateId]);

  async function handleAddImage() {
    if (editingTemplateId === null || !newImageUrl.trim()) return;
    setImageActionPending(true);
    setImagesError(undefined);
    try {
      const created = await addAdminChecklistTemplateImage(editingTemplateId, { imageUrl: newImageUrl.trim() });
      setImages((current) => [...current, created]);
      setNewImageUrl('');
    } catch (error) {
      setImagesError(resolveErrorMessage(error, '이미지 추가에 실패했습니다.'));
    } finally {
      setImageActionPending(false);
    }
  }

  async function handleDeleteImage(imageId: number) {
    if (editingTemplateId === null) return;
    setImageActionPending(true);
    setImagesError(undefined);
    try {
      await deleteAdminChecklistTemplateImage(editingTemplateId, imageId);
      setImages((current) => current.filter((image) => image.id !== imageId));
    } catch (error) {
      setImagesError(resolveErrorMessage(error, '이미지 삭제에 실패했습니다.'));
    } finally {
      setImageActionPending(false);
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
        여기서 수정·삭제해도 이미 만들어진 유저 체크리스트에는 영향이 없어요. 다음에 새로 생성되는 체크리스트부터
        반영됩니다.
      </p>

      {loadError && (
        <div className="ansim-card mb-4 border-red-100 bg-red-50 p-6 text-sm text-red-700">{loadError}</div>
      )}

      {data && (
        <Table
          columns={[
            { key: 'category', header: '카테고리', render: (row) => CATEGORY_LABEL[row.category] },
            { key: 'content', header: '문항 내용', render: (row) => row.content, className: 'max-w-sm' },
            {
              key: 'importance',
              header: '중요도',
              render: (row) => (
                <Badge
                  className={row.importance === 'REQUIRED' ? 'bg-teal-50 text-teal-700' : 'bg-slate-100 text-slate-600'}
                >
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
                문항 내용 ({modal.form.content.length}/{CONTENT_MAX_LENGTH}자)
                <input
                  value={modal.form.content}
                  onChange={(event) => updateForm({ content: event.target.value })}
                  placeholder="예: 창문 잠금장치가 정상 작동하나요?"
                  maxLength={CONTENT_MAX_LENGTH}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                />
              </label>

              <label className="block text-xs font-bold text-slate-600">
                안내 문구 (선택 - 실무 안내, 짧게, {modal.form.guideText.length}/{GUIDE_TEXT_MAX_LENGTH}자)
                <textarea
                  value={modal.form.guideText}
                  onChange={(event) => updateForm({ guideText: event.target.value })}
                  rows={2}
                  maxLength={GUIDE_TEXT_MAX_LENGTH}
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

              {modal.form.itemType === 'MULTIPLE_CHOICE' && (
                <label className="block text-xs font-bold text-slate-600">
                  선택지 (콤마로 구분, 예: 가스보일러,기름보일러,전기보일러,지역난방)
                  <input
                    type="text"
                    value={modal.form.options}
                    onChange={(event) => updateForm({ options: event.target.value })}
                    maxLength={OPTIONS_MAX_LENGTH}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                  />
                </label>
              )}

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

              <div className="text-xs font-bold text-slate-600">
                적용 매물유형 (선택 안 하면 전체 매물유형에 적용)
                <div className="mt-1 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  {Object.entries(propertyTypeLabelMap).map(([value, label]) => {
                    const propertyType = value as PropertyTypeDto;
                    const checked = modal.form.applicablePropertyTypes.includes(propertyType);
                    return (
                      <label key={value} className="flex items-center gap-1.5 font-normal text-slate-700">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            updateForm({
                              applicablePropertyTypes: event.target.checked
                                ? [...modal.form.applicablePropertyTypes, propertyType]
                                : modal.form.applicablePropertyTypes.filter((t) => t !== propertyType),
                            })
                          }
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
                {modal.form.unknownPropertyTypeTokens.length > 0 && (
                  <p className="mt-1.5 text-xs text-amber-600">
                    알 수 없는 매물유형 값이 있어 그대로 유지됩니다: {modal.form.unknownPropertyTypeTokens.join(', ')}
                  </p>
                )}
              </div>

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

              {modal.type === 'edit' && (
                <div className="border-t border-slate-200 pt-3">
                  <p className="mb-2 text-xs font-bold text-slate-600">
                    예시 이미지 (선택 - 이미 S3 등에 업로드된 이미지의 URL만 등록, 파일 업로드는 지원 안 함)
                  </p>
                  {imagesLoading && <p className="text-xs text-slate-400">불러오는 중...</p>}
                  {!imagesLoading && images.length === 0 && (
                    <p className="text-xs text-slate-400">등록된 예시 이미지가 없습니다.</p>
                  )}
                  {images.length > 0 && (
                    <ul className="mb-2 space-y-2">
                      {images.map((image) => (
                        <li key={image.id} className="flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element -- 관리자가 임의 URL을
                          입력해 next.config.js 허용 호스트 목록에 없을 수 있어 next/image로 최적화 불가 */}
                          <img
                            src={image.imageUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                          />
                          <span className="flex-1 truncate text-xs text-slate-500">{image.imageUrl}</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteImage(image.id)}
                            disabled={imageActionPending}
                            className="shrink-0 rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newImageUrl}
                      onChange={(event) => setNewImageUrl(event.target.value)}
                      placeholder="이미지 URL 붙여넣기"
                      disabled={imageActionPending}
                      className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleAddImage}
                      disabled={imageActionPending || !newImageUrl.trim()}
                      className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      추가
                    </button>
                  </div>
                  {imagesError && <p className="mt-1.5 text-xs text-red-600">{imagesError}</p>}
                </div>
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
