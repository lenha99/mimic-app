import { normalizeAvatar } from "@/lib/avatar";
import { cleanNickname } from "@/lib/nickname";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { requestT } from "@/lib/i18n";
import { RELAY_STOCK } from "@/lib/relay-stock";
import { createServiceClient } from "@/lib/supabase/service";
import { badText, displayName, insertStockLines, ownerOf } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";
import { missing, newCode, postSystem, ROOM_HOURS, roomLists, roomsV2, ROOMS_PER_DAY } from "@/lib/room-server";
import { cleanScript, cleanTitle, titleFromScript } from "@/lib/room-script";
import type { Json } from "@/types/database";

/** 방 만들 때 고를 장면들 + 내 방 + 공개 방 */
export async function GET(req: Request) {
  const v = await requestViewer(new URL(req.url).searchParams.get("client"));
  const scenes = RELAY_STOCK.map((s) => ({ key: s.key, title: s.title, logline: s.logline, genre: s.genre, hall: s.hall, roles: s.roles.length, lines: s.lines.length }));
  const lists = await roomLists(v).catch(() => ({ mine: [], open: [], ready: false, v2: false }));
  return json({ scenes, ...lists });
}

type Body = { client?: string; kind?: "scene" | "script"; stockKey?: string; script?: string; title?: string; public?: boolean; name?: string; avatar?: unknown };

/**
 * 방 만들기.
 * - scene: 비축 장면 하나를 복사해 방 장면(status room)으로. 배역을 나눠 찍는다.
 * - script: 붙여 넣은 대본으로. 배역 없이 단락별로 아무나 녹음한다.
 */
export async function POST(req: Request) {
  const t = requestT(req);
  if (!allow(`room-new:${clientIp(req)}`, 12, 3_600_000)) return tooMany(t("방을 너무 많이 만들었어요. 잠시 뒤에 해 주세요.", "Too many rooms."));
  const b = (await req.json().catch(() => ({}))) as Body;
  const v = await requestViewer(b.client);
  const owner = ownerOf(v);
  if (!owner) return json({ error: t("이 브라우저는 저장이 막혀 있어 로그인해야 방을 만들 수 있어요.", "Log in to make a room.") }, 401);

  const service = createServiceClient();
  const notReady = () => json({ error: t("방 기능을 준비하고 있어요. 조금만 기다려 주세요!", "Rooms are coming soon!"), notReady: true }, 503);
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { count, error: cErr } = await service.from("relay_rooms").select("code", { count: "exact", head: true }).eq("host", owner).gte("created_at", since);
  if (missing(cErr)) return notReady();
  if ((count ?? 0) >= ROOMS_PER_DAY) return json({ error: t(`방은 하루에 ${ROOMS_PER_DAY}개까지 만들 수 있어요.`, `Up to ${ROOMS_PER_DAY} rooms a day.`) }, 429);
  const v2 = await roomsV2(service);
  const kind = b.kind === "script" ? "script" : "scene";
  if (kind === "script" && !v2) return notReady();

  let title = cleanTitle(b.title);
  if (title && badText(title)) return json({ error: t("방 제목에 쓸 수 없는 말이 있어요.", "That title isn't allowed.") }, 400);
  const pub = b.public !== false;
  const code = newCode();
  const name = await displayName(v, cleanNickname(b.name), service);
  const base = { code, host: owner, host_user: v.userId };

  if (kind === "script") {
    const script = cleanScript(b.script);
    if (!script) return json({ error: t("대본을 5자 이상, 4,000자 이하로 넣어 주세요.", "Paste a script between 5 and 4,000 characters.") }, 400);
    title = title ?? cleanTitle(titleFromScript(script)) ?? "우리 대본";
    const { error } = await service.from("relay_rooms").insert({ ...base, kind: "script", script, title, public: pub });
    if (error) {
      console.error("room script", error.message);
      return json({ error: t("방을 만들지 못했어요.", "Couldn't make the room.") }, 500);
    }
  } else {
    const pick = RELAY_STOCK.find((s) => s.key === b.stockKey);
    if (!pick) return json({ error: t("없는 장면이에요.", "Unknown scene.") }, 400);
    title = title ?? pick.title;
    const now = Date.now();
    const { data: scene, error } = await service
      .from("relay_scenes")
      .insert({
        hall: pick.hall,
        stock_key: pick.key,
        title: pick.title,
        logline: pick.logline,
        genre: pick.genre,
        roles: pick.roles as unknown as Json,
        status: "room",
        opens_at: new Date(now).toISOString(),
        premiere_at: new Date(now + ROOM_HOURS * 3600_000).toISOString(),
      })
      .select("id")
      .single();
    if (error || !scene) {
      console.error("room scene", error?.message);
      return notReady();
    }
    const fail = async () => {
      await service.from("relay_scenes").delete().eq("id", scene.id);
      return json({ error: t("방을 만들지 못했어요.", "Couldn't make the room.") }, 500);
    };
    if (!(await insertStockLines(scene.id, pick, service))) return fail();
    const { error: rErr } = await service.from("relay_rooms").insert(v2 ? { ...base, scene_id: scene.id, kind: "scene", title, public: pub } : { ...base, scene_id: scene.id });
    if (rErr) return fail();
  }

  await service.from("relay_room_members").insert({ room: code, owner, user_id: v.userId, name, avatar: normalizeAvatar(b.avatar, owner) as unknown as Json, seen_at: new Date().toISOString() });
  await postSystem(
    code,
    kind === "script"
      ? `📄 ${name}님이 「${title}」 대본 방을 열었어요. 아무 단락이나 골라 읽고 녹음해 보세요!`
      : `🎬 ${name}님이 「${title}」 방을 열었어요. 링크로 친구를 불러 배역을 나눠 보세요!`,
    service,
  );
  return json({ code });
}
