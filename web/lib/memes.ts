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
  { id: "rooster", title: "꼬끼오", source: "수탉", emoji: "🐓", plays: 128400 },
  { id: "cat", title: "야오옹", source: "고양이", emoji: "🐱", plays: 96300 },
  { id: "goat", title: "메에에", source: "염소", emoji: "🐐", plays: 81200 },
  { id: "wolf", title: "아우우", source: "늑대", emoji: "🐺", plays: 67400 },
  { id: "cow", title: "음메에", source: "소", emoji: "🐄", plays: 54100 },
  { id: "dolphin", title: "이이익", source: "돌고래", emoji: "🐬", plays: 41900 },
];
// </generated:catalog>

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
