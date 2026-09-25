import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * 운영자 확인 — 서버 전용.
 *
 * 운영자는 두 명(형제)이고 계정 체계와 따로 돈다. 암호(ADMIN_PASSCODE)를 한 번 넣으면
 * 그 해시를 httpOnly 쿠키로 30일 들고 있는다. 쿠키에 암호 원문은 남기지 않는다.
 */
export const ADMIN_COOKIE = "mimic_admin";

function digest(v: string): Buffer {
  return createHash("sha256").update(`mimic-admin:${v}`).digest();
}

export function passcodeMatches(input: string): boolean {
  const real = process.env.ADMIN_PASSCODE;
  if (!real || !input) return false;
  return timingSafeEqual(digest(input), digest(real));
}

export function adminCookieValue(): string | null {
  const real = process.env.ADMIN_PASSCODE;
  return real ? digest(real).toString("hex") : null;
}

export async function isAdmin(): Promise<boolean> {
  const want = adminCookieValue();
  if (!want) return false;
  const got = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  if (got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
