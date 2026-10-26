import { randomUUID } from "node:crypto";
import { normalizeAvatar } from "@/lib/avatar";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { currentWeek, guestName, isLive, MAX_ENTRY_SECONDS } from "@/lib/weekly";
import { cleanNickname } from "@/lib/nickname";
import { ensureWeek, getBoard } from "@/lib/weekly-server";
import { requestT } from "@/lib/i18n";

/**
 * 이번 주 챌린지 출전 · 교체 · 내리기.
 *
 * 로그인 없이도 출전한다(사람이 적은 지금은 문턱이 곧 이탈이다). 게스트는 기기 id 로
 * "한 기기 한 작품"을 세고, 처음 출전할 때 받은 열쇠(claim_token)로만 교체·내리기를
 * 하며, 로그인하면 그 열쇠로 계정에 귀속된다.
 *
 * 교체하면 ❤ 가 0 으로 돌아간다. ❤ 를 모은 뒤 다른 녹음으로 바꿔치기하는 걸 막는다.
 */
const MAX_BYTES = 4 * 1024 * 1024;
/** 한 주 출전 상한 — 저장 공간을 지키는 선. 닿으면 그때 늘린다. */
const MAX_ENTRIES = 500;
const CLIENT = /^[a-z0-9]{8,40}$/;

