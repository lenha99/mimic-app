import { createPublicClient } from "@/lib/supabase/public";

/**
 * 투표·랭킹을 내세워도 되는가.
 *
 * 대결은 같은 밈에 공개 녹음이 둘 이상 있어야 만들어진다. 그 전에 "투표"를
 * 내세우면 새로 온 사람은 로그인 벽을 넘고 빈 방을 본다 — 죽은 앱처럼 보인다.
 * 조건이 채워지는 순간 저절로 나타난다(페이지 재생성 주기 안에).
 */
export async function socialReady(): Promise<boolean> {
  try {
    const { data } = await createPublicClient()
      .from("recordings")
      .select("meme_id")
      .eq("is_public", true)
      .eq("hidden", false)
      .limit(1000);
    const per = new Map<string, number>();
    for (const r of data ?? []) per.set(r.meme_id, (per.get(r.meme_id) ?? 0) + 1);
    return [...per.values()].some((n) => n >= 2);
  } catch {
    return false;
  }
}
