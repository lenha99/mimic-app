import type { Metadata } from "next";
import { findRoom } from "@/lib/room-server";
import { createServiceClient } from "@/lib/supabase/service";
import RelayRoom from "./room";

export const dynamic = "force-dynamic";

/** 링크 미리보기 — 카톡에 붙였을 때 장면 제목이 보이게. 검색에는 안 나온다(링크가 입장권). */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const room = await findRoom(code).catch(() => null);
  const { data: s } = room ? await createServiceClient().from("relay_scenes").select("title, logline").eq("id", room.scene_id).maybeSingle() : { data: null };
  const title = s ? `「${s.title}」 같이 더빙해요 — MIMIC` : "더빙 방 — MIMIC";
  const description = s ? `${s.logline} · 배역 하나 골라 녹음하면 친구들 목소리와 한 장면이 돼요` : "친구들과 배역을 나눠 한 장면을 더빙해요";
  return { title, description, robots: { index: false }, openGraph: { title, description } };
}

export default async function RelayRoomPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { code } = await params;
  const q = await searchParams;
  const role = typeof q.role === "string" && /^[a-z0-9_-]{1,32}$/i.test(q.role) ? q.role : null;
  return <RelayRoom code={code} targetRole={role} />;
}
