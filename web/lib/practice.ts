import { SCRIPTS } from "./scripts";
import type { Meme } from "./memes";

/**
 * 연습실 — 대본(기준 음성 없음)과 명대사(기준 음성 있음)를 한 목록으로 다룬다.
 *
 * 대본은 서버가 모른다. 채점 서버는 기준 음성과 비교만 할 수 있는데 대본에는 그게
 * 없어서, 말 속도·쉼·억양 폭·끝 처짐을 브라우저가 직접 잰다(lib/voice-analysis).
 * 명대사는 기준 음성이 있으니 서버 채점까지 받는다.
 */

export type Track = "voice" | "anchor";
export type PitchBand = "low" | "mid" | "high";

export type Script = {
  id: string;
  track: Track;
  category: string;
  title: string;
  level: 1 | 2 | 3 | number;
  /** 기준 말 속도 [최소, 최대] — 초당 음절, 처음 소리부터 마지막 소리까지. */
  pace: number[];
  pitch: PitchBand;
  /** 녹음 디렉터가 부스 밖에서 건네는 한마디. */
  direction: string;
  /** "/" 쉼, *말* 강조, 빈 줄 단락. */
  text: string;
};

export const TRACK_LABEL: Record<Track | "line", string> = {
  voice: "성우",
  anchor: "아나운서·낭독",
  line: "명대사",
};

/** 억양 폭 기준 — 반음 단위, 목소리 높낮이의 10~90% 구간. */
export const PITCH_RANGE: Record<PitchBand, [number, number]> = {
  low: [2.5, 8],
  mid: [5, 11],
  high: [8, 16],
};

export { SCRIPTS };

export function findScript(id: string): Script | undefined {
  return SCRIPTS.find((s) => s.id === id);
}

/** 같은 트랙 안에서 앞뒤 대본. 연습은 한 편 끝나면 다음 편으로 흘러가야 한다. */
export function neighbors(id: string): { prev: Script | null; next: Script | null } {
  const i = SCRIPTS.findIndex((s) => s.id === id);
  if (i < 0) return { prev: null, next: null };
  const track = SCRIPTS[i].track;
  const same = SCRIPTS.filter((s) => s.track === track);
  const j = same.findIndex((s) => s.id === id);
  return { prev: same[j - 1] ?? null, next: same[j + 1] ?? null };
}

/** 대본 번호 — 트랙 안에서 몇 번째인지. 목록과 연습 화면이 같은 번호를 쓴다. */
export function scriptNumber(id: string): number {
  const s = findScript(id);
  if (!s) return 0;
  return SCRIPTS.filter((x) => x.track === s.track).findIndex((x) => x.id === id) + 1;
}

export type Piece =
  | { kind: "text"; text: string; strong: boolean }
  | { kind: "pause" };

/** 대본 표기를 단락 → 조각으로 푼다. 화면은 이걸 그대로 그린다. */
export function parseScript(text: string): Piece[][] {
  return text
    .split(/\n\s*\n/)
    .map((para) => {
      const out: Piece[] = [];
      para
        .replace(/\n/g, " ")
        .split(/(\/)/)
        .forEach((chunk) => {
          if (chunk === "/") {
            out.push({ kind: "pause" });
            return;
          }
          chunk.split(/(\*[^*]+\*)/).forEach((part) => {
            if (!part) return;
            const strong = part.startsWith("*") && part.endsWith("*");
            out.push({ kind: "text", text: strong ? part.slice(1, -1) : part, strong });
          });
        });
      return out;
    })
    .filter((p) => p.length > 0);
}

/** 읽는 음절 수 — 한글 음절만 센다 (대본은 숫자·영문을 한글로 풀어 쓴다). */
export function syllables(text: string): number {
  return (text.match(/[가-힣]/g) ?? []).length;
}

/** 쉼 표시 개수 — 녹음에서 실제로 쉰 횟수와 견준다. */
export function pauseMarks(text: string): number {
  return (text.match(/\//g) ?? []).length + (text.match(/\n\s*\n/g) ?? []).length;
}

/** 기준 속도 가운데로 읽었을 때 걸리는 시간(초). 목록에 "약 12초"로 뜬다. */
export function expectedSeconds(s: Script): number {
  const mid = (s.pace[0] + s.pace[1]) / 2;
  return Math.round(syllables(s.text) / mid);
}

/** 명대사를 연습실 항목으로. 대사가 있는(말소리) 밈만 연습 대상이다. */
export function practiceLines(memes: Meme[]): Meme[] {
  return memes.filter((m) => m.line && !m.id.startsWith("u_"));
}

/** "3분 전" · "어제" — 기록 목록에서 언제 읽었는지. */
export function ago(at: number): string {
  const min = Math.round((Date.now() - at) / 60_000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.round(h / 24);
  if (d === 1) return "어제";
  if (d < 7) return `${d}일 전`;
  return new Date(at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}
