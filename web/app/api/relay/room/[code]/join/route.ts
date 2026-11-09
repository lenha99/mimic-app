import { normalizeAvatar } from "@/lib/avatar";
import { cleanNickname } from "@/lib/nickname";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { requestT } from "@/lib/i18n";
import { createServiceClient } from "@/lib/supabase/service";
import { displayName, ownerOf } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import { broadcast, findRoom, MAX_MEMBERS, membersOf, memberOf, postSystem, touch } from "@/lib/room-server";
import type { Json } from "@/types/database";

/** 방 들어가기 — 링크가 입장권. 잠긴 방·내보내진 기기는 못 들어온다. */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const t = requestT(req);
  if (!allow(`room-join:${clientIp(req)}`, 30, 3_600_000)) return tooMany();
  const { code } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { client?: string; name?: string; avatar?: unknown; via?: string };
  const v = await requestViewer(b.client);
  const owner = ownerOf(v);
  if (!owner) return json({ error: t("이 브라우저는 저장이 막혀 있어 로그인해야 들어갈 수 있어요.", "Log in to join.") }, 401);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room) return json({ error: t("없는 방이에요.", "No such room.") }, 404);
  const members = await membersOf(room.code, service);
  const me = memberOf(members, v);
  if (me?.kicked) return json({ error: t("방장이 이 방에서 내보냈어요.", "The host removed you from this room.") }, 403);
  if (me) return json({ ok: true, already: true });
  if (room.locked) return json({ error: t("방장이 방을 잠갔어요. 새로 들어갈 수 없어요.", "The host locked this room.") }, 403);
  if (members.filter((m) => !m.kicked).length >= MAX_MEMBERS) return json({ error: t(`방은 ${MAX_MEMBERS}명까지예요.`, `Rooms hold up to ${MAX_MEMBERS}.`) }, 409);

  const name = await displayName(v, cleanNickname(b.name), service);
  const { error } = await service.from("relay_room_members").insert({ room: room.code, owner, user_id: v.userId, name, avatar: normalizeAvatar(b.avatar, owner) as unknown as Json, seen_at: new Date().toISOString() });
  if (error && error.code !== "23505") return json({ error: t("들어가지 못했어요. 다시 해 주세요.", "Couldn't join.") }, 500);
  await postSystem(room.code, `👋 ${name}님이 들어왔어요`, service);
  await touch(room.code, service);
  await broadcast(room.code, "room", {});
  return json({ ok: true });
}
