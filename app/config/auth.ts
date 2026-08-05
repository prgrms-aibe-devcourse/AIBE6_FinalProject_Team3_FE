// 프론트(Vercel 등)와 백엔드(EC2 등)가 등록 도메인을 전혀 공유하지 않는 배포에서 켠다. 이 경우
// 브라우저는 백엔드가 발급한 access/refresh 쿠키를 프론트 서버로 가는 요청에는 절대 붙이지 않으므로
// (쿠키는 발급 도메인에만 종속되고 SameSite는 이를 바꾸지 못한다), 미들웨어/서버 컴포넌트에서
// 쿠키를 읽어 로그인 여부를 판단하는 기존 방식이 항상 "로그인 안 됨"으로 잘못 판정한다.
// 이 값이 true면 그 서버측 판정을 건너뛰고, 브라우저가 크로스오리진 fetch(credentials:'include')로
// 직접 백엔드에 확인하는 클라이언트 게이트((main)/MainLayoutGate.tsx)로 위임한다.
export const crossOriginAuth = process.env.NEXT_PUBLIC_CROSS_ORIGIN_AUTH === 'true';
