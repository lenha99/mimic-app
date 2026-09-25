import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieValue, passcodeMatches } from "@/lib/admin";

/** 운영자 암호 확인 → 30일짜리 httpOnly 쿠키. */
export async function POST(req: Request) {
  const { passcode } = (await req.json().catch(() => ({}))) as { passcode?: unknown };
  if (typeof passcode !== "string" || !passcodeMatches(passcode)) {
    // 무차별 대입을 조금이라도 느리게.
    await new Promise((r) => setTimeout(r, 800));
    return NextResponse.json({ error: "암호가 달라요." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminCookieValue()!, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
