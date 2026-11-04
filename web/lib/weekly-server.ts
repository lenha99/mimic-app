import { createHash } from "node:crypto";
import { normalizeAvatar } from "@/lib/avatar";
import { lookOf, type Look, EMPTY_STATS } from "@/lib/pass";
import { statsBatch, whoOwns } from "@/lib/pass-server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  currentWeek,
  MIN_AWARDS,
  previousWeek,
  weekById,
  challengeById,
  FREE_PREFIX,
  type Award,
  type EntryCard,
  type Week,
  type WeeklyBoard,
} from "@/lib/weekly";

/**
 * 주간 챌린지 조회·정산 — 서버 전용. 표에 RLS 정책을 하나도 안 열었으므로
 * (마이그레이션 20) 숨김·기간·본인 조건은 전부 여기서 건다.
 */

type Service = ReturnType<typeof createServiceClient>;

/** 이 주의 weekly_challenges 행을 만든다(이미 있으면 그대로). 출전작이 매달릴 자리다. */
export async function ensureWeek(w: Week, service: Service = createServiceClient()): Promise<boolean> {
  // 실패를 삼키면 안 된다 — 11/3~4 자유 출전이 DB 검사에 막혔는데 여기서 조용히 넘어가 원인이 안 보였다.
  const { error } = await service.from("weekly_challenges").upsert(
    {
      id: w.id,
      season: w.season,
      script_id: w.scriptId,
      field: w.field,
      title: w.title,
      starts_at: new Date(w.startsAt).toISOString(),
      ends_at: new Date(w.endsAt).toISOString(),
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) console.error("ensureWeek", w.id, error.code, error.message);
  return !error;
}

function scriptOf(challengeId: string): EntryCard["script"] {
  const c = challengeById(challengeId);
  return c ? { id: c.scriptId, title: c.title, titleEn: c.titleEn, emoji: c.emoji } : null;
}

/** 순위 — ❤ 많은 순, 같으면 그 녹음을 먼저 올린(바꾼) 쪽이 위. */
function byRank(a: { like_count: number; updated_at: string }, b: { like_count: number; updated_at: string }) {
  return b.like_count - a.like_count || a.updated_at.localeCompare(b.updated_at);
}

/**
 * 이번 주 ❤ 순위에 드는 행. 주간 대본 출전작 + 이 주 안에 올린(바꾼) 자유 출전작 —
 * 어떤 대본으로 올려도 같은 주 순위에서 겨룬다. 월요일이면 자유 출전작은 순위에서 빠지고
 * 갤러리에만 남는다(다시 올리면 그 주 순위에 든다 — 교체하면 ❤ 가 0 이 되므로 공평하다).
 */
export async function weekRows<R>(service: Service, w: Week, cols: string): Promise<{ data: R[] | null; error: unknown }> {
  const own = service.from("weekly_entries").select(cols).eq("challenge_id", w.id).eq("hidden", false).limit(500);
  if (w.free) {
    const r = await own;
    return { data: (r.data ?? null) as R[] | null, error: r.error };
  }
  const free = service
    .from("weekly_entries")
    .select(cols)
    .like("challenge_id", `${FREE_PREFIX}%`)
    .gte("updated_at", new Date(w.startsAt).toISOString())
    .lt("updated_at", new Date(w.endsAt).toISOString())
    .eq("hidden", false)
    .limit(500);
  const [a, b] = await Promise.all([own, free]);
  if (a.error || b.error) return { data: null, error: a.error ?? b.error };
  return { data: [...(a.data ?? []), ...(b.data ?? [])] as R[], error: null };
}

/** 한 사람이 대본마다 올릴 수 있으니, 순위엔 그 사람의 가장 ❤ 많은 목소리 하나만. */
function bestPerOwner<R extends { owner: string; like_count: number; updated_at: string }>(rows: R[]): R[] {
  const best = new Map<string, R>();
  for (const r of [...rows].sort(byRank)) if (!best.has(r.owner)) best.set(r.owner, r);
  return [...best.values()];
}

export async function getBoard(w: Week): Promise<WeeklyBoard> {
  const service = createServiceClient();
  const base = "id, challenge_id, owner, user_id, guest_name, avatar, duration_s, bars, like_count, play_count, created_at, updated_at";
  const query = (cols: string) => weekRows<BoardRow>(service, w, cols);
  // 배틀 칸은 마이그레이션 23 에서 생긴다. 배포가 마이그레이션보다 먼저 나가도 순위판은 떠야 한다.
  let res = await query(`${base}, battle_rating, battle_wins, battle_losses`);
  if (res.error) res = await query(base);
  type BoardRow = {
    id: string;
    challenge_id: string;
    owner: string;
    user_id: string | null;
    guest_name: string | null;
    avatar: unknown;
    duration_s: number;
    bars: number[] | null;
    like_count: number;
    play_count: number;
    created_at: string;
    updated_at: string;
    battle_rating?: number;
    battle_wins?: number;
    battle_losses?: number;
  };
  const rows = res.data ?? [];
  const list = bestPerOwner(rows).sort(byRank);

  const users = [...new Set(list.map((r) => r.user_id).filter((x): x is string => !!x))];
  const [{ data: profiles }, { data: awards }] = users.length
    ? await Promise.all([
        service.from("profiles").select("id, nickname, avatar").in("id", users),
        service.from("weekly_awards").select("user_id").in("user_id", users),
      ])
    : [{ data: [] }, { data: [] }];
  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
  const trophies = new Map<string, number>();
  (awards ?? []).forEach((a) => a.user_id && trophies.set(a.user_id, (trophies.get(a.user_id) ?? 0) + 1));

  const entries: EntryCard[] = list.map((r, i) => {
    const p = r.user_id ? prof.get(r.user_id) : undefined;
    return {
      id: r.id,
      rank: i + 1,
      name: p?.nickname ?? r.guest_name ?? "익명의 목소리",
      guest: !r.user_id,
      // 로그인 출전은 지금 내 캐릭터로 — 꾸미면 출전작 얼굴도 바뀌는 게 자연스럽다.
      avatar: normalizeAvatar(p?.avatar ?? r.avatar, r.owner ?? r.id),
      duration: r.duration_s,
      bars: r.bars ?? [],
      likes: r.like_count,
      plays: r.play_count,
      trophies: r.user_id ? (trophies.get(r.user_id) ?? 0) : 0,
      createdAt: r.updated_at,
      // 다른 대본으로 올린 목소리 — 카드에 무슨 대본인지 적는다. 블라인드 배틀·1:1 대결은 같은 대본끼리만.
      script: r.challenge_id === w.id ? null : scriptOf(r.challenge_id),
      battle:
        r.battle_rating === undefined
          ? null
          : { rating: Math.round(r.battle_rating), wins: r.battle_wins ?? 0, losses: r.battle_losses ?? 0 },
    };
  });
  return { week: w, entries, totalLikes: entries.reduce((n, e) => n + e.likes, 0) };
}

export type EntryView = EntryCard & {
  week: Week;
  total: number;
  userId: string | null;
  owner: string;
  featured: boolean;
  badges: string[];
};

/** 출전작 하나 + 그 주 안에서의 순위. 숨긴 건 안 보인다. */
export async function getEntry(id: string): Promise<EntryView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const service = createServiceClient();
  const { data: e } = await service
    .from("weekly_entries")
    .select("id, challenge_id, user_id, owner, hidden")
    .eq("id", id)
    .maybeSingle();
  if (!e || e.hidden) return null;
  const week = challengeById(e.challenge_id);
  if (!week) return null;
  const board = await getBoard(week);
  const card = board.entries.find((x) => x.id === id);
  if (!card) return null;
  // 픽·배지(마이그레이션 27) — 칸이 없으면 없는 채로.
  const { data: extra } = await service.from("weekly_entries").select("featured_at, badges").eq("id", id).maybeSingle();
  return {
    ...card,
    week,
    total: board.entries.length,
    userId: e.user_id,
    owner: e.owner,
    featured: Boolean(extra?.featured_at),
    badges: (extra?.badges ?? []).slice(0, 3),
  };
}

