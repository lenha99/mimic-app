import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { AUDIO_CACHE_CONTROL, toAac } from "@/lib/encode-audio";
import { normalizeAvatar } from "@/lib/avatar";
import { cleanNickname } from "@/lib/nickname";
import { notify, kstStamp } from "@/lib/notify-server";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { requestT } from "@/lib/i18n";
import { can, isOpen, PRIORITY_MS } from "@/lib/relay";
import { broadcast, findRoom, membersOf, memberOf, notifyOffline, postSystem } from "@/lib/room-server";
import { checkRole, displayName, levelFor, loadScene, ownerOf } from "@/lib/relay-server";
import { json, requestViewer } from "@/lib/relay-req";

const MAX_BYTES = 3 * 1024 * 1024;

/**
 * 줄 녹음 올리기 — 버튼 한 번에 출연(되돌리기는 DELETE /api/relay/takes/<id>).
 * kind=line: 배역 규칙(1인 1배역 · 우선권 · 막판 캐스팅)을 서버가 지킨다. 처음 녹음하면 배역을 잡는다.
 * kind=adlib: RISING(LV3) 부터, 내가 녹음한 줄 뒤에만. 같은 줄을 다시 올리면 바꾼다.
 */
export async function POST(req: Request) {
  const t = requestT(req);
  if (!allow(`relay-take:${clientIp(req)}`, 60, 3_600_000)) {
    return tooMany(t("한 시간에 너무 많이 올렸어요. 잠시 뒤에 해 주세요.", "Too many uploads this hour."));
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const lineId = String(form?.get("line") ?? "");
  const kind = String(form?.get("kind") ?? "line") === "adlib" ? "adlib" : "line";
  const duration = Number(form?.get("duration"));
  const v = await requestViewer(String(form?.get("client") ?? ""));
  const owner = ownerOf(v);
  if (!owner) return json({ error: t("이 브라우저는 저장이 막혀 있어 로그인해야 출연할 수 있어요.", "Log in to appear.") }, 401);
  if (!(file instanceof Blob) || file.size < 800) return json({ error: t("녹음이 비어 있어요.", "The recording is empty.") }, 400);
  if (file.size > MAX_BYTES || !/^audio\//.test(file.type)) return json({ error: t("녹음 파일이 이상해요.", "Bad recording.") }, 400);
  if (!Number.isFinite(duration) || duration < 0.4 || duration > 16) return json({ error: t("녹음 길이가 이상해요.", "Bad length.") }, 400);

  const service = createServiceClient();
  const { data: row } = await service.from("relay_lines").select("scene_id").eq("id", lineId).eq("hidden", false).maybeSingle();
  if (!row) return json({ error: t("없는 대사예요.", "Unknown line.") }, 404);
  const scene = await loadScene(row.scene_id, v, service);
  const line = scene?.lines.find((l) => l.id === lineId);
  if (!scene || !line) return json({ error: t("없는 대사예요.", "Unknown line.") }, 404);
  if (!isOpen(scene.status)) return json({ error: t("이 장면은 이미 개봉했어요.", "Already premiered.") }, 409);
  // 친구 방 — 들어온 멤버만 녹음한다. 애드리브 계급 제한은 방에서도 같다.
  const room = scene.status === "room" ? await findRoom(scene.id, service) : null;
  const member = room ? memberOf(await membersOf(room.code, service), v) : null;
  if (scene.status === "room" && (!room || !member || member.kicked)) {
    return json({ error: t("방에 들어와야 녹음할 수 있어요.", "Join the room to record.") }, 403);
  }

  let claim = false;
  let late = false;
  if (kind === "adlib") {
    if (!can.adlib(await levelFor(v, service))) return json({ error: t("애드리브는 RISING(LV3)부터예요.", "Ad-libs unlock at LV3.") }, 403);
    if (!scene.takes.some((x) => x.lineId === lineId && x.kind === "line" && x.mine)) {
      return json({ error: t("내가 녹음한 줄 뒤에만 애드리브를 붙일 수 있어요.", "Record the line first.") }, 409);
    }
  } else {
    const c = checkRole(scene, line, v);
    if (!c.ok) return json({ error: t(c.ko, c.en) }, c.status);
    claim = c.claim;
    late = c.late;
  }

  const name = await displayName(v, cleanNickname(form?.get("name")), service);
  let avatar = null;
  try {
    avatar = normalizeAvatar(JSON.parse(String(form?.get("avatar") ?? "null")));
  } catch {}

  // 배역부터 잡는다 — 동시에 둘이 같은 배역을 잡으면 하나만 성공한다(기본키).
  if (claim) {
    const { error } = await service.from("relay_roles").insert({
      scene_id: scene.id,
      role: line.role,
      owner,
      user_id: v.userId,
      late,
      priority_until: new Date(Date.now() + PRIORITY_MS).toISOString(),
    });
    if (error) {
      const dup = error.code === "23505";
      return json(
        { error: dup ? t("방금 다른 배우가 이 배역을 맡았어요. 다른 줄을 해 볼까요?", "Someone just took this role.") : t("출연하지 못했어요.", "Couldn't appear.") },
        dup ? 409 : 500,
      );
    }
  }

  const { data: existing } = await service.from("relay_takes").select("id, audio_path").eq("line_id", lineId).eq("owner", owner).eq("kind", kind).maybeSingle();
  const id = existing?.id ?? randomUUID();
  const audio = (await toAac(file)) ?? file;
  const type = audio.type.split(";")[0];
  const ext = type.includes("wav") ? "wav" : type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const path = `relay/${scene.id}/${id}-${Date.now().toString(36)}.${ext}`;
  const { error: upError } = await service.storage.from("recordings").upload(path, audio, { contentType: type, upsert: false, cacheControl: AUDIO_CACHE_CONTROL });
  const release = async () => {
    if (claim) await service.from("relay_roles").delete().eq("scene_id", scene.id).eq("role", line.role).eq("owner", owner);
  };
  if (upError) {
    await release();
    return json({ error: t("녹음을 올리지 못했어요. 다시 해 주세요.", "Upload failed.") }, 500);
  }
  const base = { audio_path: path, duration_s: Math.round(duration * 100) / 100, name, avatar: avatar ?? {}, stamp: null, hidden: false };
  const { error } = existing
    ? await service.from("relay_takes").update({ ...base, created_at: new Date().toISOString() }).eq("id", id)
    : await service.from("relay_takes").insert({ id, scene_id: scene.id, line_id: lineId, owner, user_id: v.userId, kind, ...base });
  if (error) {
    await service.storage.from("recordings").remove([path]);
    await release();
    return json({ error: t("출연하지 못했어요. 다시 해 주세요.", "Couldn't appear.") }, 500);
  }
  if (existing) await service.storage.from("recordings").remove([existing.audio_path]);

  // 친구 방 — "○○님이 3번 대사 녹음" + 화면 새로 고침 신호. 다 차면 "완성본 들어 봐요"
  if (room && kind === "line") {
    after(async () => {
      const fresh = await loadScene(scene.id, null, service);
      const base = fresh?.lines.filter((l) => !l.candidate) ?? [];
      const filled = base.filter((l) => fresh!.takes.some((x) => x.lineId === l.id && x.kind === "line")).length;
      const roleName = scene.roles.find((r) => r.id === line.role)?.name ?? line.role;
      await postSystem(room.code, `🎙 ${member?.name || name}님이 ${line.n}번 대사(${roleName})를 녹음했어요 · ${filled}/${base.length}`, service);
      if (base.length && filled === base.length && !existing) await postSystem(room.code, "✨ 모든 대사가 찼어요! 방장이 [완성]을 누르면 다 같이 들을 수 있어요.", service);
      await broadcast(room.code, "scene", {});
      await notifyOffline(room, `${member?.name || name}님이 ${line.n}번 대사를 녹음했어요`, [owner], service);
    });
  }

  // 작가에게 — "누군가 당신이 쓴 대사를 연기했어요" (작가당 하루 한 번 푸시)
  if (kind === "line" && line.candidate && !line.mineAuthor) {
    after(async () => {
      const { data: l } = await service.from("relay_lines").select("author, author_user").eq("id", lineId).maybeSingle();
      if (!l?.author || l.author === owner) return;
      await notify({
        userId: l.author_user,
        kind: "relay_voiced",
        sceneId: scene.id,
        push: { title: "✍️ 내 대사가 연기됐어요", body: `「${scene.title}」에서 당신이 쓴 대사를 누군가 연기했어요`, url: `/relay/s/${scene.id}`, tag: "relay" },
        pushKey: `relay-voiced:${l.author}:${kstStamp()}`,
      });
    });
  }
  return json({ id, sceneId: scene.id, claimed: claim, late, replaced: Boolean(existing) });
}
