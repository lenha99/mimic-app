import { createServiceClient } from "@/lib/supabase/service";
import { notify, once, ownerTarget } from "@/lib/notify-server";
import { FOLLOW_MILESTONES, LIKE_MILESTONES, type RewardStats } from "@/lib/rewards";

/**
 * 보상 계산 · 보상 알림 — 서버 전용. 표를 새로 만들지 않고 있는 숫자만 센다.
 * 알림은 단계마다 딱 한 번(notif_sent 키). 실패해도 ❤ · 구독 · 픽은 그대로 된다.
 */
type Service = ReturnType<typeof createServiceClient>;

/** 이 사람(계정 · 기기)의 이름표들 — 'u:<id>' · 'g:<기기>' */
export function keysOf(userId: string | null, client: string | null): string[] {
  return [userId ? `u:${userId}` : null, client ? `g:${client}` : null].filter((k): k is string => !!k);
}

export async function statsFor(keys: string[], userId: string | null, service: Service = createServiceClient()): Promise<RewardStats> {
  const empty: RewardStats = { likesReceived: 0, followers: 0, likesGiven: 0, picked: false, prophet: false };
  if (!keys.length) return empty;
  try {
    const owned = userId
      ? service.from("weekly_entries").select("like_count, featured_at").eq("hidden", false).or(`user_id.eq.${userId},owner.in.(${keys.join(",")})`)
      : service.from("weekly_entries").select("like_count, featured_at").eq("hidden", false).in("owner", keys);
    const [{ data: mine }, given, fans, { data: liked }] = await Promise.all([
      owned,
      service.from("weekly_likes").select("entry_id", { count: "exact", head: true }).in("voter", keys),
      service.from("follows").select("follower", { count: "exact", head: true }).in("creator", keys),
      service.from("weekly_likes").select("entry_id, created_at").in("voter", keys).limit(500),
    ]);
    let prophet = false;
    const likedIds = (liked ?? []).map((l) => l.entry_id);
    if (likedIds.length) {
      const { data: picks } = await service.from("weekly_entries").select("id, featured_at").in("id", likedIds).not("featured_at", "is", null);
      const at = new Map((liked ?? []).map((l) => [l.entry_id, l.created_at]));
      prophet = (picks ?? []).some((p) => p.featured_at && at.get(p.id) && at.get(p.id)! < p.featured_at);
    }
    return {
      likesReceived: (mine ?? []).reduce((n, e) => n + (e.like_count ?? 0), 0),
      picked: (mine ?? []).some((e) => Boolean(e.featured_at)),
      followers: fans.count ?? 0,
      likesGiven: given.count ?? 0,
      prophet,
    };
  } catch {
    return empty;
  }
}

/** 출전작 주인의 보상 숫자 (공개 화면용) */
export async function statsOfEntryOwner(entryId: string, service: Service = createServiceClient()): Promise<{ stats: RewardStats; owner: string } | null> {
  const { data: e } = await service.from("weekly_entries").select("owner, user_id").eq("id", entryId).maybeSingle();
  if (!e) return null;
  const keys = [...new Set([e.owner, e.user_id ? `u:${e.user_id}` : null].filter((k): k is string => !!k))];
  return { stats: await statsFor(keys, e.user_id, service), owner: e.owner };
}

/** 이 주인이 받은 ❤ 합계 (owner 이름표 기준) */
async function likesOf(owner: string, userId: string | null, service: Service): Promise<number> {
  const q = userId
    ? service.from("weekly_entries").select("like_count").eq("hidden", false).or(`user_id.eq.${userId},owner.eq.${owner}`)
    : service.from("weekly_entries").select("like_count").eq("hidden", false).eq("owner", owner);
  const { data } = await q;
  return (data ?? []).reduce((n, e) => n + (e.like_count ?? 0), 0);
}

const LIKE_PUSH: Record<number, string> = {
  1: "💗 첫 ❤ 를 받았어요! 누군가 당신 목소리를 좋아해요",
  3: "🥉 ❤ 3개 — 브론즈 목소리가 됐어요! 테두리가 생겼어요",
  10: "🥈 ❤ 10개 — 실버 목소리가 됐어요!",
  30: "🥇 ❤ 30개 — 골드 목소리! 갤러리에서 제일 빛나요",
  100: "💯 ❤ 100개를 받았어요!",
};

/** ❤ 가 들어간 뒤 — 주인이 단계를 넘었으면 알린다 */
export async function afterLike(entryId: string, service: Service = createServiceClient()): Promise<void> {
  try {
    const { data: e } = await service.from("weekly_entries").select("owner, user_id").eq("id", entryId).maybeSingle();
    if (!e) return;
    const total = await likesOf(e.owner, e.user_id, service);
    const hit = LIKE_MILESTONES.find((n) => n === total);
    if (!hit) return;
    const who = e.user_id ? `u:${e.user_id}` : e.owner;
    if (!(await once(`reward:likes:${who}:${hit}`, service))) return;
    const to = ownerTarget(e.owner, e.user_id);
    await notify({
      ...to,
      kind: "reward_likes",
      entryId,
      count: hit,
      push: { title: "MIMIC", body: LIKE_PUSH[hit], url: `/weekly/e/${entryId}`, tag: "reward" },
    });
  } catch {}
}

/** 구독자 수가 단계를 넘었으면 알린다 */
export async function afterFollow(creator: string, total: number, service: Service = createServiceClient()): Promise<void> {
  try {
    const hit = FOLLOW_MILESTONES.find((n) => n === total);
    if (!hit || !(await once(`reward:fans:${creator}:${hit}`, service))) return;
    const userId = creator.startsWith("u:") ? creator.slice(2) : null;
    const body =
      hit === 3 ? "🌱 구독자 3명 — '떠오르는 목소리'가 됐어요!" : hit === 10 ? "🔔 구독자 10명 — '단골 생긴 목소리'!" : "👑 구독자 30명 — '팬덤 있는 목소리'!";
    await notify({
      userId,
      client: userId ? null : creator.slice(2),
      kind: "reward_follows",
      count: hit,
      push: { title: "MIMIC", body, url: userId ? "/notifications" : "/me", tag: "reward" },
    });
  } catch {}
}

/** 운영자 픽 — 주인에게, 그리고 먼저 ❤ 한 사람들(픽 예언가)에게 */
export async function afterPick(entryId: string, service: Service = createServiceClient()): Promise<void> {
  try {
    const { data: e } = await service.from("weekly_entries").select("owner, user_id, featured_at").eq("id", entryId).maybeSingle();
    if (!e) return;
    if (await once(`reward:pick:${entryId}`, service)) {
      await notify({
        ...ownerTarget(e.owner, e.user_id),
        kind: "reward_pick",
        entryId,
        push: { title: "⭐ 운영자 픽!", body: "코코가 당신 목소리를 골랐어요. 이제 홈 맨 위에서 모두가 먼저 들어요", url: `/weekly/e/${entryId}`, tag: "reward" },
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
        push: { title: "🔮 픽 예언가", body: "당신이 먼저 ❤ 한 목소리가 운영자 픽이 됐어요!", url: `/weekly/e/${entryId}`, tag: "reward" },
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
