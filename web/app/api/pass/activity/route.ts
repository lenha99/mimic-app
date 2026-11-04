import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { allow, clientIp, tooMany } from "@/lib/rate-limit";
import { SOLO_XP } from "@/lib/pass";
import { kstDay, keysOf, statsFor } from "@/lib/pass-server";
import { VOICE_TYPE_IDS } from "@/lib/scorecard";

/**
 * 연습 녹음 한 번 — 혼자 하는 XP · 연속 기록 · 도감.
 * 녹음은 안 받는다. "오늘 한 번 더 했다"와 "이 녹음의 목소리 타입"만.
 * 돌려주는 것: 이번에 얻은 XP, 연속 일수, 도감에 새로 들어갔는지, 도감 칸 수.
 */
const CLIENT = /^[a-z0-9]{8,40}$/;

export async function POST(req: Request) {
  const ip = clientIp(req);
  if (!allow(`pass-activity:${ip}`, 120, 3_600_000)) return tooMany("slow down");
  const body = (await req.json().catch(() => ({}))) as { client?: unknown; type?: unknown };
  const client = typeof body.client === "string" && CLIENT.test(body.client) ? body.client : null;
  const type = typeof body.type === "string" && VOICE_TYPE_IDS.includes(body.type) ? body.type : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && !client) return Response.json({ error: "no owner" }, { status: 400 });
  const owner = user ? `u:${user.id}` : `g:${client}`;
  const service = createServiceClient();
  const day = kstDay();

  const { data: row, error: readErr } = await service.from("solo_days").select("takes").eq("owner", owner).eq("day", day).maybeSingle();
  if (readErr) return Response.json({ error: "not-ready" }, { status: 503 }); // 표가 아직 없다(마이그레이션 30)
  const before = row?.takes ?? 0;
  if (row) await service.from("solo_days").update({ takes: before + 1 }).eq("owner", owner).eq("day", day);
  else await service.from("solo_days").insert({ owner, day, takes: 1 });

  let newType = false;
  if (type) {
    const { error } = await service.from("voice_dex").insert({ owner, type_id: type });
    newType = !error; // 이미 있으면 기본키 충돌
  }

  const firstToday = before === 0;
  const xp = (firstToday ? SOLO_XP.day : 0) + (before < SOLO_XP.takeCapPerDay ? SOLO_XP.take : 0) + (newType ? SOLO_XP.dex : 0);
  const stats = await statsFor(keysOf(user?.id ?? null, client), service);
  return Response.json(
    { xp, firstToday, streak: stats.streak, newType, type, dex: stats.dex, loggedIn: Boolean(user) },
    { headers: { "cache-control": "no-store" } },
  );
}
