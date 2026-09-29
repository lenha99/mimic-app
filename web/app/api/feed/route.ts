import { loadFeed, loadTake, parseSort } from "@/lib/feed";
import { createClient } from "@/lib/supabase/server";

/**
 * 피드 다음 페이지 · 녹음 하나 다시 받기.
 *
 *   GET /api/feed?sort=hot&offset=8   다음 페이지
 *   GET /api/feed?id={uuid}           그 녹음만 (재생 URL 이 30분짜리라 오래 머물면 만료된다)
 *
 * 쿠키 세션으로 부른다 — "내가 누른 반응"과 "내 녹음" 표시가 보는 사람마다 다르다.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const supabase = await createClient();
  // 누가 보는지는 조회와 동시에 — 기다렸다 조회하면 DB 왕복이 하나 는다.
  const viewer = supabase.auth
    .getUser()
    .then(({ data }) => data.user?.id ?? null)
    .catch(() => null);

  const id = q.get("id");
  if (id) {
    const take = await loadTake(supabase, id, await viewer);
    return take
      ? Response.json({ item: take })
      : Response.json({ error: "없거나 내려간 녹음이에요" }, { status: 404 });
  }

  const offset = Math.max(0, Math.min(10_000, Number(q.get("offset")) || 0));
  const page = await loadFeed(supabase, {
    sort: parseSort(q.get("sort")),
    offset,
    pin: q.get("pin"),
    viewer,
  });
  return Response.json(page, { headers: { "cache-control": "private, no-store" } });
}
