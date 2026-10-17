import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 운영자 확인 — 서버 전용. 둘 중 하나면 운영자다.
 *
 *  1) 로그인한 계정이 admins 표에 있다 (마이그레이션 19). 기본 경로.
 *  2) 공용 암호(ADMIN_PASSCODE)를 넣어 받은 30일짜리 httpOnly 쿠키. 계정 없이 쓰던
 *     예전 경로라 남겨 둔다. 쿠키에 암호 원문은 남기지 않는다.
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
  if (await passcodeCookieOk()) return true;
  return isAdminAccount();
}

async function passcodeCookieOk(): Promise<boolean> {
  const want = adminCookieValue();
  if (!want) return false;
  const got = (await cookies()).get(ADMIN_COOKIE)?.value ?? "";
  if (got.length !== want.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(want));
}

async function isAdminAccount(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await (await createClient()).auth.getUser();
    if (!user) return false;
    const { data } = await createServiceClient()
      .from("admins")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    return Boolean(data);
  } catch {
    return false;
  }
}
