import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isLang, LANG_COOKIE, pickLang, type Lang } from "@/lib/i18n";

/**
 * 모든 요청마다 Supabase 세션 쿠키를 갱신 (Next.js 16의 middleware → proxy 개명 반영).
 * 빠뜨리면 로그인 세션이 랜덤하게 끊긴다.
 *
 * 화면 요청은 언어도 여기서 정한다 — 주소는 그대로 두고 `/x` 를 `/ko/x` · `/en/x` 로
 * 몰래 바꿔 그린다(lib/i18n). 친구가 보낸 링크가 받는 사람 언어로 열린다.
 *   - `?lang=en` 이나 `/en/...` 으로 들어오면 그 언어를 쿠키에 굳히고 맨 주소로 보낸다
 */
export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  const page = isPage(url.pathname);

  let lang: Lang | null = null;
  if (page) {
    const seg = url.pathname.split("/")[1];
    const forced = isLang(seg) ? seg : isLang(url.searchParams.get("lang")) ? url.searchParams.get("lang") : null;
    if (forced) {
      const clean = url.clone();
      if (isLang(seg)) clean.pathname = url.pathname.slice(seg.length + 1) || "/";
      clean.searchParams.delete("lang");
      const res = NextResponse.redirect(clean);
      res.cookies.set(LANG_COOKIE, forced, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
      return res;
    }
    lang = pickLang(request.cookies.get(LANG_COOKIE)?.value, request.headers.get("accept-language"));
  }

  const target = lang ? new URL(`/${lang}${url.pathname === "/" ? "" : url.pathname}${url.search}`, url) : null;
  const pass = () => (target ? NextResponse.rewrite(target, { request }) : NextResponse.next({ request }));
  let response = pass();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = pass();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  await supabase.auth.getUser();
  return response;
}

/** 화면 주소인가 — API·로그인 콜백·파일(.wav 등)은 언어 없이 그대로 지나간다. */
function isPage(path: string) {
  if (path.startsWith("/api/") || path === "/api" || path.startsWith("/auth/")) return false;
  return !/\.[a-z0-9]+$/i.test(path);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
