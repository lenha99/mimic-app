import { createServiceClient } from "@/lib/supabase/service";
import { notify } from "@/lib/notify-server";
import { keysOf, statsFor } from "@/lib/pass-server";
import { levelOf, xpOf } from "@/lib/pass";
import { guestName } from "@/lib/weekly";
import { RELAY_STOCK } from "@/lib/relay-stock";
import {
  computeFinal,
  isBranch,
  LATE_MS,
  MAX_LATE_ROLES,
  premiereAt,
  type Assignment,
  type FinalCut,
  type Hall,
  type LineView,
  type RelayRole,
  type RoleOwner,
  type RoleType,
  type SceneView,
  type TakeView,
} from "@/lib/relay";
import type { Json } from "@/types/database";

/**
 * 릴레이 더빙 — 서버 전용. 상영 일정 · 장면 조회 · 개봉 · 배역 배정 · 계급 판정.
 *
 * 일정은 크론(/api/cron/relay, 매일 21시 KST)과 화면 조회(ensureSchedule) 둘 다에서 돈다.
 * 크론이 한 번 빠져도 누가 허브를 열면 개봉·다음 장면 열기가 일어난다. 둘이 겹쳐도
 * 상태 전환은 "where status = …" 조건부 갱신이고 상영관당 상영 중은 유일 인덱스로 하나라 안전하다.
 */
type Service = ReturnType<typeof createServiceClient>;

export type Viewer = { userId: string | null; client: string | null; keys: string[] };

export function viewerOf(userId: string | null, client: string | null): Viewer {
  const c = client && /^[a-z0-9]{8,40}$/.test(client) ? client : null;
  return { userId, client: c, keys: keysOf(userId, c) };
}
export const ownerOf = (v: Viewer) => (v.userId ? `u:${v.userId}` : v.client ? `g:${v.client}` : null);

export async function levelFor(v: Viewer, service: Service = createServiceClient()): Promise<number> {
  if (!v.keys.length) return 1;
  return levelOf(xpOf(await statsFor(v.keys, service)));
}

export async function displayName(v: Viewer, formName: string | null, service: Service = createServiceClient()): Promise<string> {
  if (v.userId) {
    const { data } = await service.from("profiles").select("nickname").eq("id", v.userId).maybeSingle();
    if (data?.nickname) return data.nickname;
  }
  return formName || (v.client ? guestName(v.client) : "익명의 배우");
}

// ---- 장면 조회 ----

type SceneRow = {
  id: string;
  hall: Hall;
  stock_key: string | null;
  title: string;
  logline: string;
  genre: string;
  roles: Json;
  director: string | null;
  director_name: string | null;
  prompt_id: string | null;
  mode: "normal" | "chaos";
  status: SceneView["status"];
  opens_at: string | null;
  premiere_at: string | null;
  final: Json | null;
  listens: number;
  best_week: string | null;
};
const SCENE_COLS = "id, hall, stock_key, title, logline, genre, roles, director, director_name, prompt_id, mode, status, opens_at, premiere_at, final, listens, best_week";

export async function loadScene(id: string, v: Viewer | null, service: Service = createServiceClient()): Promise<SceneView | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data: s } = await service.from("relay_scenes").select(SCENE_COLS).eq("id", id).maybeSingle();
  if (!s) return null;
  return hydrate([s as SceneRow], v, service).then((x) => x[0] ?? null);
}

