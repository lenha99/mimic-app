import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth 로그인(카카오/구글) 후 Supabase가 리다이렉트하는 콜백. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const origin = resolveOrigin(request);

  // 제공자(카카오·구글)나 Supabase 가 거절하면 code 대신 error_description 이 온다.
  // 그걸 삼키고 "실패했어요"만 띄우면 원인을 알 길이 없다 — 설정 문제는 대부분
  // 여기 문구에 그대로 적혀 온다(예: KOE004, redirect 불일치).
  let reason = searchParams.get("error_description") ?? searchParams.get("error");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await ensureProfile(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
    reason = error.message;
  }

  const q = new URLSearchParams({ error: "auth_failed" });
  if (reason) q.set("reason", reason.slice(0, 200));
  return NextResponse.redirect(`${origin}/login?${q}`);
}

/**
 * request.url 의 origin 은 Vercel 프록시 뒤에서 내부 호스트로 잡힐 수 있다.
 * 그러면 로그인 후 엉뚱한 도메인으로 떨어지고, 쿠키는 진짜 호스트에 설정돼
 * 있으니 세션이 유실된 것처럼 보인다.
 *
 * x-forwarded-host 는 사용자가 실제로 접속한 호스트라 프리뷰든 프로덕션이든
 * 그 배포의 주소로 정확히 돌아간다. (config.siteUrl 은 프리뷰 배포에서도
 * 프로덕션 주소로 해석되므로 여기 쓰면 안 된다 — 프리뷰 로그인이 깨진다.)
 */
function resolveOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (!forwardedHost) return new URL(request.url).origin;
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${forwardedHost}`;
}

/**
 * next 는 쿼리로 들어오므로 그대로 붙이면 오픈 리다이렉트가 된다
 * ("//evil.com" 은 브라우저가 프로토콜 상대 URL로 읽는다). 내부 경로만 허용.
 */
function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/profile";
  return raw;
}

/**
 * 첫 로그인이면 profiles row를 만들어준다. 이미 있으면 손대지 않음
 * (닉네임은 최초 1회만 provider 표시 이름으로 채워지고, 이후 유저가 직접 바꿀 수 있음).
 */
async function ensureProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return;

  const meta = user.user_metadata ?? {};
  const displayName: string =
    meta.name ?? meta.full_name ?? meta.nickname ?? user.email?.split("@")[0] ?? "익명유저";
  const provider = user.app_metadata?.provider ?? "unknown";

  await supabase.from("profiles").insert({
    id: user.id,
    // 닉네임 유니크 제약 충돌을 피하려고 유저 id 앞 4자리를 붙여둠.
    nickname: `${displayName}-${user.id.slice(0, 4)}`,
    provider,
  });
}
