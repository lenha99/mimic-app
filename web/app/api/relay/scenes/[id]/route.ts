import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { json, requestViewer } from "@/lib/relay-req";

/**
 * 장면 상태 바꾸기.
 *  - approve / reject: 운영자 — 새 감독의 첫 장면 승인 (승인하면 상영 대기열로)
 *  - withdraw: 감독 본인 — 아직 상영 전인 장면 거두기
 *  - premiere: 운영자 — 시험용으로 지금 개봉
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { action?: string; client?: string };
  const service = createServiceClient();
  const { data: s } = await service.from("relay_scenes").select("id, status, director").eq("id", id).maybeSingle();
  if (!s) return json({ error: "not found" }, 404);
  const admin = await isAdmin();
  if (b.action === "approve" || b.action === "reject") {
    if (!admin) return json({ error: "forbidden" }, 403);
    if (s.status !== "pending") return json({ error: "not pending" }, 409);
    if (b.action === "approve") await service.from("relay_scenes").update({ status: "queued" }).eq("id", id).eq("status", "pending");
    else await service.from("relay_scenes").delete().eq("id", id).eq("status", "pending");
    return json({ ok: true });
  }
  if (b.action === "withdraw") {
    const v = await requestViewer(b.client);
    if (!s.director || !v.keys.includes(s.director)) return json({ error: "forbidden" }, 403);
    if (s.status !== "pending" && s.status !== "queued") return json({ error: "already live" }, 409);
    await service.from("relay_scenes").delete().eq("id", id).in("status", ["pending", "queued"]);
    return json({ ok: true });
  }
  if (b.action === "premiere") {
    if (!admin) return json({ error: "forbidden" }, 403);
    if (s.status !== "live") return json({ error: "not live" }, 409);
    await service.from("relay_scenes").update({ premiere_at: new Date(Date.now() - 1000).toISOString() }).eq("id", id);
    const { ensureSchedule } = await import("@/lib/relay-server");
    await ensureSchedule(service, true);
    return json({ ok: true });
  }
  return json({ error: "unknown action" }, 400);
}
