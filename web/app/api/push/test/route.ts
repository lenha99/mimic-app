import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { pushTest } from "@/lib/notify-server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 테스트 알림(11/28) — 알림 설정 시트의 "테스트 알림 보내기".
 * 이 기기 구독이 서버에 저장돼 있는지, 보내면 푸시 서버가 뭐라고 하는지를 그대로 돌려준다.
 * 저장된 구독에만 보낸다 — 아무 주소로나 보내는 통로가 되지 않게.
 */
export async function POST(req: Request) {
  if (!allow(`push-test:${clientIp(req)}`, 6, 600_000)) return tooMany("Too many tries.");
  const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: unknown };
  if (typeof endpoint !== "string" || !/^https:\/\//.test(endpoint)) return Response.json({ error: "bad" }, { status: 400 });
  const service = createServiceClient();
  const { data } = await service.from("push_subs").select("endpoint, p256dh, auth").eq("endpoint", endpoint).maybeSingle();
  if (!data) return Response.json({ ok: false, reason: "not-saved" });
  const r = await pushTest(data);
  if (r.status === 404 || r.status === 410) await service.from("push_subs").delete().eq("endpoint", endpoint);
  return Response.json({ ...r, reason: r.ok ? "sent" : r.noKeys ? "no-keys" : r.status === 404 || r.status === 410 ? "expired" : "rejected" });
}
