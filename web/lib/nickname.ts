import type { Lang } from "./i18n";

/**
 * 닉네임 — 순위·게시판에 보이는 이름.
 *
 * 로그인한 사람은 profiles.nickname(가입할 때 정하고 프로필에서 바꾼다), 손님은 이 기기에
 * 적어 둔 이름을 출전할 때 함께 보낸다. 손님이 안 정하면 "익명의 목소리 #1234" 다.
 * 규칙은 브라우저와 서버가 같은 함수를 쓴다.
 */
export const NICK_MIN = 2;
export const NICK_MAX = 20;

/** 보이는 이름으로 쓸 수 있게 다듬는다. 못 쓰면 null. */
export function cleanNickname(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const n = [...s].length;
  return n >= NICK_MIN && n <= NICK_MAX ? s : null;
}

export function nicknameProblem(v: string, lang: Lang = "ko"): string | null {
  if (cleanNickname(v)) return null;
  return lang === "en"
    ? `Nicknames need ${NICK_MIN}–${NICK_MAX} characters.`
    : `닉네임은 ${NICK_MIN}~${NICK_MAX}자로 적어 주세요.`;
}

const KEY = "mimic.nickname";

/** 손님 닉네임 — 이 기기에만. */
export function readNickname(): string {
  try {
    return cleanNickname(localStorage.getItem(KEY)) ?? "";
  } catch {
    return "";
  }
}

export function writeNickname(v: string): void {
  try {
    const c = cleanNickname(v);
    if (c) localStorage.setItem(KEY, c);
    else localStorage.removeItem(KEY);
  } catch {
    // 저장이 막힌 브라우저 — 이번 출전에만 쓰인다.
  }
}
