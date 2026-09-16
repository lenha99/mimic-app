import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * service_role 키로 RLS를 우회하는 클라이언트.
 * 서버 전용 — Route Handler 안에서만 import 할 것, 클라이언트 번들에 절대 노출 금지.
 * 지금은 /api/publish-recording에서 채점 확정 결과를 쓸 때만 사용한다.
 */
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
