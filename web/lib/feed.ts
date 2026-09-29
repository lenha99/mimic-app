import { signAudio } from "@/lib/audio-url";
import { DEFAULT_AVATAR, normalizeAvatar, type Avatar } from "@/lib/avatar";
import { UGC_ID } from "@/lib/challenges";
import { refAudio } from "@/lib/config";
import { getMemes, type Meme } from "@/lib/memes";
import { createPublicClient } from "@/lib/supabase/public";
import type { createClient } from "@/lib/supabase/server";

/**
 * 따라하기 피드 — 서버 전용. 한 페이지를 카드 목록으로 조립한다.
 *
 * 카드는 두 종류다.
 *   take      — 누군가 공개한 녹음. 원본 → 그 사람 목소리 순으로 튼다.
 *   challenge — 원본 카드. 녹음이 바닥나면 뒤에 붙는다.
 *
 * 원본 카드가 있는 이유: 피드는 공개 녹음으로만 채워지는데, 공개는 opt-in 이라
 * 처음엔 거의 없다. 빈 피드는 죽은 앱처럼 보이고, 첫 번째로 올릴 사람도 안 생긴다.
 * 녹음이 끝난 자리에 "아직 아무도 안 한 대사"를 이어 붙이면 피드는 비지 않고,
 * 그 카드 하나하나가 첫 번째 주인공이 되라는 초대가 된다.
 */

export const FEED_SORTS = ["hot", "new", "funny"] as const;
export type FeedSort = (typeof FEED_SORTS)[number];

export function parseSort(raw: string | null | undefined): FeedSort {
  return FEED_SORTS.includes(raw as FeedSort) ? (raw as FeedSort) : "hot";
}

const PAGE = 8;
/** 녹음이 끝난 뒤 붙이는 원본 카드 수. 전부 붙이면 피드가 카탈로그 목록이 된다. */
const CHALLENGE_TAIL = 6;

export type FeedMeme = {
  id: string;
  title: string;
  source: string;
  emoji: string;
  /** 말풍선에 띄울 대사. 동물 소리는 제목이 곧 소리다. */
  line: string;
};

export type FeedTake = {
  kind: "take";
  id: string;
  meme: FeedMeme;
  refUrl: string;
  /** 서버가 서명한 짧은 URL (30분). 만료되면 /api/feed?id= 로 다시 받는다. */
  audioUrl: string | null;
  score: number;
  grade: string;
  createdAt: string;
  nickname: string | null;
  avatar: Avatar;
  same: number;
  funny: number;
  mySame: boolean;
  myFunny: boolean;
  /** 보는 사람 본인 녹음 — 반응 대신 "피드에서 내리기". */
  mine: boolean;
  pinned: boolean;
};

export type FeedChallenge = {
  kind: "challenge";
  id: string;
  meme: FeedMeme;
  refUrl: string;
  /** 이 대사를 공개한 사람 수. 0 이면 "첫 번째"를 권한다. */
  takes: number;
};

export type FeedItem = FeedTake | FeedChallenge;

