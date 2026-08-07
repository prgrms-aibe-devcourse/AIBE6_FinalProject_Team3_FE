import { beforeEach, describe, expect, it } from 'vitest';
import { captureDevLoginKeyFromUrl, getStoredDevLoginKey } from './devLoginKey';

describe('devLoginKey', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('devkey fragment를 localStorage에 저장하고 URL에서 지운다', () => {
    window.history.replaceState({}, '', '/?other=kept#devkey=secret-123');

    captureDevLoginKeyFromUrl();

    expect(getStoredDevLoginKey()).toBe('secret-123');
    expect(window.location.search).toBe('?other=kept');
    expect(window.location.hash).toBe('');
  });

  it('devkey가 없으면 아무것도 저장하지 않는다', () => {
    window.history.replaceState({}, '', '/?other=kept');

    captureDevLoginKeyFromUrl();

    expect(getStoredDevLoginKey()).toBeNull();
    expect(window.location.search).toBe('?other=kept');
  });

  it('devkey가 쿼리파라미터로 오면 저장하지 않지만, 주소창/히스토리 노출을 줄이기 위해 URL에서는 지운다', () => {
    window.history.replaceState({}, '', '/?devkey=secret-123&other=kept');

    captureDevLoginKeyFromUrl();

    expect(getStoredDevLoginKey()).toBeNull();
    expect(window.location.search).toBe('?other=kept');
  });

  it('이미 저장된 키는 devkey 없는 재방문에도 그대로 남아있다', () => {
    window.history.replaceState({}, '', '/#devkey=secret-123');
    captureDevLoginKeyFromUrl();

    window.history.replaceState({}, '', '/');
    captureDevLoginKeyFromUrl();

    expect(getStoredDevLoginKey()).toBe('secret-123');
  });
});
