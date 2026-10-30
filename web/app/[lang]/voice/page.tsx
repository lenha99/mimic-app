import type { Metadata } from "next";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import Maker from "./maker";

export async function generateMetadata(): Promise<Metadata> {
  const t = tr(await getLang());
  const title = t("목소리 음역대 테스트 · 🐬 돌고래 고음? 🕳️ 동굴 목소리?", "Vocal range test · 🐬 Dolphin highs? 🕳️ Cave-deep lows?");
  const description = t(
    "대본 한 줄 읽고, 끝까지 내리고, 끝까지 올리면 내 고음·저음 등급이 나와요.",
    "Read a line, slide down, slide up — get your high and low tiers on a piano keyboard.",
  );
  const image = "/api/og/voice";
  return { title, description, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] } };
}

export default function VoicePage() {
  return <Maker />;
}
