import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { json, requestViewer } from "@/lib/relay-req";
import { findRoom, membersOf, memberOf } from "@/lib/room-server";

/** 채팅 신고 — 멤버만. 운영자 화면(/admin/feedback)에 뜬다. 신고한 사람 화면에선 바로 가린다(클라이언트). */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  if (!allow(`room-report:${clientIp(req)}`, 20, 3_600_000)) return tooMany();
  const { code } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { client?: string; id?: number };
  const v = await requestViewer(b.client);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room || !Number.isInteger(b.id)) return json({ error: "not found" }, 404);
  const me = memberOf(await membersOf(room.code, service), v);
  if (!me) return json({ error: "forbidden" }, 403);
  await service.from("relay_room_msgs").update({ reported: true }).eq("room", room.code).eq("id", b.id!).eq("kind", "chat");
  return json({ ok: true });
}