async function hydrate(rows: SceneRow[], v: Viewer | null, service: Service): Promise<SceneView[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const [lines, takes, roles, casts, sfx] = await Promise.all([
    service.from("relay_lines").select("id, scene_id, n, role, text, dir, tip, tts, sec, candidate, twist, author, author_name, won, created_at").in("scene_id", ids).eq("hidden", false).order("n").order("created_at"),
    service.from("relay_takes").select("id, scene_id, line_id, owner, name, avatar, kind, stamp, direction, duration_s, created_at").in("scene_id", ids).eq("hidden", false).order("created_at"),
    service.from("relay_roles").select("scene_id, role, owner, late, priority_until").in("scene_id", ids),
    service.from("relay_casts").select("scene_id, role, owner").in("scene_id", ids),
    service.from("relay_sfx").select("scene_id, after_n, sfx").in("scene_id", ids),
  ]);
  const promptIds = rows.map((r) => r.prompt_id).filter((x): x is string => !!x);
  const prompts = promptIds.length ? ((await service.from("relay_prompts").select("id, text, name").in("id", promptIds)).data ?? []) : [];
  const mine = new Set(v?.keys ?? []);
  const nameOf = new Map<string, string>();
  for (const t of takes.data ?? []) nameOf.set(`${t.scene_id}|${t.owner}`, t.name);

  return rows.map((r) => {
    const p = prompts.find((x) => x.id === r.prompt_id);
    const ls: LineView[] = (lines.data ?? [])
      .filter((l) => l.scene_id === r.id)
      .map((l) => ({
        id: l.id,
        n: l.n,
        role: l.role,
        text: l.text,
        dir: l.dir,
        tip: l.tip,
        tts: l.tts,
        sec: l.sec,
        candidate: l.candidate,
        twist: l.twist,
        authorName: l.author_name,
        mineAuthor: !!l.author && mine.has(l.author),
        won: l.won,
        at: l.created_at,
      }));
    const ts: TakeView[] = (takes.data ?? [])
      .filter((t) => t.scene_id === r.id)
      .map((t) => ({
        id: t.id,
        lineId: t.line_id,
        owner: t.owner,
        name: t.name,
        avatar: (t.avatar ?? {}) as Record<string, string>,
        kind: t.kind,
        stamp: t.stamp,
        direction: t.direction,
        sec: t.duration_s,
        at: t.created_at,
        mine: mine.has(t.owner),
      }));
    const os: RoleOwner[] = (roles.data ?? [])
      .filter((o) => o.scene_id === r.id)
      .map((o) => ({ role: o.role, owner: o.owner, name: nameOf.get(`${r.id}|${o.owner}`) ?? "", late: o.late, priorityUntil: o.priority_until, mine: mine.has(o.owner) }));
    return {
      id: r.id,
      hall: r.hall,
      stockKey: r.stock_key,
      title: r.title,
      logline: r.logline,
      genre: r.genre,
      roles: (r.roles ?? []) as unknown as RelayRole[],
      directorName: r.director_name,
      promptText: p?.text ?? null,
      promptName: p?.name ?? null,
      mode: r.mode,
      status: r.status,
      opensAt: r.opens_at,
      premiereAt: r.premiere_at,
      listens: r.listens,
      bestWeek: r.best_week,
      lines: ls,
      takes: ts,
      owners: os,
      casts: (casts.data ?? []).filter((c) => c.scene_id === r.id).map((c) => ({ role: c.role, owner: c.owner, mine: mine.has(c.owner) })),
      sfx: (sfx.data ?? []).filter((x) => x.scene_id === r.id).map((x) => ({ afterN: x.after_n, sfx: x.sfx })),
      final: (r.final ?? null) as unknown as FinalCut | null,
      amDirector: !!r.director && mine.has(r.director),
    };
  });
}

/** 공개용 — 남의 기기 이름표(owner)는 지운다. 내 것인지는 mine 으로만 알려 준다. */
export function publicView(s: SceneView): SceneView {
  const mask = (o: string) => (o.startsWith("u:") || o.startsWith("g:") ? hash(o) : o);
  return {
    ...s,
    takes: s.takes.map((t) => ({ ...t, owner: mask(t.owner) })),
    owners: s.owners.map((o) => ({ ...o, owner: mask(o.owner) })),
    casts: s.casts.map((c) => ({ ...c, owner: mask(c.owner) })),
    final: s.final ? { ...s.final, lines: s.final.lines.map((l) => ({ ...l, owner: l.owner ? mask(l.owner) : null })) } : null,
  };
}
function hash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return "p" + (h >>> 0).toString(36);
}

// ---- 일정 ----

let lastRun = 0;

/** 개봉할 장면 개봉 · 빈 상영관 채우기 · 이주의 명작. 화면 조회마다 부르되 인스턴스당 30초에 한 번만. */
export async function ensureSchedule(service: Service = createServiceClient(), force = false): Promise<void> {
  if (!force && Date.now() - lastRun < 30_000) return;
  lastRun = Date.now();
  try {
    const { data: due } = await service.from("relay_scenes").select("id").eq("status", "live").lte("premiere_at", new Date().toISOString());
    for (const d of due ?? []) await premiere(d.id, service);
    const { data: live } = await service.from("relay_scenes").select("hall").eq("status", "live");
    const open = new Set((live ?? []).map((r) => r.hall));
    for (const hall of ["act", "real"] as Hall[]) if (!open.has(hall)) await openNext(hall, service);
    await awardBestOfWeek(service);
  } catch (e) {
    console.error("relay schedule", e);
  }
}

