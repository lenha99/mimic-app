import { FRESH_MS } from "@/lib/board";
import { createServiceClient } from "@/lib/supabase/service";
import { challengeById } from "@/lib/weekly";

/**
 * 연습실 입구("서로 들어주기")에 띄울 소식 — 서버 전용.
 *
 * 11/6 게시판을 갤러리로 합쳤다. 이제 "피드백 받기"를 켠 갤러리 목소리를 센다:
 * 아직 댓글이 하나도 없는 수, 막 올라온(48시간) 수, 그중 대표 하나(처음 올린 사람이 먼저).
 */
export type BoardPulse = {
  waiting: number;
  fresh: number;
  /** 막 올라온 목소리를 올린 사람들 — 최신순, 중복 없이 */
  freshNames: string[];
  latest: { id: string; nickname: string; title: string; firstPost: boolean; createdAt: string } | null;
};

const EMPTY: BoardPulse = { waiting: 0, fresh: 0, freshNames: [], latest: null };

export async function boardPulse(): Promise<BoardPulse> {
  try {
    const service = createServiceClient();
    const { data: rows, error } = await service
      .from("weekly_entries")
      .select("id, challenge_id, owner, user_id, guest_name, created_at")
      .eq("hidden", false)
      .eq("feedback_on", true)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !rows?.length) return EMPTY;

    const ids = rows.map((r) => r.id);
    const owners = [...new Set(rows.map((r) => r.owner))];
    const users = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => !!x))];
    const [{ data: notes }, { data: profiles }, { data: history }] = await Promise.all([
      service.from("entry_notes").select("entry_id").in("entry_id", ids).eq("hidden", false),
      users.length ? service.from("profiles").select("id, nickname").in("id", users) : Promise.resolve({ data: [] as { id: string; nickname: string }[] }),
      // 처음 올린 목소리인지 — 그 사람이 갤러리에 올린 첫 작품
      service.from("weekly_entries").select("id, owner").in("owner", owners).order("created_at", { ascending: true }).limit(2000),
    ]);
    const noted = new Set((notes ?? []).map((n) => n.entry_id));
    const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
    const first = new Map<string, string>();
    (history ?? []).forEach((h) => {
      if (!first.has(h.owner)) first.set(h.owner, h.id);
    });

    const now = Date.now();
    const view = rows.map((r) => ({
      id: r.id,
      nickname: (r.user_id ? nick.get(r.user_id) : null) ?? r.guest_name ?? "익명의 목소리",
      title: challengeById(r.challenge_id)?.title ?? "",
      firstPost: first.get(r.owner) === r.id,
      createdAt: r.created_at,
    }));
    const fresh = view.filter((p) => now - Date.parse(p.createdAt) < FRESH_MS);
    const pick = [...fresh].sort((a, b) => Number(b.firstPost) - Number(a.firstPost) || b.createdAt.localeCompare(a.createdAt))[0];
    return {
      waiting: rows.filter((r) => !noted.has(r.id)).length,
      fresh: fresh.length,
      freshNames: [...new Set(fresh.map((p) => p.nickname))],
      latest: pick ?? null,
    };
  } catch {
    return EMPTY;
  }
}
