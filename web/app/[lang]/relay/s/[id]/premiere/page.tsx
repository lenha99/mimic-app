import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadScene, publicView } from "@/lib/relay-server";
import RelayPremiere from "./premiere";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = await loadScene(id, null).catch(() => null);
  if (!s || (s.status !== "premiered" && s.status !== "live")) return { title: "Relay Dubbing", robots: { index: false } };
  const n = s.final?.realActors ?? 0;
  const title = `🍿 ${s.title}`;
  const description = n ? `${n}명의 목소리로 완성된 릴레이 더빙 — ${s.logline}` : s.logline;
  return { title, description, openGraph: { title, description } };
}

export default async function RelayPremierePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await loadScene(id, null).catch(() => null);
  if (!s || (s.status !== "premiered" && s.status !== "live")) notFound();
  return <RelayPremiere scene={publicView(s)} />;
}