async function openNext(hall: Hall, service: Service): Promise<void> {
  const now = Date.now();
  const opens = new Date(now).toISOString();
  const prem = new Date(premiereAt(now)).toISOString();
  // 1) 감독이 만든 장면 — 승인된 것부터, 먼저 만든 순
  const { data: queued } = await service.from("relay_scenes").select("id").eq("status", "queued").eq("hall", hall).order("created_at").limit(1);
  if (queued?.[0]) {
    await service.from("relay_scenes").update({ status: "live", opens_at: opens, premiere_at: prem }).eq("id", queued[0].id).eq("status", "queued");
    return;
  }
  // 2) 비축 장면 — 가장 적게 상영된 것(무효는 안 셈), 같으면 가장 오래전에 연 것. 다 돌면 앙코르.
  const stock = RELAY_STOCK.filter((s) => s.hall === hall);
  if (!stock.length) return;
  const { data: past } = await service.from("relay_scenes").select("stock_key, status, created_at").not("stock_key", "is", null).limit(2000);
  const runs = new Map<string, { n: number; last: string }>();
  for (const p of past ?? []) {
    const r = runs.get(p.stock_key!) ?? { n: 0, last: "" };
    if (p.status !== "void") r.n += 1;
    if (p.created_at > r.last) r.last = p.created_at;
    runs.set(p.stock_key!, r);
  }
  const order = stock.map((s, i) => ({ s, i, r: runs.get(s.key) ?? { n: 0, last: "" } }));
  order.sort((a, b) => a.r.n - b.r.n || a.r.last.localeCompare(b.r.last) || a.i - b.i);
  const pick = order[0].s;
  const { data: scene, error } = await service
    .from("relay_scenes")
    .insert({
      hall,
      stock_key: pick.key,
      title: pick.title,
      logline: pick.logline,
      genre: pick.genre,
      roles: pick.roles as unknown as Json,
      director_name: null,
      status: "live",
      opens_at: opens,
      premiere_at: prem,
    })
    .select("id")
    .single();
  if (error || !scene) return; // 동시에 다른 요청이 먼저 열었다(유일 인덱스)
  await service.from("relay_lines").insert(
    pick.lines.map((l) => ({ scene_id: scene.id, n: l.n, role: l.role, text: l.text, dir: l.dir, tip: l.tip, tts: l.tts, sec: l.sec })),
  );
}

/** 개봉 — 정식판 박제 · 갈림길 채택 표시 · 출연자 알림. 진짜 배우가 0명이면 무효로 돌려 비축에 남긴다. */
export async function premiere(id: string, service: Service = createServiceClient()): Promise<void> {
  const { data: claimed } = await service
    .from("relay_scenes")
    .update({ status: "premiered" })
    .eq("id", id)
    .eq("status", "live")
    .select("id");
  if (!claimed?.length) return; // 다른 요청이 이미 개봉했다
  const s = await loadScene(id, null, service);
  if (!s) return;
  const final = computeFinal(s);
  const writtenByPeople = s.lines.some((l) => l.candidate);
  if (final.realActors === 0 && !writtenByPeople && s.stockKey) {
    await service.from("relay_scenes").update({ status: "void", final: final as unknown as Json }).eq("id", id);
    return;
  }
  await service.from("relay_scenes").update({ final: final as unknown as Json, real_actors: final.realActors }).eq("id", id);
  const won = [...final.lines.filter((l) => l.candidate).map((l) => l.lineId), ...(final.twist ? [final.twist.lineId] : [])];
  if (won.length) await service.from("relay_lines").update({ won: true }).in("id", won);

  // 알림 — 출연자 · 작가 · 감독. 한 사람에게 한 번.
  const { data: takeOwners } = await service.from("relay_takes").select("owner, user_id").eq("scene_id", id);
  const { data: authors } = await service.from("relay_lines").select("author, author_user").eq("scene_id", id).eq("candidate", true);
  const { data: dir } = await service.from("relay_scenes").select("director, director_user").eq("id", id).maybeSingle();
  const people = new Map<string, string | null>();
  for (const t of takeOwners ?? []) people.set(t.owner, t.user_id);
  for (const a of authors ?? []) if (a.author) people.set(a.author, a.author_user);
  if (dir?.director) people.set(dir.director, dir.director_user);
  for (const [owner, userId] of people) {
    await notify({
      userId: userId ?? (owner.startsWith("u:") ? owner.slice(2) : null),
      client: owner.startsWith("g:") ? owner.slice(2) : null,
      kind: "relay_premiere",
      sceneId: id,
      push: { title: "🎬 개봉!", body: `출연작 「${s.title}」이 개봉했어요. 크레딧에 이름이 올랐어요`, url: `/relay/s/${id}/premiere`, tag: "relay" },
      pushKey: `relay-premiere:${id}:${owner}`,
    });
  }
}