export async function POST(req: Request) {
  const t = requestT(req);
  const ip = clientIp(req);
  if (!allow(`weekly-enter:${ip}`, 8, 3_600_000)) {
    return tooMany(t("한 시간에 너무 많이 올렸어요. 잠시 뒤에 해주세요.", "Too many uploads this hour. Please try again later."));
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const weekId = String(form?.get("week") ?? "");
  const client = String(form?.get("client") ?? "");
  const token = String(form?.get("token") ?? "");
  const duration = Number(form?.get("duration"));
  const name = cleanNickname(form?.get("name"));
  let bars: number[] = [];
  try {
    const raw: unknown = JSON.parse(String(form?.get("bars") ?? "[]"));
    if (Array.isArray(raw)) bars = raw.slice(0, 48).map((v) => Math.max(0, Math.min(1, Number(v) || 0)));
  } catch {}
  let avatar = null;
  try {
    avatar = normalizeAvatar(JSON.parse(String(form?.get("avatar") ?? "null")));
  } catch {}

  const week = currentWeek();
  if (weekId !== week.id || !isLive(week)) {
    return Response.json({ error: t("이번 주 챌린지가 마감됐어요. 새 대본으로 다시 도전해 주세요.", "This week's challenge has closed. Try again with the new script.") }, { status: 409 });
  }
  if (!(file instanceof Blob) || file.size < 1000) {
    return Response.json({ error: t("녹음이 비어 있어요.", "The recording is empty.") }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: t("녹음이 너무 커요.", "The recording is too large.") }, { status: 413 });
  }
  if (!/^audio\//.test(file.type)) {
    return Response.json({ error: t("녹음 파일이 아니에요.", "That's not an audio file.") }, { status: 400 });
  }
  if (!Number.isFinite(duration) || duration < 2 || duration > MAX_ENTRY_SECONDS) {
    return Response.json({ error: t(`출전 녹음은 2초~${MAX_ENTRY_SECONDS}초여야 해요.`, `Entries must be 2–${MAX_ENTRY_SECONDS} seconds long.`) }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !CLIENT.test(client)) {
    return Response.json(
      { error: t("이 브라우저는 저장이 막혀 있어서 로그인해야 출전할 수 있어요.", "This browser blocks storage, so you'll need to log in to enter.") },
      { status: 401 },
    );
  }
  const owner = user ? `u:${user.id}` : `g:${client}`;

  const service = createServiceClient();
  await ensureWeek(week, service);

  let { data: existing } = await service
    .from("weekly_entries")
    .select("id, audio_path, claim_token")
    .eq("challenge_id", week.id)
    .eq("owner", owner)
    .maybeSingle();
  if (existing && !user && existing.claim_token !== token) {
    return Response.json({ error: t("이 기기에서 출전한 작품만 바꿀 수 있어요.", "You can only replace entries made on this device.") }, { status: 403 });
  }
  // 게스트로 출전한 뒤 로그인했는데 아직 귀속(ClaimPending) 전이면, 그 게스트 출전작이 곧
  // 이 사람의 출전작이다. 여기서 귀속하지 않으면 한 사람이 두 작품을 갖게 된다.
  if (user && !existing && CLIENT.test(client)) {
    const { data: guest } = await service
      .from("weekly_entries")
      .select("id, audio_path, claim_token")
      .eq("challenge_id", week.id)
      .eq("owner", `g:${client}`)
      .is("user_id", null)
      .maybeSingle();
    if (guest) {
      if (guest.claim_token !== token) {
        return Response.json({ error: t("이 기기에서 출전한 작품만 바꿀 수 있어요.", "You can only replace entries made on this device.") }, { status: 403 });
      }
      const { error } = await service
        .from("weekly_entries")
        .update({ user_id: user.id, owner, claim_token: null, guest_name: null })
        .eq("id", guest.id)
        .is("user_id", null);
      if (error) return Response.json({ error: t("출전하지 못했어요. 다시 해주세요.", "Couldn't enter. Please try again.") }, { status: 500 });
      await service.from("weekly_awards").update({ user_id: user.id }).eq("entry_id", guest.id);
      existing = { ...guest, claim_token: null };
    }
  }
  if (!existing) {
    const { count } = await service
      .from("weekly_entries")
      .select("id", { count: "exact", head: true })
      .eq("challenge_id", week.id);
    if ((count ?? 0) >= MAX_ENTRIES) {
      return Response.json({ error: t("이번 주 출전 자리가 꽉 찼어요. 다음 주에 만나요!", "This week's entries are full. See you next week!") }, { status: 503 });
    }
  }

  const id = existing?.id ?? randomUUID();
  const type = file.type.split(";")[0];
  const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
  const path = `weekly/${week.id}/${id}-${Date.now().toString(36)}.${ext}`;
  const { error: upError } = await service.storage
    .from("recordings")
    .upload(path, file, { contentType: type, upsert: false });
  if (upError) {
    return Response.json({ error: t("녹음을 올리지 못했어요. 다시 해주세요.", "Couldn't upload the recording. Please try again.") }, { status: 500 });
  }

  const now = new Date().toISOString();
  let claimToken: string | null = null;
  if (existing) {
    // ❤ 부터 지운다 — 트리거가 숫자를 따라 내리고, 아래에서 0 으로 못박는다.
    await service.from("weekly_likes").delete().eq("entry_id", id);
    const { error } = await service
      .from("weekly_entries")
      .update({
        audio_path: path,
        duration_s: duration,
        bars,
        ...(avatar && !user ? { avatar } : {}),
        // 손님이 닉네임을 비우고 교체하면 다시 익명이다 — 예전 이름을 남겨 두지 않는다.
        ...(user ? {} : { guest_name: name ?? guestName(client) }),
        like_count: 0,
        play_count: 0,
        updated_at: now,
      })
      .eq("id", id);
    if (error) {
      await service.storage.from("recordings").remove([path]);
      return Response.json({ error: t("바꾸지 못했어요. 다시 해주세요.", "Couldn't replace. Please try again.") }, { status: 500 });
    }
    await service.storage.from("recordings").remove([existing.audio_path]);
    claimToken = existing.claim_token;
  } else {
    claimToken = user ? null : randomUUID();
    const { error } = await service.from("weekly_entries").insert({
      id,
      challenge_id: week.id,
      user_id: user?.id ?? null,
      owner,
      claim_token: claimToken,
      guest_name: user ? null : (name ?? guestName(client)),
      avatar: avatar ?? {},
      audio_path: path,
      duration_s: duration,
      bars,
      created_at: now,
      updated_at: now,
    });
    if (error) {
      await service.storage.from("recordings").remove([path]);
      // 동시에 두 번 눌러 1인 1작품 제약에 걸린 경우
      const dup = error.code === "23505";
      return Response.json(
        { error: dup ? t("이미 출전했어요. 새로고침하고 다시 해주세요.", "Already entered. Refresh and try again.") : t("출전하지 못했어요. 다시 해주세요.", "Couldn't enter. Please try again.") },
        { status: dup ? 409 : 500 },
      );
    }
  }

  const board = await getBoard(week);
  const me = board.entries.find((e) => e.id === id);
  return Response.json({
    id,
    token: claimToken,
    replaced: Boolean(existing),
    rank: me?.rank ?? board.entries.length,
    total: board.entries.length,
  });
}

/** 내리기 — 로그인 출전은 본인 계정, 게스트는 열쇠로. 기간이 끝나도 언제든 지울 수 있다. */
export async function DELETE(req: Request) {
  const t = requestT(req);
  const q = new URL(req.url).searchParams;
  const id = q.get("id") ?? "";
  const token = q.get("token") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: t("잘못된 요청이에요.", "Invalid request.") }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const service = createServiceClient();
  const { data: e } = await service
    .from("weekly_entries")
    .select("id, user_id, claim_token, audio_path")
    .eq("id", id)
    .maybeSingle();
  if (!e) return Response.json({ ok: true });
  const mine = (user && e.user_id === user.id) || (!!token && e.claim_token === token);
  if (!mine) return Response.json({ error: t("내 출전작만 내릴 수 있어요.", "You can only withdraw your own entry.") }, { status: 403 });

  const { error } = await service.from("weekly_entries").delete().eq("id", id);
  if (error) return Response.json({ error: t("내리지 못했어요. 다시 해주세요.", "Couldn't remove. Please try again.") }, { status: 500 });
  await service.storage.from("recordings").remove([e.audio_path]);
  return Response.json({ ok: true });
}
