import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import RelayRecorder from "./recorder";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("릴레이 더빙 — 내 대사 녹음", "Relay Dubbing — record"), robots: { index: false } };
}

export default async function RelayRecPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  return <RelayRecorder sceneId={one(q.scene)} lineId={one(q.line)} room={one(q.room)} />;
}
