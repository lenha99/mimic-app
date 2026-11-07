import { createServiceClient } from "@/lib/supabase/service";
import { notify, once, ownerTarget } from "@/lib/notify-server";
import { EMPTY_STATS, FOLLOW_STEPS, LIKE_STEPS, RELAY_XP, SOLO_XP, type PassStats } from "@/lib/pass";

/** 한국 날짜 'YYYY-MM-DD' — 연속 기록은 KST 자정에 넘어간다. */
export function kstDay(at: number = Date.now(), offsetDays = 0): string {
  return new Date(at + 9 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** 연습한 날들 → 오늘(또는 어제)까지 이어진 연속 일수. 어제까지 했고 오늘 아직이면 이어진 걸로 본다. */
export function streakOf(days: Set<string>, at: number = Date.now()): number {
  const start = days.has(kstDay(at)) ? 0 : days.has(kstDay(at, -1)) ? -1 : null;
  if (start === null) return 0;
  let n = 0;
  while (days.has(kstDay(at, start - n))) n++;
  return n;
}

/**
 * VOICE PASS 숫자 · 단계 알림 — 서버 전용. 표를 새로 만들지 않고 있는 숫자만 센다.
 * 알림은 단계마다 딱 한 번(notif_sent 키). 실패해도 ❤ · 구독 · 픽은 그대로 된다.
 */
type Service = ReturnType<typeof createServiceClient>;

/** 이 사람(계정 · 기기)의 이름표들 — 'u:<id>' · 'g:<기기>' */
export function keysOf(userId: string | null, client: string | null): string[] {
  return [userId ? `u:${userId}` : null, client ? `g:${client}` : null].filter((k): k is string => !!k);
}

/** 주인 이름표 — 로그인 출전작은 계정으로 묶는다 */
export const whoOwns = (e: { owner: string; user_id: string | null }) => (e.user_id ? `u:${e.user_id}` : e.owner);

/**
 * 여러 사람의 숫자를 한 번에 — 갤러리처럼 목소리 수십 개를 그릴 때.
 * people: 사람마다 이름표 묶음(같은 사람의 u:/g: 를 함께 넘기면 합쳐 센다). 결과 키는 묶음의 첫 이름표.
 */
export async function statsBatch(people: string[][], service: Service = createServiceClient()): Promise<Map<string, PassStats>> {
  const out = new Map<string, PassStats>();
  const groups = people.filter((g) => g.length);
  if (!groups.length) return out;
  const keyOf = new Map<string, string>();
  for (const g of groups) for (const k of g) keyOf.set(k, g[0]);
  const keys = [...keyOf.keys()];
  const users = keys.filter((k) => k.startsWith("u:")).map((k) => k.slice(2));
  try {
    const [entries, fans, given, picks, solo, dex, fb] = await Promise.all([
      service.from("weekly_entries").select("owner, user_id, like_count, featured_at").eq("hidden", false).limit(5000),
      service.from("follows").select("creator").in("creator", keys).limit(5000),
      service.from("weekly_likes").select("voter").in("voter", keys).limit(20000),
      service.from("weekly_entries").select("id, featured_at").not("featured_at", "is", null).limit(200),
      // 혼자 하는 진행 — 표(마이그레이션 30)가 아직 없으면 error 로 오고 0 으로 본다.
      service.from("solo_days").select("owner, day, takes").in("owner", keys).limit(20000),
      service.from("voice_dex").select("owner, type_id").in("owner", keys).limit(5000),
      // 남긴 피드백(원글) — 로그인해야 쓰니 계정(u:)으로만 센다. 표·컬럼이 아직 없으면 0
      users.length
        ? service.from("entry_notes").select("user_id, entry_id, helpful").eq("kind", "feedback").is("parent_id", null).eq("hidden", false).in("user_id", users).limit(20000)
        : Promise.resolve({ data: [] as { user_id: string; entry_id: string; helpful: boolean }[] }),
    ]);
    const get = (k: string) => {
      const id = keyOf.get(k);
      if (!id) return null;
      if (!out.has(id)) out.set(id, { ...EMPTY_STATS });
      return out.get(id)!;
    };
    for (const e of entries.data ?? []) {
      const s = get(e.user_id && users.includes(e.user_id) ? `u:${e.user_id}` : e.owner) ?? get(e.owner);
      if (!s) continue;
      s.posts += 1;
      s.likesReceived += e.like_count ?? 0;
      if (e.featured_at) s.picked = true;
    }
    for (const f of fans.data ?? []) {
      const s = get(f.creator);
      if (s) s.followers += 1;
    }
    for (const l of given.data ?? []) {
      const s = get(l.voter);
      if (s) s.likesGiven += 1;
    }
    const daysOf = new Map<string, Set<string>>();
    for (const r of solo.data ?? []) {
      const s = get(r.owner);
      if (!s) continue;
      const id = keyOf.get(r.owner)!;
      if (!daysOf.has(id)) daysOf.set(id, new Set());
      const set = daysOf.get(id)!;
      // 같은 사람의 u:/g: 가 같은 날 둘 다 있으면 하루로 센다.
      if (!set.has(r.day)) {
        set.add(r.day);
        s.activeDays += 1;
      }
      s.takes += Math.min(r.takes ?? 0, SOLO_XP.takeCapPerDay);
    }
    for (const [id, set] of daysOf) out.get(id)!.streak = streakOf(set);
    const dexSeen = new Map<string, Set<string>>();
    for (const r of dex.data ?? []) {
      const s = get(r.owner);
      if (!s) continue;
      const id = keyOf.get(r.owner)!;
      if (!dexSeen.has(id)) dexSeen.set(id, new Set());
      const set = dexSeen.get(id)!;
      if (!set.has(r.type_id)) {
        set.add(r.type_id);
        s.dex += 1;
      }
    }
    // 피드백 — 목소리 하나당 한 번(여러 개 써도 +40 한 번), 👍 받은 것은 따로 더
    const fbSeen = new Set<string>();
    for (const r of fb.data ?? []) {
      const s = get(`u:${r.user_id}`);
      if (!s) continue;
      const k = `${keyOf.get(`u:${r.user_id}`)}|${r.entry_id}`;
      if (!fbSeen.has(k)) {
        fbSeen.add(k);
        s.feedbackGiven += 1;
      }
      if (r.helpful) s.feedbackHelpful += 1;
    }
    await relayStats(service, keys, keyOf, get);
    const pk = picks.data ?? [];
    if (pk.length) {
      const { data: early } = await service.from("weekly_likes").select("entry_id, voter, created_at").in("entry_id", pk.map((p) => p.id)).in("voter", keys);
      const at = new Map(pk.map((p) => [p.id, p.featured_at as string]));
      for (const l of early ?? []) {
        if (l.created_at < (at.get(l.entry_id) ?? "")) {
          const s = get(l.voter);
          if (s) s.prophet = true;
        }
      }
    }
  } catch {
    // 숫자를 못 세면 다들 LV.1 로 보일 뿐이다.
  }
  for (const g of groups) if (!out.has(g[0])) out.set(g[0], { ...EMPTY_STATS });
  return out;
}

export async function statsFor(keys: string[], service: Service = createServiceClient()): Promise<PassStats> {
  if (!keys.length) return { ...EMPTY_STATS };
  return (await statsBatch([keys], service)).get(keys[0]) ?? { ...EMPTY_STATS };
}

/** 출전작 주인의 숫자 (공개 화면용) */
export async function statsOfEntryOwner(entryId: string, service: Service = createServiceClient()): Promise<{ stats: PassStats; owner: string } | null> {
  const { data: e } = await service.from("weekly_entries").select("owner, user_id").eq("id", entryId).maybeSingle();
  if (!e) return null;
  const keys = [...new Set([whoOwns(e), e.owner])];
  return { stats: await statsFor(keys, service), owner: e.owner };
}

async function likesOf(owner: string, userId: string | null, service: Service): Promise<number> {
  const q = userId
    ? service.from("weekly_entries").select("like_count").eq("hidden", false).or(`user_id.eq.${userId},owner.eq.${owner}`)
    : service.from("weekly_entries").select("like_count").eq("hidden", false).eq("owner", owner);
  const { data } = await q;
  return (data ?? []).reduce((n, e) => n + (e.like_count ?? 0), 0);
}

const LIKE_PUSH: Record<number, string> = {
  1: "첫 ❤ 도착 — 누군가 당신 목소리에 반했어요. FIRST ❤ 배지가 붙었어요",
  3: "❤ 3개 돌파! 패스 XP 가 쌓이고 있어요",
  10: "❤ 10개 — 갤러리에서 눈에 띄기 시작했어요",
  30: "❤ 30개 — 이 정도면 팬이 생긴 거예요",
  100: "❤ 100개. 레전드의 길이에요",
};

/** ❤ 가 들어간 뒤 — 주인이 단계를 넘었으면 알린다 */
export async function afterLike(entryId: string, service: Service = createServiceClient()): Promise<void> {
  try {
    const { data: e } = await service.from("weekly_entries").select("owner, user_id").eq("id", entryId).maybeSingle();
    if (!e) return;
    const total = await likesOf(e.owner, e.user_id, service);
    const hit = LIKE_STEPS.find((n) => n === total);
    if (!hit || !(await once(`reward:likes:${whoOwns(e)}:${hit}`, service))) return;
    await notify({
      ...ownerTarget(e.owner, e.user_id),
      kind: "reward_likes",
      entryId,
      count: hit,
      push: { title: "MIMIC", body: LIKE_PUSH[hit], url: `/weekly/e/${entryId}`, tag: "pass" },
    });
  } catch {}
}

/** 구독자 수가 단계를 넘었으면 알린다 */
export async function afterFollow(creator: string, total: number, service: Service = createServiceClient()): Promise<void> {
  try {
    const hit = FOLLOW_STEPS.find((n) => n === total);
    if (!hit || !(await once(`reward:fans:${creator}:${hit}`, service))) return;
    const userId = creator.startsWith("u:") ? creator.slice(2) : null;
    await notify({
      userId,
      client: userId ? null : creator.slice(2),
      kind: "reward_follows",
      count: hit,
      push: { title: "MIMIC", body: `구독자 ${hit}명 돌파 — 당신 목소리를 기다리는 사람이 생겼어요`, url: "/pass", tag: "pass" },
    });
  } catch {}
}

/** 운영자 픽 — 주인에게, 그리고 먼저 ❤ 한 사람들(ORACLE)에게 */
export async function afterPick(entryId: string, service: Service = createServiceClient()): Promise<void> {
  try {
    const { data: e } = await service.from("weekly_entries").select("owner, user_id, featured_at").eq("id", entryId).maybeSingle();
    if (!e) return;
    if (await once(`reward:pick:${entryId}`, service)) {
      await notify({
        ...ownerTarget(e.owner, e.user_id),
        kind: "reward_pick",
        entryId,
        push: { title: "PICK", body: "코코가 당신 목소리를 골랐어요. 홈 맨 위 + 스포트라이트 프레임 + PICK 배지", url: `/weekly/e/${entryId}`, tag: "pass" },
      });
    }
    const { data: likes } = await service.from("weekly_likes").select("voter, user_id, created_at").eq("entry_id", entryId).limit(300);
    for (const l of likes ?? []) {
      if (e.featured_at && l.created_at > e.featured_at) continue;
      if (!(await once(`reward:prophet:${l.voter}:${entryId}`, service))) continue;
      await notify({
        ...ownerTarget(l.voter, l.user_id),
        kind: "reward_prophet",
        entryId,
        push: { title: "ORACLE", body: "당신이 먼저 ❤ 한 목소리가 운영자 픽이 됐어요. ORACLE 배지 +50 XP", url: "/pass", tag: "pass" },
      });
    }
  } catch {}
}

/** 이 사람이 지금까지 준 ❤ 수 */
export async function givenBy(keys: string[], service: Service = createServiceClient()): Promise<number> {
  if (!keys.length) return 0;
  const { count } = await service.from("weekly_likes").select("entry_id", { count: "exact", head: true }).in("voter", keys);
  return count ?? 0;
}

/** 도감에 모은 목소리 타입 id 들 (화면용) */
export async function dexOf(keys: string[], service: Service = createServiceClient()): Promise<string[]> {
  if (!keys.length) return [];
  const { data } = await service.from("voice_dex").select("type_id").in("owner", keys).limit(200);
  return [...new Set((data ?? []).map((r) => r.type_id as string))];
}

/**
 * 릴레이 더빙 숫자 (11/8). 표(마이그레이션 36)가 아직 없으면 전부 0 으로 본다.
 * 출연은 장면마다 한 번 · 투표 녹음은 하루 5번 · 작가 수입(남이 내 대사를 연기)은 하루 10명까지 —
 * 같은 사람(이름표 묶음)이 자기 대사를 녹음한 건 세지 않는다.
 */
async function relayStats(
  service: Service,
  keys: string[],
  keyOf: Map<string, string>,
  get: (k: string) => PassStats | null,
): Promise<void> {
  try {
    const [takes, authored, directed, prompts, best] = await Promise.all([
      service.from("relay_takes").select("owner, line_id, scene_id, kind, stamp, created_at").in("owner", keys).eq("hidden", false).limit(20000),
      service.from("relay_lines").select("id, author, won").in("author", keys).eq("candidate", true).eq("hidden", false).limit(5000),
      service.from("relay_scenes").select("director").in("director", keys).eq("status", "premiered").gte("real_actors", 2).limit(2000),
      service.from("relay_prompts").select("owner").in("owner", keys).not("scene_id", "is", null).limit(2000),
      service.from("relay_scenes").select("id").not("best_week", "is", null).limit(500),
    ]);
    const tk = takes.data ?? [];
    const lineIds = [...new Set(tk.map((t) => t.line_id))];
    const cand = new Set<string>();
    for (let i = 0; i < lineIds.length; i += 500) {
      const { data } = await service.from("relay_lines").select("id").in("id", lineIds.slice(i, i + 500)).eq("candidate", true);
      for (const l of data ?? []) cand.add(l.id);
    }
    const bestIds = new Set((best.data ?? []).map((b) => b.id));
    const acted = new Map<string, Set<string>>();
    const votesByDay = new Map<string, number>();
    for (const t of tk) {
      const id = keyOf.get(t.owner);
      const s = get(t.owner);
      if (!id || !s) continue;
      if (t.stamp === "ok") s.relayOk = (s.relayOk ?? 0) + 1;
      if (t.kind !== "line") continue;
      if (cand.has(t.line_id)) {
        const k = `${id}|${kstDay(new Date(t.created_at).getTime())}`;
        const n = votesByDay.get(k) ?? 0;
        if (n < RELAY_XP.votePerDay) {
          votesByDay.set(k, n + 1);
          s.relayVotes = (s.relayVotes ?? 0) + 1;
        }
        continue;
      }
      if (!acted.has(id)) acted.set(id, new Set());
      acted.get(id)!.add(t.scene_id);
    }
    for (const [id, scenes] of acted) {
      const s = get(id);
      if (!s) continue;
      s.relayActs = (s.relayActs ?? 0) + scenes.size;
      s.relayBest = (s.relayBest ?? 0) + [...scenes].filter((x) => bestIds.has(x)).length;
    }
    const au = authored.data ?? [];
    for (const l of au) {
      const s = l.author ? get(l.author) : null;
      if (s && l.won) s.relayWins = (s.relayWins ?? 0) + 1;
    }
    if (au.length) {
      const authorOf = new Map(au.map((l) => [l.id, l.author!]));
      const { data: perf } = await service.from("relay_takes").select("line_id, owner, created_at").in("line_id", [...authorOf.keys()]).eq("kind", "line").eq("hidden", false).limit(20000);
      const seen = new Set<string>();
      const perDay = new Map<string, number>();
      for (const p of perf ?? []) {
        const author = authorOf.get(p.line_id)!;
        const id = keyOf.get(author);
        const s = get(author);
        if (!id || !s || keyOf.get(p.owner) === id) continue;
        const uniq = `${id}|${p.owner}|${p.line_id}`;
        if (seen.has(uniq)) continue;
        seen.add(uniq);
        const dk = `${id}|${kstDay(new Date(p.created_at).getTime())}`;
        const n = perDay.get(dk) ?? 0;
        if (n >= RELAY_XP.voicedPerDay) continue;
        perDay.set(dk, n + 1);
        s.relayVoiced = (s.relayVoiced ?? 0) + 1;
      }
    }
    for (const d of directed.data ?? []) {
      const s = d.director ? get(d.director) : null;
      if (s) s.relayPremieres = (s.relayPremieres ?? 0) + 1;
    }
    for (const p of prompts.data ?? []) {
      const s = get(p.owner);
      if (s) s.relayPrompts = (s.relayPrompts ?? 0) + 1;
    }
  } catch {
    // 릴레이 표가 없으면 0
  }
}
