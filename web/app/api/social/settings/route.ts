import { currentUserId } from "@/lib/social-server";
import { createServiceClient } from "@/lib/supabase/service";

/** 메시지 받기 설정 — 구독자만 / 끄기. */
export async function PATCH(req: Request) {
  const me = await currentUserId();
  if (!me) return Response.json({ error: "login" }, { status: 401 });
  const { dmPolicy } = (await req.json().catch(() => ({}))) as { dmPolicy?: unknown };
  if (dmPolicy !== "followers" && dmPolicy !== "off") return Response.json({ error: "bad" }, { status: 400 });
  const { error } = await createServiceClient().from("profiles").update({ dm_policy: dmPolicy }).eq("id", me);
  if (error) return Response.json({ error: "failed" }, { status: 500 });
  return Response.json({ dmPolicy });
}
