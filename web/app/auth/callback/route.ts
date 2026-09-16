import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth 로그인(카카오/구글) 후 Supabase가 리다이렉트하는 콜백. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/profile";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await ensureProfile(supabase);
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
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
