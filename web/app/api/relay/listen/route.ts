import { allow, clientIp } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { json } from "@/lib/relay-req";

/** 개봉작을 끝까지 들었다 — 시청률 +1. 같은 사람(IP)이 같은 장면은 하루 한 번만. */
export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { sceneId?: string };
  const id = String(b.sceneId ?? "");
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ ok: false }, 400);
  if (!allow(`relay-listen:${clientIp(req)}:${id}`, 1, 86_400_000)) return json({ ok: true, counted: false });
  await createServiceClient().rpc("relay_bump_listen", { p_scene: id });
  return json({ ok: true, counted: true });
}