/** 지난주(월~일, KST) 개봉작 중 끝까지 들은 수가 가장 많은 장면 → 이주의 명작. 참여자 전원 +30 XP(pass-server). */
async function awardBestOfWeek(service: Service): Promise<void> {
  const week = weekId(Date.now() - 7 * 86_400_000);
  const { data: done } = await service.from("relay_scenes").select("id").eq("best_week", week).limit(1);
  if (done?.length) return;
  const [from, to] = weekRange(Date.now() - 7 * 86_400_000);
  const { data: cands } = await service
    .from("relay_scenes")
    .select("id, listens")
    .eq("status", "premiered")
    .gte("premiere_at", new Date(from).toISOString())
    .lt("premiere_at", new Date(to).toISOString())
    .gt("real_actors", 0)
    .order("listens", { ascending: false })
    .limit(1);
  if (cands?.[0] && cands[0].listens > 0) await service.from("relay_scenes").update({ best_week: week }).eq("id", cands[0].id);
}

function weekRange(at: number): [number, number] {
  const kst = new Date(at + 9 * 3600_000);
  const dow = (kst.getUTCDay() + 6) % 7; // 월=0
  const mon = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - dow) - 9 * 3600_000;
  return [mon, mon + 7 * 86_400_000];
}
export function weekId(at: number): string {
  const [mon] = weekRange(at);
  return "rw" + new Date(mon + 9 * 3600_000).toISOString().slice(0, 10).replaceAll("-", "");
}

// ---- 허브 ----

export async function liveScenes(v: Viewer | null, service: Service = createServiceClient()): Promise<SceneView[]> {
  await ensureSchedule(service);
  const { data } = await service.from("relay_scenes").select(SCENE_COLS).eq("status", "live").order("hall");
  return hydrate((data ?? []) as SceneRow[], v, service);
}

export async function premieredScenes(limit: number, service: Service = createServiceClient()): Promise<SceneRow[]> {
  const { data } = await service.from("relay_scenes").select(SCENE_COLS).eq("status", "premiered").order("premiere_at", { ascending: false }).limit(limit);
  return (data ?? []) as SceneRow[];
}

export async function bestOfWeek(service: Service = createServiceClient()): Promise<SceneRow | null> {
  const { data } = await service.from("relay_scenes").select(SCENE_COLS).not("best_week", "is", null).order("best_week", { ascending: false }).limit(1);
  return ((data ?? [])[0] as SceneRow | undefined) ?? null;
}

/** 홈 카드용 가벼운 요약 — 상영 중 장면, 사람 목소리가 들어간 줄 수 */
/** 홈 카드용 — 읽기만 한다(정적 페이지를 그리는 중에 개봉·열기 같은 쓰기를 하지 않는다). */
export async function liveSummary(service: Service = createServiceClient()): Promise<{ id: string; hall: Hall; title: string; premiereAt: string | null; voiced: number; actors: number; roles: number }[]> {
  const { data: scenes } = await service.from("relay_scenes").select("id, hall, title, premiere_at, roles").eq("status", "live").order("hall");
  if (!scenes?.length) return [];
  const { data: takes } = await service.from("relay_takes").select("scene_id, line_id, owner").in("scene_id", scenes.map((s) => s.id)).eq("kind", "line").eq("hidden", false);
  return scenes.map((s) => {
    const ts = (takes ?? []).filter((t) => t.scene_id === s.id);
    return {
      id: s.id,
      hall: s.hall,
      title: s.title,
      premiereAt: s.premiere_at,
      voiced: new Set(ts.map((t) => t.line_id)).size,
      actors: new Set(ts.map((t) => t.owner)).size,
      roles: Array.isArray(s.roles) ? s.roles.length : 0,
    };
  });
}

