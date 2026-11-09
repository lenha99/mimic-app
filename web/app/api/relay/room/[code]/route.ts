import { createServiceClient } from "@/lib/supabase/service";
import { levelFor } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import { finishRoom, findRoom, membersOf, memberOf, messages, roomView } from "@/lib/room-server";

/**
 * 방 하나 — 장면 · 멤버 · 채팅. after=<마지막 메시지 id> 면 그 뒤 메시지만.
 * 멤버가 아니면 장면과 멤버만(채팅은 들어와야 보인다). 멤버가 부르면 "지금 보는 중"(seen_at)을 남긴다.
 */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const v = await requestViewer(url.searchParams.get("client"));
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room) return json({ error: "not found" }, 404);
  // 크론은 하루 한 번이라 — 72시간 지난 방은 누가 열 때 완성한다
  const { data: st } = await service.from("relay_scenes").select("status, premiere_at").eq("id", room.scene_id).maybeSingle();
  if (st?.status === "room" && st.premiere_at && new Date(st.premiere_at).getTime() <= Date.now()) await finishRoom(room, service);
  const view = await roomView(room, v, service);
  if (!view) return json({ error: "not found" }, 404);
  const me = memberOf(await membersOf(room.code, service), v);
  const inRoom = !!me && !me.kicked;
  if (inRoom && (!me.seen_at || Date.now() - new Date(me.seen_at).getTime() > 15_000)) {
    await service.from("relay_room_members").update({ seen_at: new Date().toISOString() }).eq("room", room.code).eq("owner", me.owner);
  }
  const after = Number(url.searchParams.get("after") ?? 0) || 0;
  // 뒤풀이가 끝난 채팅은 크론이 지우기 전이라도 보여 주지 않는다
  const expired = !!room.chat_expires_at && new Date(room.chat_expires_at).getTime() <= Date.now();
  const msgs = inRoom && !expired ? await messages(room.code, v, after, service) : [];
  return json({ ...view, msgs, level: await levelFor(v, service) });
}
