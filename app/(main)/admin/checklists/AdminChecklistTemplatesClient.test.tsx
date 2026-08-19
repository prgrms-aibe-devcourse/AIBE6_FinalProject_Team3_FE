import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type AdminChecklistItemTemplateDto } from '../../../types/api';
import { AdminChecklistTemplatesClient } from './AdminChecklistTemplatesClient';

const createAdminChecklistItemTemplate = vi.fn();
const updateAdminChecklistItemTemplate = vi.fn();
const deleteAdminChecklistItemTemplate = vi.fn();
const addAdminChecklistTemplateImage = vi.fn();
const deleteAdminChecklistTemplateImage = vi.fn();
vi.mock('../../../services/adminActions', () => ({
  createAdminChecklistItemTemplate: (...args: unknown[]) => createAdminChecklistItemTemplate(...args),
  updateAdminChecklistItemTemplate: (...args: unknown[]) => updateAdminChecklistItemTemplate(...args),
  deleteAdminChecklistItemTemplate: (...args: unknown[]) => deleteAdminChecklistItemTemplate(...args),
  addAdminChecklistTemplateImage: (...args: unknown[]) => addAdminChecklistTemplateImage(...args),
  deleteAdminChecklistTemplateImage: (...args: unknown[]) => deleteAdminChecklistTemplateImage(...args),
}));

const getAdminChecklistTemplateImages = vi.fn();
vi.mock('../../../services/admin', () => ({
  getAdminChecklistTemplateImages: (...args: unknown[]) => getAdminChecklistTemplateImages(...args),
}));

function template(overrides: Partial<AdminChecklistItemTemplateDto> = {}): AdminChecklistItemTemplateDto {
  return {
    id: 1,
    version: 1,
    code: null,
    category: 'INDOOR',
    content: '창문 잠금장치가 정상 작동하나요?',
    guideText: null,
    helperText: null,
    importance: 'GENERAL',
    itemType: 'CHECK',
    options: null,
    displayOrder: 1,
    active: true,
    applicablePropertyTypes: null,
    ...overrides,
  };
}

describe('AdminChecklistTemplatesClient', () => {
  // 회귀 테스트 - TRUST_REGISTRATION/OWNERSHIP_MATCH 자동 판정 코드는 백엔드 ChecklistItem.answerYesNo()
  // 에서만 확인되므로, 응답 방식을 YES_NO가 아닌 값으로 두고 저장하면 자동 주의 판정이 조용히
  // 죽는다(경고 없이 저장 자체는 성공했었다). 이제는 저장 시점에 막혀야 한다.
  it('자동 판정 코드와 맞지 않는 응답 방식으로 저장하면 에러를 보여주고 저장하지 않는다', async () => {
    getAdminChecklistTemplateImages.mockResolvedValue([]);
    render(<AdminChecklistTemplatesClient data={[template()]} onMutated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '문항 추가' }));

    fireEvent.change(screen.getByLabelText(/문항 내용/), { target: { value: '신탁등기가 되어있나요?' } });
    // 응답 방식은 기본값 CHECK로 둔 채 자동 판정 코드만 TRUST_REGISTRATION으로 선택한다.
    fireEvent.change(screen.getByLabelText(/자동 판정 코드/), { target: { value: 'TRUST_REGISTRATION' } });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText(/사용할 수 있습니다/)).toBeInTheDocument();
    expect(createAdminChecklistItemTemplate).not.toHaveBeenCalled();
  });

  // 회귀 테스트 - OWNERSHIP_ACQUISITION_DATE/TAX_DELINQUENCY_NOTICE는 자동 주의 판정과는
  // 무관하지만(ChecklistItemCode 자바독 참고), 백엔드 validateCode()는 이 둘도 다른 4개 코드와
  // 동일하게 고정된 itemType을 요구해 어긋나면 무조건 거부한다. 프론트가 이 두 코드를
  // CODE_REQUIRED_ITEM_TYPES에서 빠뜨렸을 때는 저장 버튼을 누른 뒤 서버 에러로만 드러났다.
  it('OWNERSHIP_ACQUISITION_DATE 코드와 맞지 않는 응답 방식으로 저장하면 에러를 보여주고 저장하지 않는다', async () => {
    getAdminChecklistTemplateImages.mockResolvedValue([]);
    render(<AdminChecklistTemplatesClient data={[template()]} onMutated={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '문항 추가' }));

    fireEvent.change(screen.getByLabelText(/문항 내용/), { target: { value: '소유권 취득일이 언제인가요?' } });
    // 응답 방식은 기본값 CHECK로 둔 채(요구되는 DATE가 아님) 코드만 OWNERSHIP_ACQUISITION_DATE로 선택한다.
    fireEvent.change(screen.getByLabelText(/자동 판정 코드/), { target: { value: 'OWNERSHIP_ACQUISITION_DATE' } });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText(/사용할 수 있습니다/)).toBeInTheDocument();
    expect(createAdminChecklistItemTemplate).not.toHaveBeenCalled();
  });

  it('자동 판정 코드와 응답 방식이 맞으면 정상 저장된다', async () => {
    getAdminChecklistTemplateImages.mockResolvedValue([]);
    createAdminChecklistItemTemplate.mockResolvedValue(template());
    const onMutated = vi.fn();
    render(<AdminChecklistTemplatesClient data={[template()]} onMutated={onMutated} />);

    fireEvent.click(screen.getByRole('button', { name: '문항 추가' }));
    fireEvent.change(screen.getByLabelText(/문항 내용/), { target: { value: '신탁등기가 되어있나요?' } });
    fireEvent.change(screen.getByLabelText(/응답 방식/), { target: { value: 'YES_NO' } });
    fireEvent.change(screen.getByLabelText(/자동 판정 코드/), { target: { value: 'TRUST_REGISTRATION' } });

    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await screen.findByText('문항 추가'); // 모달이 닫히기 전 마지막 렌더가 안정될 때까지 대기
    expect(createAdminChecklistItemTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TRUST_REGISTRATION', itemType: 'YES_NO' }),
    );
  });
});