/** 오디오 경로 — /api/weekly/audio 만 쓴다. 숨긴 건 숨겼다고 같이 알려준다(운영자만 듣는다). */
export async function entryAudio(id: string): Promise<{ path: string; hidden: boolean } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data } = await createServiceClient()
    .from("weekly_entries")
    .select("audio_path, hidden")
    .eq("id", id)
    .maybeSingle();
  return data ? { path: data.audio_path, hidden: data.hidden } : null;
}

/**
 * 끝난 주를 정산한다 — 1~3위를 weekly_awards 에 박제. 이미 했으면 아무것도 안 한다.
 *
 * 크론(하루 한 번)이 부르고, 혹시 크론이 늦어도 지난주 결과를 보는 화면이 먼저 부른다.
 * 두 곳이 동시에 불러도 awards 의 기본키(challenge_id, place)가 중복을 막는다.
 */
export async function settle(w: Week, service: Service = createServiceClient()): Promise<void> {
  if (Date.now() < w.endsAt) return;
  const { data: row } = await service.from("weekly_challenges").select("settled_at").eq("id", w.id).maybeSingle();
  if (!row || row.settled_at) return;

  const board = await getBoard(w);
  // 참가 문턱(MIN_AWARDS)만 넘으면 순위대로 셋 — ❤ 가 0 이어도 3위는 3위다.
  const winners = board.entries.length >= MIN_AWARDS ? board.entries.slice(0, 3) : [];
  if (winners.length) {
    const { data: owners } = await service
      .from("weekly_entries")
      .select("id, user_id")
      .in(
        "id",
        winners.map((e) => e.id),
      );
    const uid = new Map((owners ?? []).map((o) => [o.id, o.user_id]));
    await service.from("weekly_awards").upsert(
      winners.map((e, i) => ({
        challenge_id: w.id,
        place: i + 1,
        entry_id: e.id,
        user_id: uid.get(e.id) ?? null,
        name: e.name.slice(0, 24),
        avatar: normalizeAvatar(e.avatar, e.name),
        likes: e.likes,
      })),
      { onConflict: "challenge_id,place", ignoreDuplicates: true },
    );
  }
  await service.from("weekly_challenges").update({ settled_at: new Date().toISOString() }).eq("id", w.id);
}


