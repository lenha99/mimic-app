import { signAudio } from "@/lib/audio-url";
import { FRESH_MS, isNoteTag, type BoardTrack, type PostSummary, type PostView } from "@/lib/board";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 게시판 조회 — 서버 전용. 표에 RLS 정책을 하나도 안 열었으므로(마이그레이션 18)
 * 숨김·만료 조건은 여기서 반드시 건다.
 */

type Sort = "waiting" | "new";

export async function listPosts(viewer: string | null, sort: Sort, limit = 30): Promise<PostSummary[]> {
  const service = createServiceClient();
  const now = new Date().toISOString();
  const { data: posts } = await service
    .from("practice_posts")
    .select("id, user_id, title, track, ask, created_at")
    .eq("hidden", false)
    .gt("expires_at", now)
    .order("created_at", { ascending: false })
    .limit(100);
  if (!posts?.length) return [];

  const ids = posts.map((p) => p.id);
  const users = [...new Set(posts.map((p) => p.user_id))];
  const [{ data: notes }, { data: profiles }, { data: history }] = await Promise.all([
    service.from("practice_notes").select("post_id").in("post_id", ids).eq("hidden", false),
    service.from("profiles").select("id, nickname").in("id", users),
    // 첫 연습인지 — 만료·내린 것까지 포함해 그 사람이 처음 올린 글
    service.from("practice_posts").select("id, user_id").in("user_id", users).order("created_at", { ascending: true }).limit(2000),
  ]);
  const first = new Map<string, string>();
  (history ?? []).forEach((h) => {
    if (!first.has(h.user_id)) first.set(h.user_id, h.id);
  });
  const count = new Map<string, number>();
  (notes ?? []).forEach((n) => count.set(n.post_id, (count.get(n.post_id) ?? 0) + 1));
  const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));

  const rows: PostSummary[] = posts.map((p) => ({
    id: p.id,
    title: p.title,
    track: p.track as BoardTrack,
    ask: p.ask,
    nickname: nick.get(p.user_id) ?? "알 수 없음",
    notes: count.get(p.id) ?? 0,
    createdAt: p.created_at,
    mine: viewer === p.user_id,
    userId: p.user_id,
    firstPost: first.get(p.user_id) === p.id,
  }));
  // "기다리는 중" — 피드백이 적은 것부터. 첫 피드백이 제일 받기 어렵다.
  if (sort === "waiting") rows.sort((a, b) => a.notes - b.notes || b.createdAt.localeCompare(a.createdAt));
  return rows.slice(0, limit);
}

export async function waitingCount(): Promise<number> {
  return (await boardPulse()).waiting;
}

/** 게시판 밖(연습실)에 띄울 소식 — 첫 피드백 기다리는 수, 막 올라온 글 수, 그중 대표 하나. */
export type BoardPulse = {
  waiting: number;
  fresh: number;
  latest: { id: string; nickname: string; title: string; firstPost: boolean; createdAt: string } | null;
};

export async function boardPulse(): Promise<BoardPulse> {
  try {
    const rows = await listPosts(null, "new", 100);
    const now = Date.now();
    const fresh = rows.filter((p) => now - Date.parse(p.createdAt) < FRESH_MS);
    // 처음 올린 사람이 먼저 — "새로운 사람이 올렸어요"가 제일 반가운 소식이다
    const pick = [...fresh].sort((a, b) => Number(b.firstPost) - Number(a.firstPost) || b.createdAt.localeCompare(a.createdAt))[0];
    return {
      waiting: rows.filter((p) => p.notes === 0).length,
      fresh: fresh.length,
      latest: pick ? { id: pick.id, nickname: pick.nickname, title: pick.title, firstPost: pick.firstPost, createdAt: pick.createdAt } : null,
    };
  } catch {
    return { waiting: 0, fresh: 0, latest: null };
  }
}

export async function getPost(id: string, viewer: string | null): Promise<PostView | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const service = createServiceClient();
  const { data: p } = await service.from("practice_posts").select("*").eq("id", id).maybeSingle();
  if (!p) return null;
  const live = !p.hidden && p.expires_at > new Date().toISOString();
  if (!live && p.user_id !== viewer) return null;

  const { data: notes } = await service
    .from("practice_notes")
    .select("id, user_id, tags, body, created_at")
    .eq("post_id", id)
    .eq("hidden", false)
    .order("created_at", { ascending: true });
  const noteUsers = [...new Set((notes ?? []).map((n) => n.user_id))];
  const people = [...new Set([p.user_id, ...noteUsers])];
  const [{ data: profiles }, urls, { data: givenRows }, { data: firstRow }] = await Promise.all([
    service.from("profiles").select("id, nickname").in("id", people),
    signAudio([p.audio_path]),
    noteUsers.length
      ? service.from("practice_notes").select("user_id").in("user_id", noteUsers).eq("hidden", false).limit(5000)
      : Promise.resolve({ data: [] as { user_id: string }[] }),
    service.from("practice_posts").select("id").eq("user_id", p.user_id).order("created_at", { ascending: true }).limit(1).maybeSingle(),
  ]);
  const nick = new Map((profiles ?? []).map((x) => [x.id, x.nickname]));
  const given = new Map<string, number>();
  (givenRows ?? []).forEach((r) => given.set(r.user_id, (given.get(r.user_id) ?? 0) + 1));

  return {
    id: p.id,
    title: p.title,
    track: p.track as BoardTrack,
    ask: p.ask,
    nickname: nick.get(p.user_id) ?? "알 수 없음",
    notes: notes?.length ?? 0,
    createdAt: p.created_at,
    mine: viewer === p.user_id,
    userId: p.user_id,
    firstPost: firstRow?.id === p.id,
    scriptText: p.script_text,
    audioUrl: urls.get(p.audio_path) ?? null,
    expiresAt: p.expires_at,
    daysLeft: Math.max(0, Math.ceil((Date.parse(p.expires_at) - Date.now()) / 86_400_000)),
    noteList: (notes ?? []).map((n) => ({
      id: n.id,
      tags: n.tags.filter(isNoteTag),
      body: n.body,
      nickname: nick.get(n.user_id) ?? "알 수 없음",
      createdAt: n.created_at,
      mine: viewer === n.user_id,
      userId: n.user_id,
      given: given.get(n.user_id) ?? 0,
    })),
  };
}

/** 프로필용 — 내가 올린 것. 만료·숨김도 보인다(왜 안 보이는지 알아야 한다). */
export async function myPosts(userId: string) {
  const service = createServiceClient();
  const { data: posts } = await service
    .from("practice_posts")
    .select("id, title, hidden, created_at, expires_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (!posts?.length) return [];
  const { data: notes } = await service
    .from("practice_notes")
    .select("post_id")
    .in("post_id", posts.map((p) => p.id))
    .eq("hidden", false);
  const count = new Map<string, number>();
  (notes ?? []).forEach((n) => count.set(n.post_id, (count.get(n.post_id) ?? 0) + 1));
  const now = new Date().toISOString();
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    notes: count.get(p.id) ?? 0,
    state: p.hidden ? ("hidden" as const) : p.expires_at <= now ? ("expired" as const) : ("live" as const),
    expiresAt: p.expires_at,
  }));
}
