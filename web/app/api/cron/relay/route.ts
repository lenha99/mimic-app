import { notify } from "@/lib/notify-server";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureSchedule } from "@/lib/relay-server";
import { sweepRooms } from "@/lib/room-server";

/**
 * 릴레이 더빙 일정 — Vercel Cron 이 매일 21시(KST)에 부른다.
 * 개봉할 장면 개봉 · 빈 상영관에 다음 장면 · 이주의 명작. 그리고 배역 우선권이 12시간 안에 끝나는데
 * 남은 줄이 있는 배우에게 "남은 대사가 있어요" 한 번.
 * 화면 조회에서도 같은 일정이 돌기 때문에(lib/relay-server ensureSchedule) 크론이 빠져도 멈추지 않는다.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const service = createServiceClient();
  await ensureSchedule(service, true);
  // 친구 방 — 72시간 지난 방 완성 · 뒤풀이 끝난 채팅 삭제 · 녹음 없이 7일 지난 방 삭제
  const rooms = await sweepRooms(service).catch(() => null);

  const soon = new Date(Date.now() + 12 * 3600_000).toISOString();
  const { data: roles } = await service.from("relay_roles").select("scene_id, role, owner, user_id, priority_until").gt("priority_until", new Date().toISOString()).lt("priority_until", soon);
  let sent = 0;
  for (const r of roles ?? []) {
    const { data: lines } = await service.from("relay_lines").select("id").eq("scene_id", r.scene_id).eq("role", r.role).eq("candidate", false);
    const ids = (lines ?? []).map((l) => l.id);
    const { count } = await service.from("relay_takes").select("id", { count: "exact", head: true }).in("line_id", ids).eq("owner", r.owner).eq("kind", "line");
    if ((count ?? 0) >= ids.length) continue;
    await notify({
      userId: r.user_id,
      client: r.owner.startsWith("g:") ? r.owner.slice(2) : null,
      kind: "relay_role",
      sceneId: r.scene_id,
      push: { title: "🎙 남은 대사가 있어요", body: "맡은 배역의 대사가 남았어요. 우선권이 곧 끝나요", url: `/relay/rec?scene=${r.scene_id}`, tag: "relay" },
      pushKey: `relay-role:${r.scene_id}:${r.role}:${r.owner}`,
    });
    sent++;
  }
  return Response.json({ ok: true, reminders: sent, rooms });
}
