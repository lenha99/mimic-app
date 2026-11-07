import { isAdmin } from "@/lib/admin";
import { ensureSchedule, levelFor, loadScene, publicView } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";

/** 장면 하나 — 대본 · 후보 · 출연 · 정식판. 보는 사람 것이면 mine 표시. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const v = await requestViewer(url.searchParams.get("client"));
  await ensureSchedule();
  const s = await loadScene(id, v);
  if (!s || s.status === "void") return json({ error: "not found" }, 404);
  // 비축 장면(감독 없음)은 운영자가 감독이다 — 스탬프·효과음·캐스팅 API 와 같은 규칙
  if (!s.amDirector && !s.directorName && (await isAdmin())) s.amDirector = true;
  if ((s.status === "pending" || s.status === "queued") && !s.amDirector) return json({ error: "not found" }, 404);
  return json({ scene: publicView(s), level: await levelFor(v) });
}
