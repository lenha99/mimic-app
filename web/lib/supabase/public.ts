import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * 쿠키 없는 익명 클라이언트 — 정적 페이지(ISR)용.
 *
 * lib/supabase/server 는 쿠키를 읽어서, 쓰는 순간 그 페이지가 요청마다 서버에서
 * 도는 동적 페이지가 된다. "공개 녹음이 몇 개냐"처럼 누가 봐도 같은 답은
 * 이걸로 묻는다. RLS 는 anon 권한 그대로 적용된다.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
