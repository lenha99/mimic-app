import { config } from "./config";

export type Meme = {
  id: string;
  title: string;
  source: string;
  emoji: string;
  plays?: number;
  /** 따라 말할 대사. 말소리 밈에만 있다 — 동물 소리는 없다. */
  line?: string;
  /** 미공개. 목록에는 안 뜨고 직링크로만 열린다 (실기기 확인용). */
  draft?: boolean;
};

/**
 * 서버가 응답하지 않을 때 쓰는 폴백. 카탈로그와 같은 내용이다.
 * 카탈로그가 Supabase 로 옮겨가면 (#18) 이 상수는 지운다.
 */
// <generated:catalog> — content/registry.json 에서 생성. 직접 고치지 말 것.
const FALLBACK: Meme[] = [
  { id: "muyaho", title: "무야호", source: "무한도전", emoji: "🎉", plays: 0, line: "무야호~!" },
  { id: "eoiga_eopne", title: "어이가 없네", source: "베테랑", emoji: "😑", plays: 0, line: "어이가 없네" },
  { id: "mitjang_ppaegi", title: "동작 그만", source: "타짜", emoji: "🃏", plays: 0, line: "동작 그만, 밑장 빼기냐" },
  { id: "geoje_yaho", title: "거제 야호", source: "원이 · 리센느 미나미", emoji: "🏝️", plays: 0, line: "거제! 야호!" },
  { id: "rooster", title: "꼬끼오", source: "수탉", emoji: "🐓", plays: 128400 },
  { id: "cat", title: "야오옹", source: "고양이", emoji: "🐱", plays: 96300 },
  { id: "goat", title: "메에에", source: "염소", emoji: "🐐", plays: 81200 },
  { id: "wolf", title: "아우우", source: "늑대", emoji: "🐺", plays: 67400 },
  { id: "cow", title: "음메에", source: "소", emoji: "🐄", plays: 54100 },
  { id: "dolphin", title: "이이익", source: "돌고래", emoji: "🐬", plays: 41900 },
];
// </generated:catalog>

/**
 * 제목과 겹치지 않을 때만 대사를 돌려준다.
 *
 * 말소리 밈은 제목이 대사에서 따온 경우가 많다("밥은 먹고 다니냐" / "무야호").
 * 그럴 때 둘을 나란히 찍으면 같은 말이 두 번 나와서, 대사가 정보가 아니라
 * 장식이 된다. 반대로 "동작 그만" → "동작 그만, 밑장 빼기냐"처럼 대사가 더
 * 길면 그게 실제로 뭘 외쳐야 하는지 알려주는 유일한 정보다.
 */
export function extraLine(meme: Meme): string | null {
  if (!meme.line) return null;
  const bare = (s: string) => s.replace(/[\s~!?.,·'"“”‘’]/g, "");
  return bare(meme.line) === bare(meme.title) ? null : meme.line;
}

/** 사회적 증거는 숫자가 있을 때만 증거다. "0명 도전"은 오히려 말리는 문구다. */
export function playCount(meme: Meme): number | null {
  return typeof meme.plays === "number" && meme.plays > 0 ? meme.plays : null;
}

export type MemeListResult = {
  memes: Meme[];
  /** 폴백을 썼는지 — 화면에 서버 상태를 정직하게 표시하기 위해 필요하다. */
  stale: boolean;
};

/**
 * 서버 응답은 UGC 업로드까지 섞인 남의 입력이다. 캐스팅으로 믿지 말고 거른다.
 * 어긋난 항목은 렌더 때 undefined 로 터지는 대신 조용히 빠진다.
 */
function normalizeMeme(raw: unknown): Meme | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);

  const id = str(r.id);
  const title = str(r.title);
  if (!id || !title) return null;

  const plays = typeof r.plays === "number" && Number.isFinite(r.plays) ? r.plays : undefined;
  return {
    id,
    title,
    source: str(r.source) ?? "",
    emoji: str(r.emoji) ?? "🎙",
    ...(plays !== undefined ? { plays } : {}),
    ...(str(r.line) ? { line: str(r.line) } : {}),
    ...(r.draft === true ? { draft: true as const } : {}),
  };
}

/**
 * @param includeDraft 미공개(draft) 밈까지 받는다. 개별 챌린지 페이지는 직링크로
 *   미리 확인할 수 있어야 하므로 켜고, 홈 목록은 끈다.
 */
export async function getMemes(
  { includeDraft = false }: { includeDraft?: boolean } = {},
): Promise<MemeListResult> {
  try {
    const url = includeDraft
      ? `${config.memesUrl}${config.memesUrl.includes("?") ? "&" : "?"}include_draft=1`
      : config.memesUrl;

    // Modal 은 콜드 스타트가 있으므로 넉넉히 기다리되, 무한정 매달리지는 않는다.
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { memes: FALLBACK, stale: true };

    const body: unknown = await res.json();
    const list = Array.isArray(body)
      ? body
      : (body as { memes?: unknown })?.memes;

    if (!Array.isArray(list)) return { memes: FALLBACK, stale: true };

    const memes = list.map(normalizeMeme).filter((m): m is Meme => m !== null);
    if (memes.length === 0) return { memes: FALLBACK, stale: true };
    return { memes, stale: false };
  } catch {
    return { memes: FALLBACK, stale: true };
  }
}
