/**
 * 한 사람이 한 번에 여러 개를 올려도 목록을 덮지 않게(11/7 — 한 사람이 열 개를 연달아 올렸다).
 * 순서는 그대로 두고, 한 사람(who)당 앞에서부터 n 개까지만 남긴다.
 */
export function perPerson<T extends { who: string }>(list: T[], n: number): T[] {
  const seen = new Map<string, number>();
  return list.filter((e) => {
    const c = seen.get(e.who) ?? 0;
    seen.set(e.who, c + 1);
    return c < n;
  });
}

/**
 * 최신순 목록 접기 — 같은 사람 목소리가 연달아 나오면 첫 개만 보이고 나머지는 그 밑에 숨긴다.
 * 연달아일 때만 접는다(사이에 다른 사람이 끼면 따로 보인다).
 */
export function foldRuns<T extends { who: string }>(list: T[]): { head: T; more: T[] }[] {
  const out: { head: T; more: T[] }[] = [];
  for (const e of list) {
    const last = out[out.length - 1];
    if (last && last.head.who === e.who) last.more.push(e);
    else out.push({ head: e, more: [] });
  }
  return out;
}
