import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import NewRoom from "./new-room";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("방 만들기 — 릴레이 더빙", "New room — Relay Dubbing"), robots: { index: false } };
}

export default function NewRoomPage() {
  return <NewRoom />;
}