export type FeedPage = {
  items: FeedItem[];
  /** 다음 페이지 오프셋. null 이면 끝(원본 카드까지 붙였다). */
  nextOffset: number | null;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

export async function loadFeed(
  supabase: Supabase,
  { sort, offset = 0, pin = null, viewerId = null }: {
    sort: FeedSort;
    offset?: number;
    pin?: string | null;
    viewerId?: string | null;
  },
): Promise<FeedPage> {
  const [{ data: rows, error }, catalog] = await Promise.all([
    supabase.rpc("feed_page", {
      p_sort: sort,
      p_offset: offset,
      p_limit: PAGE,
      p_pin: pin && isUuid(pin) ? pin : null,
    }),
    getMemes(),
  ]);
  // 피드 조회가 실패해도 원본 카드로는 뜬다 — 첫 화면이 에러면 그냥 닫는다.
  const list = error ? [] : (rows ?? []);

  const memes = await resolveMemes(catalog.memes, list.map((r) => r.meme_id));
  const urls = await signAudio(list.map((r) => r.audio_path));

  const takes: FeedTake[] = [];
  for (const r of list) {
    const meme = memes.get(r.meme_id);
    // 목록에 없는 밈(내린 콘텐츠·검토 전 챌린지)의 녹음은 싣지 않는다.
    if (!meme) continue;
    takes.push({
      kind: "take",
      id: r.id,
      meme,
      refUrl: refAudio(meme.id),
      audioUrl: urls.get(r.audio_path) ?? null,
      score: r.score ?? 0,
      grade: r.grade ?? "",
      createdAt: r.created_at,
      nickname: r.nickname,
      avatar: r.avatar ? normalizeAvatar(r.avatar) : DEFAULT_AVATAR,
      same: r.same_count,
      funny: r.funny_count,
      mySame: r.my_same,
      myFunny: r.my_funny,
      mine: viewerId !== null && r.user_id === viewerId,
      pinned: r.pinned,
    });
  }

  // 고정 녹음은 다음 페이지 쿼리에서 빠지므로 오프셋에 세지 않는다 (feed_page 주석).
  const consumed = list.filter((r) => !r.pinned).length;
  if (list.length >= PAGE) {
    return { items: takes, nextOffset: offset + consumed };
  }

  // 녹음이 바닥났다 — 원본 카드를 붙이고 끝낸다.
  const tail = await challengeTail(catalog.memes);
  return { items: [...takes, ...tail], nextOffset: null };
}

/** 녹음 하나만 다시 — 서명 URL 이 만료됐을 때. 공개가 풀렸으면 null. */
export async function loadTake(
  supabase: Supabase,
  id: string,
  viewerId: string | null,
): Promise<FeedTake | null> {
  if (!isUuid(id)) return null;
  const { items } = await loadFeed(supabase, { sort: "new", pin: id, viewerId });
  const hit = items[0];
  return hit?.kind === "take" && hit.id === id ? hit : null;
}

function toFeedMeme(m: Meme): FeedMeme {
  return { id: m.id, title: m.title, source: m.source, emoji: m.emoji, line: m.line ?? m.title };
}

/**
 * meme_id → 화면에 띄울 밈. 운영 콘텐츠는 카탈로그(공개분만), 사용자 챌린지는
 * 승인된 것만. 검토 전 챌린지를 여기로 열면 검토를 건너뛰고 피드에 뜬다.
 */
async function resolveMemes(catalog: Meme[], ids: string[]): Promise<Map<string, FeedMeme>> {
  const out = new Map<string, FeedMeme>();
  for (const m of catalog) out.set(m.id, toFeedMeme(m));

  const ugc = [...new Set(ids.filter((id) => !out.has(id) && UGC_ID.test(id)))];
  if (ugc.length === 0) return out;
  try {
    const db = createPublicClient();
    const { data: rows } = await db
      .from("challenges")
      .select("id, creator_id, title, line, emoji, status")
      .in("id", ugc)
      .eq("status", "approved");
    const creators = [...new Set((rows ?? []).map((r) => r.creator_id))];
    const { data: profiles } = creators.length
      ? await db.from("profiles").select("id, nickname").in("id", creators)
      : { data: [] as { id: string; nickname: string }[] };
    const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
    for (const c of rows ?? []) {
      const who = nick.get(c.creator_id);
      out.set(c.id, {
        id: c.id,
        title: c.title,
        source: who ? `@${who}` : "친구 챌린지",
        emoji: c.emoji,
        line: c.line ?? c.title,
      });
    }
  } catch {
    // 챌린지를 못 읽으면 그 녹음만 빠진다.
  }
  return out;
}

/**
 * 원본 카드 — 공개 녹음이 적은 대사부터. 아무도 안 한 대사가 "첫 번째" 자리를
 * 제일 많이 남겨두고 있다. 명대사를 동물 소리보다 앞에 둔다(피드는 말소리가 재밌다).
 */
async function challengeTail(catalog: Meme[]): Promise<FeedChallenge[]> {
  const takes = new Map<string, number>();
  try {
    const { data } = await createPublicClient()
      .from("recordings")
      .select("meme_id")
      .eq("is_public", true)
      .eq("hidden", false)
      .limit(2000);
    for (const r of data ?? []) takes.set(r.meme_id, (takes.get(r.meme_id) ?? 0) + 1);
  } catch {
    // 개수를 몰라도 카드는 붙인다 — 전부 "첫 번째"로 보일 뿐이다.
  }

  return catalog
    .map((m, i) => ({ m, i, n: takes.get(m.id) ?? 0 }))
    .sort((a, b) => a.n - b.n || Number(!a.m.line) - Number(!b.m.line) || a.i - b.i)
    .slice(0, CHALLENGE_TAIL)
    .map(({ m, n }) => ({
      kind: "challenge" as const,
      id: `c:${m.id}`,
      meme: toFeedMeme(m),
      refUrl: refAudio(m.id),
      takes: n,
    }));
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}