// ---- 배역 배정 ----


/**
 * 다음에 녹음할 줄을 앱이 정해 준다 — 사용자는 고르지 않는다.
 * 순서: 지명받은 배역 > 내 배역의 남은 줄 > 계열이 맞는 빈 배역 > 아무 빈 배역 > 갈림길 투표 > (막판) 두 번째 배역
 */
export function assign(scenes: SceneView[], v: Viewer, pref: RoleType | null, skip: string[] = [], now = Date.now()): Assignment | null {
  const keys = new Set(v.keys);
  const done = (s: SceneView, lineId: string) => s.takes.some((t) => t.lineId === lineId && t.kind === "line" && keys.has(t.owner));
  const lineFor = (s: SceneView, role: string, onlyEmpty = false) => {
    for (let n = 1; n <= 10; n++) {
      const base = s.lines.find((l) => l.n === n && !l.candidate && l.role === role);
      if (!base) continue;
      // 갈림길 자리는 지금 1위 후보(없으면 기본)
      const cands = isBranch(n) ? s.lines.filter((l) => l.n === n && l.candidate && !l.twist && l.role === role) : [];
      const target = cands.length ? [...cands].sort((a, b) => votesOf(s, b.id) - votesOf(s, a.id) || a.at.localeCompare(b.at))[0] : base;
      if (done(s, target.id)) continue;
      if (onlyEmpty && s.takes.some((t) => t.lineId === target.id && t.kind === "line")) continue;
      return target;
    }
    return null;
  };
  const order = [...scenes].filter((s) => s.status === "live");
  // 계열이 맞는 상영관을 먼저
  if (pref) order.sort((a, b) => Number(b.roles.some((r) => r.type === pref)) - Number(a.roles.some((r) => r.type === pref)));

  for (const s of order) {
    const myRoles = s.owners.filter((o) => keys.has(o.owner)).map((o) => o.role);
    // 1) 지명
    for (const c of s.casts.filter((c) => keys.has(c.owner) && !skip.includes(`${s.id}:${c.role}`))) {
      const owner = s.owners.find((o) => o.role === c.role);
      if (owner && !keys.has(owner.owner)) continue;
      if (!owner && myRoles.length) continue;
      const l = lineFor(s, c.role);
      if (l) return { sceneId: s.id, lineId: l.id, role: c.role, reason: "cast" };
    }
    // 2) 내 배역의 남은 줄
    for (const role of myRoles) {
      const l = lineFor(s, role);
      if (l) return { sceneId: s.id, lineId: l.id, role, reason: "mine" };
    }
  }
  for (const s of order) {
    const myRoles = s.owners.filter((o) => keys.has(o.owner)).map((o) => o.role);
    if (myRoles.length) continue;
    // 3·4) 빈 배역 — 계열이 맞는 것부터
    const free = s.roles.filter((r) => !s.owners.some((o) => o.role === r.id) && !skip.includes(`${s.id}:${r.id}`));
    free.sort((a, b) => Number(b.type === pref) - Number(a.type === pref));
    for (const r of free) {
      const l = lineFor(s, r.id);
      if (l) return { sceneId: s.id, lineId: l.id, role: r.id, reason: "open" };
    }
    // 우선권이 끝난 배역의 빈 줄
    for (const o of s.owners.filter((o) => new Date(o.priorityUntil).getTime() < now && !skip.includes(`${s.id}:${o.role}`))) {
      const l = lineFor(s, o.role, true);
      if (l) return { sceneId: s.id, lineId: l.id, role: o.role, reason: "free" };
    }
  }
  for (const s of order) {
    // 5) 갈림길 투표 — 아직 내가 녹음 안 한 후보
    const c = s.lines.find((l) => l.candidate && !done(s, l.id) && !skip.includes(`${s.id}:${l.role}`));
    if (c) return { sceneId: s.id, lineId: c.id, role: c.role, reason: "vote" };
  }
  for (const s of order) {
    // 6) 막판 캐스팅 — 개봉 24시간 전, 빈 배역에 두 번째 배역
    if (!s.premiereAt || new Date(s.premiereAt).getTime() - now > LATE_MS) continue;
    const mine = s.owners.filter((o) => keys.has(o.owner)).length;
    if (mine >= MAX_LATE_ROLES) continue;
    const free = s.roles.filter((r) => !s.owners.some((o) => o.role === r.id) && !skip.includes(`${s.id}:${r.id}`));
    for (const r of free) {
      const l = lineFor(s, r.id);
      if (l) return { sceneId: s.id, lineId: l.id, role: r.id, reason: "late" };
    }
  }
  return null;
}

