import { config } from "@/lib/config";
import { getMemes, type Meme } from "@/lib/memes";
import { createPublicClient } from "@/lib/supabase/public";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * 사용자 챌린지 — 서버 전용.
 *
 * 운영 콘텐츠(카탈로그)와 사용자 챌린지(Supabase challenges)는 사는 곳이 다르지만,
 * 녹음 화면·저장·공유 링크 입장에선 똑같은 "따라할 소리"다. 그래서 id 하나로 둘 다
 * 찾는 findMeme 를 여기 둔다. 기준 음성은 둘 다 Modal 볼륨 {id}.wav 라 채점·원본
 * 듣기는 아무것도 다르지 않다.
 */
export const UGC_ID = /^u_[a-z0-9]{8}$/;

type ChallengeRow = {
  id: string;
  creator_id: string;
  title: string;
  line: string | null;
  emoji: string;
  status: "pending" | "approved" | "rejected";
};

function toMeme(c: ChallengeRow, nickname: string | null): Meme {
  return {
    id: c.id,
    title: c.title,
    source: nickname ? `@${nickname}` : "친구 챌린지",
    emoji: c.emoji,
    ...(c.line ? { line: c.line } : {}),
    // 검토 전(pending)은 링크로만 열린다 — 목록·"다음 소리"에는 안 나온다.
    ...(c.status !== "approved" ? { draft: true as const } : {}),
  };
}

/** 카탈로그에 있으면 그것, 아니면 사용자 챌린지. 반려된 챌린지는 없는 것으로 친다. */
export async function findMeme(id: string): Promise<{ meme: Meme; catalog: Meme[] } | null> {
  const { memes } = await getMemes({ includeDraft: true });
  const hit = memes.find((m) => m.id === id);
  if (hit) return { meme: hit, catalog: memes };
  if (!UGC_ID.test(id)) return null;

  const service = createServiceClient();
  const { data: c } = await service
    .from("challenges")
    .select("id, creator_id, title, line, emoji, status")
    .eq("id", id)
    .maybeSingle();
  if (!c || c.status === "rejected") return null;
  const { data: p } = await service.from("profiles").select("nickname").eq("id", c.creator_id).maybeSingle();
  return { meme: toMeme(c, p?.nickname ?? null), catalog: memes };
}

/** 홈 "친구들이 만든 챌린지" — 운영자가 올린 것만. 정적 페이지에서 부르므로 쿠키 없이. */
export async function listApprovedChallenges(limit = 12): Promise<Meme[]> {
  try {
    const db = createPublicClient();
    const { data } = await db
      .from("challenges")
      .select("id, creator_id, title, line, emoji, status")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(limit);
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const { data: profiles } = await db
      .from("profiles")
      .select("id, nickname")
      .in("id", [...new Set(rows.map((r) => r.creator_id))]);
    const nick = new Map((profiles ?? []).map((p) => [p.id, p.nickname]));
    return rows.map((r) => toMeme(r, nick.get(r.creator_id) ?? null));
  } catch {
    return [];
  }
}

/** 반려·탈퇴 때 기준 음성을 지운다. 실패해도 호출부 흐름은 막지 않는다. */
export async function removeUgcAudio(id: string): Promise<void> {
  const token = process.env.UGC_TOKEN;
  if (!token || !UGC_ID.test(id)) return;
  try {
    await fetch(
      `${config.ugcRemoveUrl}?token=${encodeURIComponent(token)}&meme_id=${encodeURIComponent(id)}`,
      { method: "POST", signal: AbortSignal.timeout(20_000) },
    );
  } catch {
    // 남은 파일은 목록·링크에서 이미 끊겼다. 다음 정리 때 다시 지운다.
  }
}