async function awardRows(filter: { userId?: string; limit: number }): Promise<Award[]> {
  const service = createServiceClient();
  let q = service
    .from("weekly_awards")
    .select("challenge_id, place, name, avatar, likes, entry_id, user_id")
    .order("challenge_id", { ascending: false })
    .order("place", { ascending: true })
    .limit(filter.limit);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  const { data } = await q;
  return (data ?? []).flatMap((a) => {
    const w = weekById(a.challenge_id);
    if (!w) return [];
    return [
      {
        weekId: w.id,
        season: w.season,
        field: w.field,
        title: w.title,
        place: a.place,
        name: a.name,
        avatar: normalizeAvatar(a.avatar, a.name),
        likes: a.likes,
        entryId: a.entry_id,
        userId: a.user_id,
      },
    ];
  });
}

/** 명예의 전당 — 최근 시즌부터. */
export function hallOfFame(limit = 60): Promise<Award[]> {
  return awardRows({ limit });
}

export function myAwards(userId: string): Promise<Award[]> {
  return awardRows({ userId, limit: 50 });
}

/** 지난주 결과 — 정산이 아직이면 여기서 한다. */
export async function lastWeekWinners(): Promise<{ week: Week; awards: Award[] } | null> {
  const prev = previousWeek();
  if (!prev) return null;
  try {
    await settle(prev);
  } catch {
    // 정산 실패는 화면을 막지 않는다. 다음 크론이 다시 한다.
  }
  const all = await awardRows({ limit: 3 * 4 });
  return { week: prev, awards: all.filter((a) => a.weekId === prev.id) };
}

/** 프로필 — 내가 출전한 주들과 그 주의 지금(또는 최종) 순위. */
export async function myEntries(userId: string) {
  const service = createServiceClient();
  const { data } = await service
    .from("weekly_entries")
    .select("id, challenge_id, like_count, hidden, updated_at")
    .eq("user_id", userId)
    .order("challenge_id", { ascending: false })
    .limit(12);
  const out = [];
  for (const e of data ?? []) {
    const w = challengeById(e.challenge_id);
    if (!w) continue;
    let rank: number | null = null;
    let total = 0;
    if (!e.hidden) {
      const board = await getBoard(w);
      total = board.entries.length;
      rank = board.entries.find((x) => x.id === e.id)?.rank ?? null;
    }
    out.push({ id: e.id, week: w, likes: e.like_count, hidden: e.hidden, rank, total });
  }
  return out;
}

/** ❤ 몰아주기를 세는 데만 쓴다. 주마다 소금이 달라서 주를 넘어 사람을 잇지 못한다. */
export function ipHash(ip: string, weekId: string): string {
  return createHash("sha256").update(`mimic-weekly:${weekId}:${ip}`).digest("hex").slice(0, 32);
}

/** 지금 주 — 행이 없으면 만든다. */
export async function liveWeek(): Promise<Week> {
  const w = currentWeek();
  try {
    await ensureWeek(w);
  } catch {}
  return w;
}

