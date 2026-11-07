import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { SFX } from "@/lib/relay";
import { json, requestViewer } from "@/lib/relay-req";

/** 감독 — 줄 뒤에 효과음 넣기·빼기. 효과음은 브라우저가 합성한다(파일 없음). */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { client?: string; sceneId?: string; afterN?: number; sfx?: string | null };
  const v = await requestViewer(b.client);
  const service = createServiceClient();
  const { data: s } = await service.from("relay_scenes").select("id, status, director").eq("id", String(b.sceneId ?? "")).maybeSingle();
  if (!s || s.status !== "live") return json({ error: "not live" }, 409);
  const mine = !!s.director && v.keys.includes(s.director);
  if (!mine && !((!s.director || s.director === "admin") && (await isAdmin()))) return json({ error: "forbidden" }, 403);
  const n = Number(b.afterN);
  if (!Number.isInteger(n) || n < 1 || n > 10) return json({ error: "bad line" }, 400);
  if (!b.sfx) await service.from("relay_sfx").delete().eq("scene_id", s.id).eq("after_n", n);
  else if (SFX.some((x) => x.id === b.sfx)) await service.from("relay_sfx").upsert({ scene_id: s.id, after_n: n, sfx: b.sfx });
  else return json({ error: "bad sfx" }, 400);
  return json({ ok: true });
}
