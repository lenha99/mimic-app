import { syllables, type PitchBand, type Script, type Track } from "./practice";
import { tr, type Lang } from "./i18n";

/**
 * 내 대본 — 사용자가 직접 넣은 연습 대본. 이 기기(localStorage)에만 남는다.
 *
 * 서버에 올리지 않는 이유: 대본은 글자 몇백 자라 기기에 두면 비용이 0 이고, 학원
 * 교재·오디션 대본처럼 남의 글일 때가 많아서 우리가 들고 있을 이유도 없다. 서버를
 * 거치는 건 사용자가 "대본 확인"을 누를 때의 녹음 한 번뿐이고, 그 길이는
 * 연습실 녹음 상한(120초)과 받아쓰기 서버 상한이 막는다.
 *
 * 길이 상한은 그 120초에서 거꾸로 정했다 — 빠르게 읽어도 120초 안에 끝나야
 * 대본 확인이 끝까지 된다.
 */

export type MyScript = Script & { createdAt: number; updatedAt: number };

export const MY_PREFIX = "my_";
export const MY_CATEGORY = "내 대본";
export const MAX_MINE = 50;
export const MAX_TITLE = 30;
export const MAX_DIRECTION = 120;
/** 한글 음절 기준. 보통 속도(4.5음절/초)로 약 110초. */
export const MAX_SYLLABLES = 500;
/** 쉼 표시·문장부호까지 포함한 전체 글자 상한 — 붙여넣기 폭주 방지. */
export const MAX_CHARS = 900;

export const PACE_PRESETS = {
  slow: { label: "느리게", labelEn: "Slow", pace: [3.0, 4.2] },
  mid: { label: "보통", labelEn: "Natural", pace: [3.8, 5.2] },
  fast: { label: "빠르게", labelEn: "Fast", pace: [4.8, 6.4] },
} as const;
export type PaceKey = keyof typeof PACE_PRESETS;

const KEY = "mimic.practice.mine";

export function isMine(id: string): boolean {
  return id.startsWith(MY_PREFIX);
}

export function listMine(): MyScript[] {
  try {
    const raw = localStorage.getItem(KEY);
    const rows = raw ? (JSON.parse(raw) as MyScript[]) : [];
    return Array.isArray(rows) ? rows.filter(valid).sort((a, b) => b.updatedAt - a.updatedAt) : [];
  } catch {
    return [];
  }
}

export function getMine(id: string): MyScript | undefined {
  return listMine().find((s) => s.id === id);
}

export type Draft = {
  title: string;
  track: Track;
  pace: PaceKey;
  pitch: PitchBand;
  direction: string;
  text: string;
};

/** 문제가 있으면 사람에게 보여줄 문구, 괜찮으면 null. */
export function checkDraft(d: Draft, lang: Lang = "ko"): string | null {
  const t = tr(lang);
  if (!d.title.trim()) return t("제목을 적어 주세요.", "Please add a title.");
  if (d.title.trim().length > MAX_TITLE) return t(`제목은 ${MAX_TITLE}자까지예요.`, `Titles can be up to ${MAX_TITLE} characters.`);
  const syl = syllables(d.text);
  if (syl < 5) return t("대본이 너무 짧아요. 한글로 다섯 글자 이상 적어 주세요.", "Too short. Please write at least 5 Korean syllables.");
  if (syl > MAX_SYLLABLES)
    return t(
      `대본이 너무 길어요. 한글 ${MAX_SYLLABLES}자까지 넣을 수 있어요 (지금 ${syl}자).`,
      `Too long. Up to ${MAX_SYLLABLES} Korean syllables (now ${syl}).`,
    );
  if (d.text.length > MAX_CHARS) return t(`대본이 너무 길어요. 전체 ${MAX_CHARS}자까지예요.`, `Too long. Up to ${MAX_CHARS} characters total.`);
  if (d.direction.length > MAX_DIRECTION)
    return t(`디렉션은 ${MAX_DIRECTION}자까지예요.`, `Direction can be up to ${MAX_DIRECTION} characters.`);
  return null;
}

/** 저장하고 id 를 돌려준다. 실패하면 문구를 던진다. */
export function saveMine(d: Draft, id?: string, lang: Lang = "ko"): string {
  const t = tr(lang);
  const problem = checkDraft(d, lang);
  if (problem) throw new Error(problem);
  const rows = listMine();
  const now = Date.now();
  const cur = id ? rows.find((s) => s.id === id) : undefined;
  if (!cur && rows.length >= MAX_MINE) {
    throw new Error(
      t(`내 대본은 ${MAX_MINE}편까지예요. 안 쓰는 대본을 지우고 다시 해주세요.`, `You can keep up to ${MAX_MINE} scripts. Delete one you don't use and try again.`),
    );
  }
  const script: MyScript = {
    id: cur?.id ?? `${MY_PREFIX}${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    track: d.track,
    category: MY_CATEGORY,
    title: d.title.trim(),
    level: 1,
    pace: [...PACE_PRESETS[d.pace].pace],
    pitch: d.pitch,
    direction: d.direction.trim() || "내가 정한 대로 읽어 보세요.",
    text: tidy(d.text),
    createdAt: cur?.createdAt ?? now,
    updatedAt: now,
  };
  const next = [script, ...rows.filter((s) => s.id !== script.id)];
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    throw new Error(t("이 브라우저는 저장이 막혀 있어요. 사생활 보호 모드라면 꺼 주세요.", "This browser blocks storage. Turn off private mode and try again."));
  }
  return script.id;
}

export function deleteMine(id: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listMine().filter((s) => s.id !== id)));
  } catch {}
}

/** 저장된 대본을 편집기 값으로 되돌린다. */
export function toDraft(s: MyScript): Draft {
  const pace = (Object.keys(PACE_PRESETS) as PaceKey[]).find(
    (k) => PACE_PRESETS[k].pace[0] === s.pace[0],
  );
  return {
    title: s.title,
    track: s.track,
    pace: pace ?? "mid",
    pitch: s.pitch,
    direction: s.direction === "내가 정한 대로 읽어 보세요." ? "" : s.direction,
    text: s.text,
  };
}

/** 숫자·영문이 섞였는지 — 속도는 한글 음절로 재서, 있으면 실제보다 빠르게 나온다. */
export function hasNonHangul(text: string): boolean {
  return /[0-9A-Za-z]/.test(text);
}

/** 붙여넣은 글의 줄바꿈·공백 정리. 빈 줄 두 개 이상은 단락 하나로. */
function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function valid(s: unknown): s is MyScript {
  const x = s as MyScript;
  return (
    !!x &&
    typeof x.id === "string" &&
    x.id.startsWith(MY_PREFIX) &&
    typeof x.title === "string" &&
    typeof x.text === "string" &&
    Array.isArray(x.pace) &&
    (x.track === "voice" || x.track === "anchor")
  );
}
