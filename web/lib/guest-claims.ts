/**
 * 비로그인 상태로 저장한 녹음의 claim_token 보관함 (이슈 #19).
 *
 * /api/publish-recording 이 게스트에게 1회용 토큰을 돌려주면 여기 쌓아뒀다가,
 * 로그인 직후 /profile 에서 claim_recording() RPC로 계정에 귀속시킨다.
 *
 * localStorage 는 시크릿 모드·쿠키 차단 환경에서 접근 자체가 throw 할 수 있다.
 * 귀속은 부가 기능이고 녹음은 이미 서버에 저장된 뒤라, 실패해도 흐름을 끊지 않는다.
 */
const KEY = "mimic.guestClaims";

export function readGuestClaims(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function addGuestClaim(token: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set([...readGuestClaims(), token])]));
  } catch {
    // 저장 못 해도 녹음은 이미 서버에 있다. 귀속만 포기한다.
  }
}

export function removeGuestClaims(tokens: string[]): void {
  try {
    const drop = new Set(tokens);
    const left = readGuestClaims().filter((t) => !drop.has(t));
    if (left.length) localStorage.setItem(KEY, JSON.stringify(left));
    else localStorage.removeItem(KEY);
  } catch {
    // 무시 — 다음 로그인 때 다시 시도되고, 이미 귀속된 토큰은 서버가 거부한다.
  }
}
