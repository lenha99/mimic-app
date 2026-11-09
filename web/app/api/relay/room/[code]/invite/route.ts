import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { requestT } from "@/lib/i18n";
import { notify } from "@/lib/notify-server";
import { blocked, followersOf, followingOf, nicknames } from "@/lib/social-server";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeAvatar } from "@/lib/avatar";
import { ownerOf } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import { findRoom, membersOf, memberOf, postSystem } from "@/lib/room-server";

/**
 * 구독 사이 초대 — 내가 구독한 사람 · 나를 구독한 사람만 부를 수 있다(모르는 사람에게 못 보낸다).
 * GET: 부를 수 있는 사람 목록. POST {keys}: 알림(앱 안 + 푸시)으로 방 링크를 보낸다.
 */
async function candidates(me: string, service: ReturnType<typeof createServiceClient>) {
  const [following, followers] = await Promise.all([followingOf(me, service).catch(() => []), followersOf(me, service).catch(() => [])]);
  const out = new Map<string, { key: string; name: string; avatar: ReturnType<typeof normalizeAvatar> }>();
  for (const f of following) if (f.name) out.set(f.key, { key: f.key, name: f.name, avatar: f.avatar });
  const ids = followers.filter((k) => k.startsWith("u:") && !out.has(k)).map((k) => k.slice(2));
  const profiles = await nicknames(ids, service).catch(() => new Map());
  for (const id of ids) {
    const p = profiles.get(id);
    if (p) out.set(`u:${id}`, { key: `u:${id}`, name: p.nickname, avatar: p.avatar });
  }
  return [...out.values()].slice(0, 60);
}

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const v = await requestViewer(new URL(req.url).searchParams.get("client"));
  const me = ownerOf(v);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room || !me) return json({ people: [] });
  const members = await membersOf(room.code, service);
  if (!memberOf(members, v)) return json({ people: [] });
  const inRoom = new Set(members.map((m) => m.owner));
  const people = (await candidates(me, service)).filter((p) => !inRoom.has(p.key));
  return json({ people });
}

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const t = requestT(req);
  if (!allow(`room-invite:${clientIp(req)}`, 10, 3_600_000)) return tooMany();
  const { code } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { client?: string; keys?: string[] };
  const v = await requestViewer(b.client);
  const me = ownerOf(v);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room || !me) return json({ error: "not found" }, 404);
  const mine = memberOf(await membersOf(room.code, service), v);
  if (!mine || mine.kicked) return json({ error: "forbidden" }, 403);
  if (room.locked) return json({ error: t("잠긴 방이에요. 방장이 열어야 부를 수 있어요.", "Room is locked.") }, 409);
  const allowed = new Map((await candidates(me, service)).map((p) => [p.key, p]));
  const want = (Array.isArray(b.keys) ? b.keys : []).map(String).filter((k) => allowed.has(k)).slice(0, 10);
  const { data: sc } = await service.from("relay_scenes").select("title").eq("id", room.scene_id).maybeSingle();
  let sent = 0;
  for (const k of want) {
    if (await blocked(me, k, service)) continue;
    await notify({
      userId: k.startsWith("u:") ? k.slice(2) : null,
      client: k.startsWith("g:") ? k.slice(2) : null,
      kind: "relay_room_invite",
      actor: v.userId,
      sceneId: room.scene_id,
      push: { title: "🎬 더빙 방 초대", body: `${mine.name}님이 「${sc?.title ?? "장면"}」 같이 찍자고 불렀어요`, url: `/relay/r/${room.code}`, tag: `room-${room.code}` },
      pushKey: `room-invite:${room.code}:${k}`,
    });
    sent++;
  }
  if (sent) await postSystem(room.code, `📨 ${mine.name}님이 ${sent}명을 초대했어요`, service);
  return json({ sent });
}
