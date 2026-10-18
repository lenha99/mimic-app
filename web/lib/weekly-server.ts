import { createHash } from "node:crypto";
import { normalizeAvatar } from "@/lib/avatar";
import { createServiceClient } from "@/lib/supabase/service";
import {
  currentWeek,
  MIN_AWARDS,
  previousWeek,
  weekById,
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
export async function ensureWeek(w: Week, service: Service = createServiceClient()): Promise<void> {
  await service.from("weekly_challenges").upsert(
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
}

/** 순위 — ❤ 많은 순, 같으면 그 녹음을 먼저 올린(바꾼) 쪽이 위. */
function byRank(a: { like_count: number; updated_at: string }, b: { like_count: number; updated_at: string }) {
  return b.like_count - a.like_count || a.updated_at.localeCompare(b.updated_at);
}

export async function getBoard(w: Week): Promise<WeeklyBoard> {
  const service = createServiceClient();
  const { data: rows } = await service
    .from("weekly_entries")
    .select("id, user_id, guest_name, avatar, duration_s, bars, like_count, play_count, created_at, updated_at")
    .eq("challenge_id", w.id)
    .eq("hidden", false)
    .limit(500);
  const list = [...(rows ?? [])].sort(byRank);

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
      avatar: normalizeAvatar(p?.avatar ?? r.avatar),
      duration: r.duration_s,
      bars: r.bars ?? [],
      likes: r.like_count,
      plays: r.play_count,
      trophies: r.user_id ? (trophies.get(r.user_id) ?? 0) : 0,
      createdAt: r.updated_at,
    };
  });
  return { week: w, entries, totalLikes: entries.reduce((n, e) => n + e.likes, 0) };
}

export type EntryView = EntryCard & {
  week: Week;
  total: number;
  userId: string | null;
  owner: string;
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
  const week = weekById(e.challenge_id);
  if (!week) return null;
  const board = await getBoard(week);
  const card = board.entries.find((x) => x.id === id);
  if (!card) return null;
  return { ...card, week, total: board.entries.length, userId: e.user_id, owner: e.owner };
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
  const winners = board.entries.length >= MIN_AWARDS ? board.entries.filter((e) => e.likes > 0).slice(0, 3) : [];
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
        avatar: normalizeAvatar(e.avatar),
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
        avatar: normalizeAvatar(a.avatar),
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
    const w = weekById(e.challenge_id);
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
