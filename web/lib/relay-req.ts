import { createClient } from "@/lib/supabase/server";
import { viewerOf, type Viewer } from "@/lib/relay-server";

/** 요청한 사람 — 로그인 계정 + 이 기기 id(있으면). 서버 라우트 전용. */
export async function requestViewer(client: unknown): Promise<Viewer> {
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {}
  return viewerOf(userId, typeof client === "string" ? client : null);
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
