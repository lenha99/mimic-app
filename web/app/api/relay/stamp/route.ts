import { isAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify-server";
import { createServiceClient } from "@/lib/supabase/service";
import { DIRECTIONS } from "@/lib/relay";
import { json, requestViewer } from "@/lib/relay-req";

/**
 * 감독 NG/OK — 내 장면에 들어온 녹음에. NG 는 정해진 디렉션 중 하나를 붙인다(자유 입력 없음).
 * 비축 장면(감독 없음)은 운영자가 감독이다.
 */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { client?: string; takeId?: string; stamp?: string | null; direction?: string | null };
  const v = await requestViewer(b.client);
  const service = createServiceClient();
  const { data: take } = await service.from("relay_takes").select("id, scene_id, owner, user_id, kind").eq("id", String(b.takeId ?? "")).maybeSingle();
  if (!take) return json({ error: "not found" }, 404);
  const { data: s } = await service.from("relay_scenes").select("id, title, status, director").eq("id", take.scene_id).maybeSingle();
  if (!s || s.status !== "live") return json({ error: "not live" }, 409);
  const mine = !!s.director && v.keys.includes(s.director);
  if (!mine && !((!s.director || s.director === "admin") && (await isAdmin()))) return json({ error: "forbidden" }, 403);
  const stamp = b.stamp === "ok" || b.stamp === "ng" ? b.stamp : null;
  const direction = stamp === "ng" && DIRECTIONS.some((d) => d.id === b.direction) ? String(b.direction) : null;
  await service.from("relay_takes").update({ stamp, direction }).eq("id", take.id);
  if (stamp === "ng") {
    const label = DIRECTIONS.find((d) => d.id === direction)?.ko ?? "다시 한 번";
    await notify({
      userId: take.user_id,
      client: take.owner.startsWith("g:") ? take.owner.slice(2) : null,
      kind: "relay_ng",
      sceneId: s.id,
      push: { title: "🎬 NG!", body: `감독님 왈: ${label}`, url: `/relay/s/${s.id}`, tag: "relay" },
      pushKey: `relay-ng:${take.id}:${direction ?? ""}`,
    });
  }
  return json({ ok: true });
}
