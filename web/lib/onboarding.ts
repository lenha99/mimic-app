/**
 * 처음 온 사람 안내 — 무엇을 이미 봤는지 기기에 적어 둔다.
 *
 * 로그인 없이 쓰는 사람이 대부분이라 서버가 아니라 localStorage 다. 지워지면 한 번 더
 * 보일 뿐이니 그걸로 충분하다. 안내는 늘 한 번만 — 두 번째부터는 방해다.
 */
export type Guide = "intro" | "tip_mic" | "tip_like" | "tip_result";

const KEY = "mimic.guide";

function read(): Record<string, number> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return v && typeof v === "object" ? (v as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function seen(g: Guide): boolean {
  return Boolean(read()[g]);
}

export function markSeen(g: Guide): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...read(), [g]: Date.now() }));
  } catch {
    // 저장이 막힌 브라우저 — 다음에 한 번 더 보일 뿐이다.
  }
}

/** "사용법 다시 보기" — 안내를 처음 상태로 되돌린다. */
export function resetGuides(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 위와 같다.
  }
}
