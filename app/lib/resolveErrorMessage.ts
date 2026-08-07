// 백엔드가 관리자가 바로 고칠 수 있는 400/409 오류를 이미 사람이 읽을 수 있는 문구로 내려주는
// 경우(ApiError.message), 뭉뚱그린 일반 문구 대신 그 메시지를 그대로 보여준다 - 그러지 않으면
// 어떤 필드를 고쳐야 하는지 알 수 없다. mock 모드는 plain Error로 메시지를 던지므로 ApiError로
// 좁히지 않고 Error 전체를 본다.
export function resolveErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
