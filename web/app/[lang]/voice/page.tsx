import type { Metadata } from "next";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import Maker from "./maker";

export async function generateMetadata(): Promise<Metadata> {
  const t = tr(await getLang());
  const title = t("목소리 음역대 테스트 · 내 목소리는 몇 옥타브?", "Vocal range test · How many octaves is your voice?");
  const description = t(
    "1부터 10까지 세고, 끝까지 내리고, 끝까지 올리면 건반 위에 내 음역이 나와요.",
    "Count to 10, slide down, slide up — your range lights up on a piano keyboard.",
  );
  const image = "/api/og/voice";
  return { title, description, openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] } };
}

export default function VoicePage() {
  return <Maker />;
}
