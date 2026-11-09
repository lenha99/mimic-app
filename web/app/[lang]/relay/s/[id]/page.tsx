import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadScene, publicView } from "@/lib/relay-server";
import RelayScene from "./scene";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = await loadScene(id, null).catch(() => null);
  if (!s || s.status === "void" || s.status === "pending" || s.status === "queued") return { title: "Relay Dubbing", robots: { index: false } };
  return { title: `${s.title} — 릴레이 더빙`, description: s.logline, openGraph: { title: s.title, description: s.logline } };
}

export default async function RelayScenePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await loadScene(id, null).catch(() => null);
  // 대기 중 장면은 감독만 본다 — 서버는 누가 보는지 모르니 클라이언트가 다시 받아 본다
  if (!s || s.status === "void") notFound();
  // 친구 방 장면은 방 화면으로(방 화면은 장면 id 도 받는다)
  if (s.status === "room" || s.status === "room_done") redirect(`/relay/r/${id}`);
  const hidden = s.status === "pending" || s.status === "queued";
  return <RelayScene id={id} initial={hidden ? null : publicView(s)} />;
}
