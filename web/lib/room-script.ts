/**
 * 우리 대본 방 — 붙여 넣은 대본을 단락으로 나눈다. 서버(저장 검사)와 화면이 같은 규칙을 쓴다.
 * 배역은 없다: "철수: 안녕" 처럼 이름이 붙어 있어도 그냥 글로 둔다.
 */
export const MAX_SCRIPT = 4000;
export const MAX_PARTS = 60;
export const MAX_TITLE = 30;
/** 녹음 길이 상한 — 단락 하나 / 처음부터 끝까지 */
export const PART_SEC = 60;
export const WHOLE_SEC = 180;

export function splitScript(raw: string): string[] {
  return raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .slice(0, MAX_PARTS);
}

/** 저장할 대본으로 다듬기 — 문제가 있으면 null */
export function cleanScript(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parts = splitScript(raw.normalize("NFC"));
  const text = parts.join("\n");
  if (text.length < 5 || text.length > MAX_SCRIPT) return null;
  return text;
}

export function cleanTitle(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
  return t || null;
}

/** 대본 첫 줄로 제목 미리 채우기 */
export function titleFromScript(raw: string): string {
  const first = splitScript(raw)[0] ?? "";
  return first.length > 20 ? `${first.slice(0, 20)}…` : first;
}
