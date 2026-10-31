import { kstStamp, notify, ownerTarget } from "@/lib/notify-server";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 하루 요약 — "오늘 N명이 당신 목소리를 들었어요". Vercel Cron 이 매일 저녁 8시(KST)에 부른다.
 *
 * 자주 보내지 않는다: 하루 한 번, 지난 24시간 새 청취자가 2명 이상일 때만(1명이면 첫 청취
 * 알림과 겹친다). 출전작이 여러 개여도 사람당 한 통.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { data: listens } = await service.from("entry_listens").select("entry_id").gte("created_at", since).limit(10_000);
  const perEntry = new Map<string, number>();
  (listens ?? []).forEach((l) => perEntry.set(l.entry_id, (perEntry.get(l.entry_id) ?? 0) + 1));
  if (!perEntry.size) return Response.json({ sent: 0 });

  const { data: entries } = await service.from("weekly_entries").select("id, owner, user_id").in("id", [...perEntry.keys()]);
  const perOwner = new Map<string, { n: number; entryId: string; userId: string | null }>();
  for (const e of entries ?? []) {
    const cur = perOwner.get(e.owner) ?? { n: 0, entryId: e.id, userId: e.user_id };
    cur.n += perEntry.get(e.id) ?? 0;
    perOwner.set(e.owner, cur);
  }
  const day = kstStamp();
  let sent = 0;
  for (const [owner, v] of perOwner) {
    if (v.n < 2) continue;
    await notify({
      ...ownerTarget(owner, v.userId),
      kind: "listen_daily",
      entryId: v.entryId,
      count: v.n,
      push: { title: "🎧 오늘의 청취자", body: `오늘 ${v.n}명이 당신 목소리를 들었어요`, url: `/weekly/e/${v.entryId}`, tag: "listen-daily" },
      pushKey: `daily:${owner}:${day}`,
    });
    sent++;
  }
  return Response.json({ sent });
}
