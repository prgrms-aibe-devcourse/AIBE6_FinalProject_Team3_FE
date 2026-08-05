// 브라우저 전용 base64url 인코딩/디코딩. UTF-8 문자열을 URL-safe하게 왕복시키는 용도로,
// 페이지 간 데이터를 서버 저장 없이 query string에 실어 넘길 때 쓴다(예: upload <-> result 왕복).
// Buffer가 없는 브라우저 환경이라 TextEncoder/TextDecoder + btoa/atob로 UTF-8을 안전하게 다룬다.

export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeBase64Url(value: string): string {
  const base64 = addBase64Padding(value.replace(/-/g, '+').replace(/_/g, '/'));
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function addBase64Padding(value: string): string {
  const remainder = value.length % 4;
  return remainder === 0 ? value : value + '='.repeat(4 - remainder);
}
