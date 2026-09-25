/**
 * 아이디·비밀번호 계정.
 *
 * Supabase 로그인은 이메일 기반이고, 이 프로젝트는 가입 시 이메일 확인이 켜져 있다.
 * 아이디만 받는 가입을 하려고 아이디를 내부 주소로 바꿔 쓴다. 이 주소로는 메일이
 * 오가지 않는다 — 가입은 서버가 확인 완료 상태로 만들고(/api/signup), 비밀번호
 * 찾기는 없다.
 *
 * 브라우저(로그인)와 서버(가입)가 같은 규칙을 써야 해서 여기 한 곳에 둔다.
 */
export const USERNAME_RULE = /^[a-z0-9_]{3,20}$/;
export const PASSWORD_MIN = 8;
/** bcrypt 가 72바이트 뒤를 버린다. 그보다 긴 비밀번호는 착각을 부른다. */
export const PASSWORD_MAX = 72;

const DOMAIN = "id.mimic.app";

export function normalizeUsername(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

export function usernameToEmail(username: string): string {
  return `${username}@${DOMAIN}`;
}

/** 규칙에 어긋나면 사람에게 보여줄 문구, 맞으면 null. */
export function checkUsername(username: string): string | null {
  if (!USERNAME_RULE.test(username)) {
    return "아이디는 영어 소문자·숫자·밑줄(_)로 3~20자예요.";
  }
  return null;
}

export function checkPassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < PASSWORD_MIN) {
    return `비밀번호는 ${PASSWORD_MIN}자 이상이에요.`;
  }
  if (new TextEncoder().encode(password).length > PASSWORD_MAX) {
    return "비밀번호가 너무 길어요.";
  }
  return null;
}
