import { config } from "./config";

export type Meme = {
  id: string;
  title: string;
  source: string;
  emoji: string;
  plays?: number;
};

/**
 * 서버가 응답하지 않을 때 쓰는 폴백. 기존 memes.json 과 같은 내용이다.
 * 카탈로그가 Supabase 로 옮겨가면 (#18) 이 상수는 지운다.
 */
const FALLBACK: Meme[] = [
  { id: "rooster", title: "꼬끼오", source: "수탉", emoji: "🐓", plays: 128400 },
  { id: "cat", title: "야오옹", source: "고양이", emoji: "🐱", plays: 96300 },
  { id: "goat", title: "메에에", source: "염소", emoji: "🐐", plays: 81200 },
  { id: "wolf", title: "아우우", source: "늑대", emoji: "🐺", plays: 67400 },
  { id: "cow", title: "음메에", source: "소", emoji: "🐄", plays: 54100 },
  { id: "dolphin", title: "이이익", source: "돌고래", emoji: "🐬", plays: 41900 },
];

export type MemeListResult = {
  memes: Meme[];
  /** 폴백을 썼는지 — 화면에 서버 상태를 정직하게 표시하기 위해 필요하다. */
  stale: boolean;
};

export async function getMemes(): Promise<MemeListResult> {
  try {
    // Modal 은 콜드 스타트가 있으므로 넉넉히 기다리되, 무한정 매달리지는 않는다.
    const res = await fetch(config.memesUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { memes: FALLBACK, stale: true };

    const body: unknown = await res.json();
    const list = Array.isArray(body)
      ? body
      : (body as { memes?: unknown })?.memes;

    if (!Array.isArray(list) || list.length === 0) {
      return { memes: FALLBACK, stale: true };
    }
    return { memes: list as Meme[], stale: false };
  } catch {
    return { memes: FALLBACK, stale: true };
  }
}