function votesOf(s: SceneView, lineId: string): number {
  return new Set(s.takes.filter((t) => t.lineId === lineId && t.kind === "line").map((t) => t.owner)).size;
}

// ---- 녹음 규칙 ----

export type RoleCheck = { ok: true; claim: boolean; late: boolean } | { ok: false; status: number; ko: string; en: string };

/** 이 사람이 이 줄을 녹음해도 되나 — 1인 1배역 · 우선권 · 막판 캐스팅 */
export function checkRole(s: SceneView, line: LineView, v: Viewer, now = Date.now()): RoleCheck {
  if (s.status !== "live") return { ok: false, status: 409, ko: "이 장면은 이미 개봉했어요.", en: "This scene has already premiered." };
  const keys = new Set(v.keys);
  // 갈림길 후보 녹음은 투표 겸 오디션 — 배역 제한 없음
  if (line.candidate) return { ok: true, claim: false, late: false };
  const owner = s.owners.find((o) => o.role === line.role);
  if (owner) {
    if (keys.has(owner.owner)) return { ok: true, claim: false, late: false };
    if (new Date(owner.priorityUntil).getTime() > now) {
      return { ok: false, status: 409, ko: `이 배역은 ${owner.name || "다른 배우"}님이 맡았어요. 다른 줄을 해 볼까요?`, en: "Someone already took this role. Try another line?" };
    }
    // 우선권이 끝났으면 빈 줄은 누구나 — 배역 주인은 그대로
    const filled = s.takes.some((t) => t.lineId === line.id && t.kind === "line");
    if (filled) return { ok: false, status: 409, ko: "이 줄은 이미 다른 배우가 녹음했어요.", en: "Someone already recorded this line." };
    const mineRoles = s.owners.filter((o) => keys.has(o.owner)).length;
    if (mineRoles >= 1 && !lateWindow(s, now)) return { ok: false, status: 409, ko: "한 장면에서는 배역 하나만 맡을 수 있어요.", en: "One role per scene." };
    return { ok: true, claim: false, late: false };
  }
  const mineRoles = s.owners.filter((o) => keys.has(o.owner)).length;
  if (mineRoles === 0) return { ok: true, claim: true, late: false };
  if (lateWindow(s, now) && mineRoles < MAX_LATE_ROLES) return { ok: true, claim: true, late: true };
  return {
    ok: false,
    status: 409,
    ko: "한 장면에서는 배역 하나만 맡을 수 있어요. 개봉 하루 전부터 빈 배역이 있으면 하나 더 맡을 수 있어요.",
    en: "One role per scene. From a day before the premiere you can take one more empty role.",
  };
}
function lateWindow(s: SceneView, now: number): boolean {
  return !!s.premiereAt && new Date(s.premiereAt).getTime() - now <= LATE_MS;
}

// ---- 금칙어 ----

const BANNED = ["씨발", "시발", "병신", "좆", "개새", "니미", "느금", "애미", "애비", "섹스", "fuck", "shit", "bitch", "ㅅㅂ", "ㅂㅅ", "지랄", "꺼져", "한남", "한녀", "틀딱", "자살"];
export function badText(s: string): boolean {
  const t = s.toLowerCase().replace(/\s+/g, "");
  return BANNED.some((w) => t.includes(w));
}
export function cleanLine(raw: unknown, max: number): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  if (s.length < 2 || s.length > max) return null;
  return s;
}