/** 갤러리 카드 — 주를 넘어 쌓이는 목소리 하나. */
export type GalleryEntry = {
  id: string;
  name: string;
  guest: boolean;
  avatar: unknown;
  duration: number;
  bars: number[];
  likes: number;
  plays: number;
  at: string;
  week: { id: string; season: number; emoji: string; title: string; titleEn: string; live: boolean; free: boolean };
  featured: boolean;
  badges: string[];
  /** 주인의 VOICE PASS 겉모습 — 레벨 · 프레임 · 닉네임 효과 · 배지 (lib/pass) */
  look: Look;
  /** 운영자 화면에서만 쓴다 — 공개 화면엔 내려보내지 않는다. */
  promoOk?: boolean;
};

/**
 * 목소리 갤러리 — 지난 주 것까지 전부, 최근 순. 사람이 적은 지금은 콘텐츠가 쌓여야 한다
 * (매주 0 으로 돌아가면 좋은 목소리가 월요일에 묻힌다). 운영자 픽은 따로 표시.
 */
export async function galleryEntries(limit = 60, opts: { admin?: boolean } = {}): Promise<GalleryEntry[]> {
  const service = createServiceClient();
  const base = "id, challenge_id, owner, user_id, guest_name, avatar, duration_s, bars, like_count, play_count, updated_at";
  const query = (cols: string) =>
    service.from("weekly_entries").select(cols).eq("hidden", false).order("updated_at", { ascending: false }).limit(limit);
  // 픽·배지 칸(마이그레이션 27)이 아직 없으면 없는 채로.
  let res = await query(`${base}, featured_at, badges, promo_ok`);
  if (res.error) res = await query(base);
  type Row = {
    id: string;
    challenge_id: string;
    owner: string;
    user_id: string | null;
    guest_name: string | null;
    avatar: unknown;
    duration_s: number;
    bars: number[] | null;
    like_count: number;
    play_count: number;
    updated_at: string;
    featured_at?: string | null;
    badges?: string[] | null;
    promo_ok?: boolean;
  };
  const rows = (res.data ?? []) as unknown as Row[];
  const users = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
  const { data: profiles } = users.length
    ? await service.from("profiles").select("id, nickname, avatar").in("id", users)
    : { data: [] as { id: string; nickname: string; avatar: unknown }[] };
  const prof = new Map((profiles ?? []).map((p) => [p.id, p]));
  // VOICE PASS — 주인마다 숫자를 한 번에 센다(지금 목록 밖의 목소리·구독자·준 ❤ 까지).
  const people = new Map<string, string[]>();
  for (const r of rows) people.set(whoOwns(r), [...new Set([whoOwns(r), r.owner])]);
  const stats = await statsBatch([...people.values()], service);
  const cur = currentWeek();
  const now = cur.id;
  const thisWeek = (r: Row, free: boolean) =>
    free ? Date.parse(r.updated_at) >= cur.startsAt && Date.parse(r.updated_at) < cur.endsAt : r.challenge_id === now;
  return rows.flatMap((r) => {
    const w = challengeById(r.challenge_id);
    if (!w) return [];
    const p = r.user_id ? prof.get(r.user_id) : undefined;
    return [
      {
        id: r.id,
        name: p?.nickname ?? r.guest_name ?? "익명의 목소리",
        guest: !r.user_id,
        avatar: normalizeAvatar(p?.avatar ?? r.avatar, r.owner ?? r.id),
        duration: r.duration_s,
        bars: r.bars ?? [],
        likes: r.like_count,
        plays: r.play_count,
        at: r.updated_at,
        week: { id: w.id, season: w.season, emoji: w.emoji, title: w.title, titleEn: w.titleEn, live: thisWeek(r, Boolean(w.free)), free: Boolean(w.free) },
        featured: Boolean(r.featured_at),
        badges: (r.badges ?? []).slice(0, 3),
        look: lookOf(stats.get(whoOwns(r)) ?? { ...EMPTY_STATS, posts: 1, likesReceived: r.like_count, picked: Boolean(r.featured_at) }),
        ...(opts.admin ? { promoOk: Boolean(r.promo_ok) } : {}),
      },
    ];
  });
}

/** 순위·시상대를 켤 만큼 이번 주 출전작이 모였나. 그 전엔 갤러리가 첫 화면이다. */
export const RANKED_MIN = 8;
