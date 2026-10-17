/**
 * 웹앱 서버 → Modal 채점·받아쓰기 호출에 붙이는 헤더. 서버 전용.
 *
 * Modal 쪽(modal_app._from_proxy)은 이 값이 맞는 요청만 받는다. 주소는 공개돼 있어도
 * 이 값은 Vercel·Modal 환경변수에만 있어서, 웹앱을 거치지 않은 호출은 CPU 를 쓰기
 * 전에 돌려보내진다. NEXT_PUBLIC_ 이 아니라 브라우저 번들에는 안 들어간다.
 */
export function proxyHeaders(): Record<string, string> {
  const token = process.env.PROXY_TOKEN;
  return token ? { "x-mimic-proxy": token } : {};
}
