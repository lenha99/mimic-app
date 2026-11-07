import { isAdmin } from "@/lib/admin";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { createServiceClient } from "@/lib/supabase/service";
import { requestT } from "@/lib/i18n";
import { can, GENRES, MAX_LINE_CHARS, scenesPerWeek, type RoleType } from "@/lib/relay";
import { badText, cleanLine, displayName, levelFor } from "@/lib/relay-server";
import { ttsForLine, VOICE_PRESETS } from "@/lib/relay-tts";
import { json, requestViewer } from "@/lib/relay-req";
import type { Json } from "@/types/database";

export const maxDuration = 60;

const TYPES: RoleType[] = ["anime", "actor", "announcer", "speech", "everyday"];

/** 감독 스튜디오 — 내 장면 · (운영자) 승인 대기 · 고를 수 있는 상황 신청 */
export async function GET(req: Request) {
  const v = await requestViewer(new URL(req.url).searchParams.get("client"));
  const service = createServiceClient();
  const level = await levelFor(v, service);
  const admin = await isAdmin();
  const mine = v.userId
    ? ((await service.from("relay_scenes").select("id, title, status, hall, genre, premiere_at, real_actors, listens, created_at").eq("director", `u:${v.userId}`).order("created_at", { ascending: false }).limit(30)).data ?? [])
    : [];
  const pending = admin
    ? ((await service.from("relay_scenes").select("id, title, status, hall, genre, director_name, logline, created_at").eq("status", "pending").order("created_at").limit(30)).data ?? [])
    : [];
  const prompts = (await service.from("relay_prompts").select("id, text, name, created_at").is("scene_id", null).eq("hidden", false).order("created_at", { ascending: false }).limit(30)).data ?? [];
  return json({ level, admin, loggedIn: Boolean(v.userId), mine, pending, prompts });
}

type Body = {
  client?: string;
  title?: string;
  logline?: string;
  genre?: string;
  mode?: string;
  promptId?: string;
  roles?: { name?: string; type?: string; voice?: string }[];
  lines?: { role?: number; text?: string; dir?: string }[];
};

/**
 * 감독 — 새 장면 열기. ICON(LV7) · 로그인 · 한 주 1편(LEGEND 2편). 줄마다 배역 목소리로 TTS 를 만든다.
 * 운영자·이미 두 편 이상 상영한 감독은 바로 상영 대기(queued), 그 밖엔 운영자 승인 대기(pending).
 */
export async function POST(req: Request) {
  const t = requestT(req);
  if (!allow(`relay-scene:${clientIp(req)}`, 6, 3_600_000)) return tooMany(t("잠시 뒤에 다시 해 주세요.", "Try again later."));
  const b = (await req.json().catch(() => ({}))) as Body;
  const v = await requestViewer(b.client);
  const admin = await isAdmin();
  if (!v.userId && !admin) return json({ error: t("장면을 열려면 로그인해 주세요.", "Log in to open scenes."), needLogin: true }, 401);
  const service = createServiceClient();
  const level = await levelFor(v, service);
  if (!admin && !can.direct(level)) return json({ error: t("장면 열기는 ICON(LV7) 감독부터예요.", "Opening scenes unlocks at LV7.") }, 403);
  const director = v.userId ? `u:${v.userId}` : "admin";

  if (!admin) {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { count } = await service.from("relay_scenes").select("id", { count: "exact", head: true }).eq("director", director).gte("created_at", since);
    if ((count ?? 0) >= scenesPerWeek(level)) return json({ error: t(`장면은 한 주에 ${scenesPerWeek(level)}편까지 열 수 있어요.`, `Up to ${scenesPerWeek(level)} scenes a week.`) }, 429);
  }

  const title = cleanLine(b.title, 30);
  const logline = cleanLine(b.logline, 80) ?? "";
  const genre = GENRES.find((g) => g.id === b.genre);
  if (!title || !genre) return json({ error: t("제목과 장르를 정해 주세요.", "Title and genre are required.") }, 400);
  const roles = (b.roles ?? []).slice(0, 4).map((r, i) => ({
    id: `r${i + 1}`,
    name: cleanLine(r.name, 12) ?? "",
    type: (TYPES.includes(r.type as RoleType) ? r.type : "actor") as RoleType,
    voice: VOICE_PRESETS[String(r.voice)] ? String(r.voice) : "m_calm",
    desc: "",
  }));
  if (roles.length < 2 || roles.some((r) => !r.name)) return json({ error: t("배역은 2~4명, 이름을 모두 정해 주세요.", "2–4 named roles.") }, 400);
  const lines = (b.lines ?? []).slice(0, 10).map((l, i) => ({
    n: i + 1,
    role: roles[Number(l.role)]?.id ?? "",
    text: cleanLine(l.text, MAX_LINE_CHARS) ?? "",
    dir: cleanLine(l.dir, 20) ?? "",
  }));
  if (lines.length !== 10 || lines.some((l) => !l.role || !l.text)) return json({ error: t("대사 10줄을 모두 채워 주세요.", "Fill all 10 lines.") }, 400);
  const used = new Set(lines.map((l) => l.role));
  if (roles.some((r) => !used.has(r.id))) return json({ error: t("모든 배역에 대사가 하나 이상 있어야 해요.", "Every role needs a line.") }, 400);
  if (badText([title, logline, ...roles.map((r) => r.name), ...lines.map((l) => l.text + l.dir)].join(" "))) {
    return json({ error: t("쓸 수 없는 말이 들어 있어요.", "Blocked words found.") }, 400);
  }

  let promptId: string | null = null;
  if (b.promptId && /^[0-9a-f-]{36}$/.test(b.promptId)) {
    const { data: p } = await service.from("relay_prompts").select("id").eq("id", b.promptId).is("scene_id", null).maybeSingle();
    promptId = p?.id ?? null;
  }
  let status: "queued" | "pending" = "pending";
  if (admin) status = "queued";
  else {
    const { count } = await service.from("relay_scenes").select("id", { count: "exact", head: true }).eq("director", director).in("status", ["queued", "live", "premiered"]);
    if ((count ?? 0) >= 2) status = "queued";
  }
  const name = admin && !v.userId ? "코코 PD" : await displayName(v, null, service);
  const { data: scene, error } = await service
    .from("relay_scenes")
    .insert({
      hall: genre.hall,
      title,
      logline,
      genre: genre.id,
      roles: roles as unknown as Json,
      director,
      director_user: v.userId,
      director_name: name,
      prompt_id: promptId,
      mode: b.mode === "chaos" ? "chaos" : "normal",
      status,
    })
    .select("id")
    .single();
  if (error || !scene) return json({ error: t("장면을 만들지 못했어요.", "Couldn't create the scene.") }, 500);
  const { data: rows } = await service
    .from("relay_lines")
    .insert(lines.map((l) => ({ scene_id: scene.id, n: l.n, role: l.role, text: l.text, dir: l.dir, tip: "", sec: Math.max(2, l.text.length * 0.18) })))
    .select("id, role, text");
  if (promptId) await service.from("relay_prompts").update({ scene_id: scene.id }).eq("id", promptId);
  // TTS — 동시에 셋씩
  const todo = rows ?? [];
  for (let i = 0; i < todo.length; i += 3) {
    await Promise.all(
      todo.slice(i, i + 3).map(async (r) => {
        const voice = roles.find((x) => x.id === r.role)?.voice ?? "m_calm";
        const tts = await ttsForLine(r.id, r.text, voice);
        if (tts) await service.from("relay_lines").update({ tts: tts.path, sec: tts.sec }).eq("id", r.id);
      }),
    );
  }
  return json({ id: scene.id, status });
}
