import { isAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { afterPick } from "@/lib/pass-server";

/**
 * 운영자 픽 — 출전작 하나를 홈·갤러리 맨 위에 고정(POST {entry, on}).
 * GET ?entry= 는 무대 화면이 "운영자인가 · 픽인가 · 인스타 소개 동의했나"를 묻는다.
 * 운영자가 아니면 아무것도 알려 주지 않는다.
 */
const ID = /^[0-9a-f-]{36}$/i;

export async function GET(req: Request) {
  if (!(await isAdmin())) return Response.json({ admin: false });
  const entry = new URL(req.url).searchParams.get("entry") ?? "";
  if (!ID.test(entry)) return Response.json({ admin: true });
  const { data, error } = await createServiceClient().from("weekly_entries").select("featured_at, promo_ok").eq("id", entry).maybeSingle();
  if (error) return Response.json({ admin: true, ready: false });
  return Response.json({ admin: true, ready: true, featured: Boolean(data?.featured_at), promoOk: Boolean(data?.promo_ok) });
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "운영자만 쓸 수 있어요." }, { status: 403 });
  const { entry, on } = (await req.json().catch(() => ({}))) as { entry?: unknown; on?: unknown };
  if (typeof entry !== "string" || !ID.test(entry)) return Response.json({ error: "bad request" }, { status: 400 });
  const { error } = await createServiceClient()
    .from("weekly_entries")
    .update({ featured_at: on ? new Date().toISOString() : null })
    .eq("id", entry);
  if (error) return Response.json({ error: "DB 에 픽 칸이 아직 없어요 — npx supabase db push" }, { status: 500 });
  if (on) await afterPick(entry);
  return Response.json({ featured: Boolean(on) });
}
