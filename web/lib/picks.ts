import type { GalleryEntry } from "@/lib/weekly-server";

/**
 * 운영자 픽 나누기 — 가장 최근에 고른 하나가 지금 픽, 나머지는 지난 픽(최근 고른 순).
 * 픽은 한 번에 하나만 걸려야 뽑혔다는 무게가 생긴다. DB 는 그대로(featured_at), 화면에서만 나눈다.
 */
export function splitPicks(entries: GalleryEntry[]): { pick: GalleryEntry | null; past: GalleryEntry[] } {
  const all = entries.filter((e) => e.featured).sort((a, b) => (b.featuredAt ?? "").localeCompare(a.featuredAt ?? ""));
  return { pick: all[0] ?? null, past: all.slice(1) };
}
