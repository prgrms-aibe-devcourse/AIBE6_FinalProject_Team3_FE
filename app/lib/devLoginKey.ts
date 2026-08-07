const STORAGE_KEY = 'algogyeyak:devLoginKey';

// 배포 환경에서 dev-login을 쓰려면 백엔드의 DEV_LOGIN_SECRET과 일치하는 값이 필요하다. 이 값을
// NEXT_PUBLIC_* 빌드 변수로 두면 번들에 그대로 노출되므로, 대신 부트스트랩 링크
// (`<프론트주소>/#devkey=<secret>`)로 한 번만 전달받아 localStorage에 저장해두고, 즉시 URL에서
// 지운다. 쿼리 파라미터(`?devkey=`)가 아니라 URL fragment(`#devkey=`)를 쓰는 이유 - 쿼리는
// history에서만 안 남을 뿐 최초 GET 요청 자체에는 실려서 Vercel/CDN 액세스 로그, 애널리틱스 등에
// 남을 수 있다. fragment는 브라우저가 서버로 보내는 HTTP 요청에 아예 포함하지 않으므로(RFC 3986,
// 클라이언트에서만 해석) 서버/CDN 쪽 어디에도 도달하지 않는다.
export function captureDevLoginKeyFromUrl(): void {
  if (typeof window === 'undefined') return;

  // 구버전 링크나 오타로 `?devkey=...`(쿼리)로 들어오는 경우 - 이미 최초 GET 요청에 실려 서버/CDN
  // 로그에는 남았을 수 있어 저장은 하지 않는다(fragment로만 받는다). 하지만 그대로 두면 클라이언트
  // 진입 이후에도 주소창/히스토리/이 페이지에서 나가는 링크의 Referer 등에 계속 노출되므로, 저장
  // 여부와 무관하게 URL에서는 지운다.
  stripQueryDevKey();

  const hash = window.location.hash;
  if (!hash.startsWith('#')) return;

  const params = new URLSearchParams(hash.slice(1));
  const key = params.get('devkey');
  if (!key) return;

  window.localStorage.setItem(STORAGE_KEY, key);
  params.delete('devkey');
  const remainingHash = params.toString();
  window.history.replaceState(
    {},
    '',
    window.location.pathname + window.location.search + (remainingHash ? `#${remainingHash}` : ''),
  );
}

function stripQueryDevKey(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('devkey')) return;

  url.searchParams.delete('devkey');
  window.history.replaceState({}, '', url.pathname + url.search + url.hash);
}

export function getStoredDevLoginKey(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(STORAGE_KEY);
}
