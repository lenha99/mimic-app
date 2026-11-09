import { requestT } from "@/lib/i18n";
import { createServiceClient } from "@/lib/supabase/service";
import { json, requestViewer } from "@/lib/relay-req";
import { findRoom, leaveRoom, membersOf, memberOf } from "@/lib/room-server";

/**
 * 방 나가기 — 이 방에 남긴 내 녹음을 지우고 빠진다. 아무도 안 남으면 방이 통째로 사라진다.
 * 간직하고 싶은 녹음은 나가기 전에 화면의 "내 기기에 저장"으로 내려받는다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const t = requestT(req);
  const { code } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { client?: string };
  const v = await requestViewer(b.client);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room) return json({ ok: true, deleted: true });
  const me = memberOf(await membersOf(room.code, service), v);
  if (!me || me.kicked) return json({ error: t("이 방 멤버가 아니에요.", "Not a member.") }, 403);
  const r = await leaveRoom(room, me.owner, me.name, service);
  return json({ ok: true, deleted: r === "deleted" });
}
