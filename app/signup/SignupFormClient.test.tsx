import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../lib/api/http';
import { SignupFormClient } from './SignupFormClient';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const requestEmailVerification = vi.fn();
const confirmEmailVerification = vi.fn();
const signup = vi.fn();
vi.mock('../services/auth', () => ({
  requestEmailVerification: (...args: unknown[]) => requestEmailVerification(...args),
  confirmEmailVerification: (...args: unknown[]) => confirmEmailVerification(...args),
  signup: (...args: unknown[]) => signup(...args),
}));

vi.mock('../services/user', () => ({
  checkNicknameAvailability: vi.fn(),
}));

const passwordPolicy = { pattern: '.{8,72}', message: '영문, 숫자 포함 8~72자' };
const nicknamePolicy = { pattern: '.{2,20}', message: '2~20자' };

describe('SignupFormClient', () => {
  // 회귀 테스트 - 인증번호를 요청한 뒤(status 'sent') 확인하기 전에 이메일을 수정하면, 기존에는
  // "확인" 버튼이 새로 바뀐 이메일 값으로 confirmEmailVerification을 호출해 발급된 적 없는
  // 코드로 검증을 시도했다(항상 실패). 지금은 이메일이 바뀌면 인증 진행 상태 자체가 리셋되어
  // "확인" UI가 사라지고 재발송부터 다시 해야 한다.
  it('인증번호 발송 후 확인 전에 이메일을 바꾸면 인증 진행 상태가 리셋된다', async () => {
    requestEmailVerification.mockResolvedValue(undefined);

    render(<SignupFormClient passwordPolicy={passwordPolicy} nicknamePolicy={nicknamePolicy} />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 발송' }));

    await screen.findByPlaceholderText('6자리 인증번호');
    expect(requestEmailVerification).toHaveBeenCalledWith('a@x.com');

    fireEvent.change(emailInput, { target: { value: 'b@x.com' } });

    // 인증 진행 UI(코드 입력창/확인 버튼)가 사라지고 재발송 가능한 초기 상태로 돌아가야 한다.
    expect(screen.queryByPlaceholderText('6자리 인증번호')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인증번호 발송' })).not.toBeDisabled();
  });

  it('인증번호 발송 후 같은 이메일로 확인하면 정상적으로 confirmEmailVerification이 호출된다', async () => {
    requestEmailVerification.mockResolvedValue(undefined);
    confirmEmailVerification.mockResolvedValue(undefined);

    render(<SignupFormClient passwordPolicy={passwordPolicy} nicknamePolicy={nicknamePolicy} />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 발송' }));

    const codeInput = await screen.findByPlaceholderText('6자리 인증번호');
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '확인' }));

    await screen.findByText('이메일 인증이 완료되었습니다.');
    expect(confirmEmailVerification).toHaveBeenCalledWith('a@x.com', '123456');
  });

  // 회귀 테스트 - 쿨다운 effect의 의존성 배열에 resendCooldown 값 자체가 있으면, 매초 값이 줄어들
  // 때마다 effect가 재실행되어 setInterval을 60초 카운트다운 동안 60번 새로 만들고 지웠다. 지금은
  // 카운트다운이 시작될 때 한 번만 interval을 만들어야 한다.
  it('재발송 쿨다운 카운트다운 동안 setInterval을 한 번만 생성한다', async () => {
    // interval 자체를 처음부터 fake 타이머로 만들어야 한다 - 실제 타이머로 만든 뒤에 fake로
    // 전환하면 그 interval은 계속 실제 시간에 따라 동작해 이후 advanceTimersByTime이 전혀 영향을
    // 못 주고(콜백이 안 불려 재렌더 자체가 안 일어나), 이 테스트가 버그가 있어도 항상 통과해버린다.
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    requestEmailVerification.mockResolvedValue(undefined);

    render(<SignupFormClient passwordPolicy={passwordPolicy} nicknamePolicy={nicknamePolicy} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 발송' }));
    // requestEmailVerification()의 mock Promise가 resolve된 뒤 setResendCooldown이 반영되도록
    // 마이크로태스크 큐를 비운다(Promise는 fake 타이머의 영향을 받지 않는다) - act()로 감싸야
    // 그 상태 갱신에 따른 effect(첫 interval 생성)까지 동기적으로 반영된다.
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterStart = setIntervalSpy.mock.calls.length;
    expect(callsAfterStart).toBeGreaterThan(0);

    // 60초 카운트다운 내내 매초 tick을 진행시킨다 - interval이 재생성되고 있었다면 그때마다
    // setInterval 호출 수가 계속 늘어난다. act()로 감싸야 매 tick의 setResendCooldown 상태
    // 갱신이 실제로 리렌더/effect 재실행까지 반영된다.
    for (let i = 0; i < 60; i += 1) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(setIntervalSpy.mock.calls.length).toBe(callsAfterStart);

    setIntervalSpy.mockRestore();
    vi.useRealTimers();
  });

  // 회귀 테스트 - 백엔드는 메일 발송 실패(EMAIL_SEND_FAILED) 시 쿨다운을 해제한다
  // (EmailVerificationService.requestCode()의 releaseCooldownBestEffort 참고, 발송 실패는
  // 사용자 잘못이 아니므로 즉시 재시도를 허용한다) - 프론트가 이 코드에도 여전히 60초 클라이언트
  // 쿨다운을 걸면, 서버는 재시도를 허용하는데 버튼만 막는 모순이 생긴다. AUTH_EMAIL_VERIFICATION_
  // TOO_MANY_REQUESTS(진짜 쿨다운)일 때만 클라이언트 쿨다운을 시작해야 한다.
  it('메일 발송 실패(EMAIL_SEND_FAILED)에는 클라이언트 쿨다운을 걸지 않는다', async () => {
    requestEmailVerification.mockRejectedValue(
      new ApiError('메일 발송 실패', 502, { code: 'EMAIL_SEND_FAILED', message: '메일 발송 실패' }),
    );

    render(<SignupFormClient passwordPolicy={passwordPolicy} nicknamePolicy={nicknamePolicy} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 발송' }));

    // resolveErrorMessage는 Error 인스턴스면 그 message를 그대로 보여준다.
    await screen.findByText('메일 발송 실패');
    // 쿨다운이 걸리지 않았으므로 버튼은 초 카운트다운 없이 즉시 다시 누를 수 있어야 한다.
    const retryButton = screen.getByRole('button', { name: '재발송' });
    expect(retryButton).not.toBeDisabled();
  });

  it('쿨다운 초과(AUTH_EMAIL_VERIFICATION_TOO_MANY_REQUESTS)에는 클라이언트 쿨다운을 건다', async () => {
    requestEmailVerification.mockRejectedValue(
      new ApiError('너무 많은 요청', 429, {
        code: 'AUTH_EMAIL_VERIFICATION_TOO_MANY_REQUESTS',
        message: '너무 많은 요청',
      }),
    );

    render(<SignupFormClient passwordPolicy={passwordPolicy} nicknamePolicy={nicknamePolicy} />);

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), { target: { value: 'a@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 발송' }));

    await screen.findByText('너무 많은 요청');
    expect(screen.getByRole('button', { name: /재발송 \(60초\)/ })).toBeDisabled();
  });
});
