import { after } from "next/server";
import { allow, tooMany } from "@/lib/rate-limit";
import { requestT } from "@/lib/i18n";
import { createServiceClient } from "@/lib/supabase/service";
import { badText } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import { broadcast, findRoom, MAX_MSG, membersOf, memberOf, MSGS_PER_DAY, notifyOffline, toMsg, touch } from "@/lib/room-server";

/**
 * 채팅 한 줄 — 멤버만. 금칙어 · 300자 · 1초 1개 · 방당 하루 500개.
 * 저장 → 실시간 전달(broadcast) → 방에 없는 멤버에게 알림(30분에 한 번).
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const t = requestT(req);
  const { code } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { client?: string; text?: string };
  const v = await requestViewer(b.client);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room) return json({ error: t("없는 방이에요.", "No such room.") }, 404);
  const me = memberOf(await membersOf(room.code, service), v);
  if (!me || me.kicked) return json({ error: t("방에 들어와야 채팅할 수 있어요.", "Join the room to chat.") }, 403);
  if (!allow(`room-msg:${me.owner}`, 1, 900)) return tooMany(t("천천히 보내 주세요.", "Slow down."));
  if (!allow(`room-msg-min:${me.owner}`, 30, 60_000)) return tooMany(t("천천히 보내 주세요.", "Slow down."));

  const text = String(b.text ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_MSG);
  if (!text) return json({ error: t("내용을 써 주세요.", "Write something.") }, 400);
  if (badText(text)) return json({ error: t("그 말은 보낼 수 없어요.", "That word isn't allowed.") }, 400);
  if (room.chat_expires_at && new Date(room.chat_expires_at).getTime() < Date.now()) return json({ error: t("뒤풀이가 끝나 채팅이 닫혔어요.", "Chat has closed.") }, 409);

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count } = await service.from("relay_room_msgs").select("id", { count: "exact", head: true }).eq("room", room.code).gte("created_at", since);
  if ((count ?? 0) >= MSGS_PER_DAY) return json({ error: t("오늘 이 방 채팅이 너무 많아요. 내일 다시!", "This room hit today's chat limit.") }, 429);

  const { data, error } = await service.from("relay_room_msgs").insert({ room: room.code, owner: me.owner, name: me.name, kind: "chat", text }).select("id, owner, name, kind, text, created_at").single();
  if (error || !data) return json({ error: t("보내지 못했어요.", "Couldn't send.") }, 500);
  // 받는 쪽에선 mine 이 아니다 — 보낸 사람 화면은 응답으로 받은 걸 쓴다
  await broadcast(room.code, "msg", { msg: toMsg(data, null) });
  await touch(room.code, service);
  after(() => notifyOffline(room, `${me.name}: ${text.slice(0, 60)}`, [me.owner], service));
  return json({ msg: toMsg(data, v) });
}
