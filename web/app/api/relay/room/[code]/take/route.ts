import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { AUDIO_CACHE_CONTROL, toAac } from "@/lib/encode-audio";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { requestT } from "@/lib/i18n";
import { createServiceClient } from "@/lib/supabase/service";
import { json, requestViewer } from "@/lib/relay-req";
import { broadcast, findRoom, membersOf, memberOf, notifyOffline, postSystem, touch } from "@/lib/room-server";
import { PART_SEC, splitScript, WHOLE_SEC } from "@/lib/room-script";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * 대본 방 녹음 — part=단락 번호(1부터), 없으면 처음부터 끝까지.
 * 한 사람은 단락마다 하나만 남는다(다시 올리면 바꾼다). 방을 나가면 지워진다.
 */
export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const t = requestT(req);
  if (!allow(`room-take:${clientIp(req)}`, 60, 3_600_000)) return tooMany(t("한 시간에 너무 많이 올렸어요. 잠시 뒤에 해 주세요.", "Too many uploads."));
  const { code } = await ctx.params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const v = await requestViewer(String(form?.get("client") ?? ""));
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room || room.kind !== "script") return json({ error: t("없는 대본 방이에요.", "No such script room.") }, 404);
  const me = memberOf(await membersOf(room.code, service), v);
  if (!me || me.kicked) return json({ error: t("방에 들어와야 녹음할 수 있어요.", "Join the room to record.") }, 403);

  const parts = splitScript(room.script ?? "");
  const rawPart = String(form?.get("part") ?? "");
  const part = rawPart ? Number(rawPart) : null;
  if (part !== null && (!Number.isInteger(part) || part < 1 || part > parts.length)) return json({ error: t("없는 단락이에요.", "Unknown paragraph.") }, 400);
  const duration = Number(form?.get("duration"));
  const maxSec = part === null ? WHOLE_SEC : PART_SEC;
  if (!(file instanceof Blob) || file.size < 800) return json({ error: t("녹음이 비어 있어요.", "The recording is empty.") }, 400);
  if (file.size > MAX_BYTES || !/^audio\//.test(file.type)) return json({ error: t("녹음 파일이 이상해요.", "Bad recording.") }, 400);
  if (!Number.isFinite(duration) || duration < 0.4 || duration > maxSec + 2) return json({ error: t("녹음 길이가 이상해요.", "Bad length.") }, 400);

  let q = service.from("relay_room_takes").select("id, audio_path").eq("room", room.code).eq("owner", me.owner);
  q = part === null ? q.is("part", null) : q.eq("part", part);
  const { data: existing } = await q.maybeSingle();

  const id = existing?.id ?? randomUUID();
  const audio = (await toAac(file)) ?? file;
  const type = audio.type.split(";")[0];
  const ext = type.includes("wav") ? "wav" : type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const path = `rooms/${room.code}/${id}-${Date.now().toString(36)}.${ext}`;
  const { error: upError } = await service.storage.from("recordings").upload(path, audio, { contentType: type, upsert: false, cacheControl: AUDIO_CACHE_CONTROL });
  if (upError) return json({ error: t("녹음을 올리지 못했어요. 다시 해 주세요.", "Upload failed.") }, 500);
  const row = { audio_path: path, duration_s: Math.round(duration * 100) / 100, name: me.name, created_at: new Date().toISOString() };
  const { error } = existing
    ? await service.from("relay_room_takes").update(row).eq("id", id)
    : await service.from("relay_room_takes").insert({ id, room: room.code, owner: me.owner, user_id: v.userId, part, ...row });
  if (error) {
    await service.storage.from("recordings").remove([path]);
    return json({ error: t("올리지 못했어요. 다시 해 주세요.", "Couldn't save.") }, 500);
  }
  if (existing) await service.storage.from("recordings").remove([existing.audio_path]);

  after(async () => {
    const what = part === null ? "처음부터 끝까지" : `${part}번 단락`;
    await postSystem(room.code, `🎙 ${me.name}님이 ${what}을 ${existing ? "다시 " : ""}녹음했어요`, service);
    await broadcast(room.code, "scene", {});
    await touch(room.code, service);
    await notifyOffline(room, `${me.name}님이 ${what}을 녹음했어요`, [me.owner], service);
  });
  return json({ id, replaced: Boolean(existing) });
}

/** 내 녹음 지우기 */
export async function DELETE(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL(req.url);
  const v = await requestViewer(url.searchParams.get("client"));
  const id = url.searchParams.get("id") ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: "bad id" }, 400);
  const service = createServiceClient();
  const room = await findRoom(code, service);
  if (!room) return json({ error: "not found" }, 404);
  const { data: take } = await service.from("relay_room_takes").select("id, owner, audio_path").eq("id", id).eq("room", room.code).maybeSingle();
  if (!take || !v.keys.includes(take.owner)) return json({ error: "forbidden" }, 403);
  await service.from("relay_room_takes").delete().eq("id", id);
  await service.storage.from("recordings").remove([take.audio_path]);
  await broadcast(room.code, "scene", {});
  return json({ ok: true });
}
