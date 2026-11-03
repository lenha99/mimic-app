import { createServiceClient } from "@/lib/supabase/service";
import { notify, once, ownerTarget } from "@/lib/notify-server";
import { EMPTY_STATS, FOLLOW_STEPS, LIKE_STEPS, type PassStats } from "@/lib/pass";

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
    const [entries, fans, given, picks] = await Promise.all([
      service.from("weekly_entries").select("owner, user_id, like_count, featured_at").eq("hidden", false).limit(5000),
      service.from("follows").select("creator").in("creator", keys).limit(5000),
      service.from("weekly_likes").select("voter").in("voter", keys).limit(20000),
      service.from("weekly_entries").select("id, featured_at").not("featured_at", "is", null).limit(200),
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
