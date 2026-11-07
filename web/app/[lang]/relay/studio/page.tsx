import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import RelayStudio from "./studio";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("감독 스튜디오 — 릴레이 더빙", "Director studio — Relay Dubbing"), robots: { index: false } };
}

export default function RelayStudioPage() {
  return <RelayStudio />;
}
