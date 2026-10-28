import type { Metadata } from "next";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import Maker from "./maker";

export async function generateMetadata(): Promise<Metadata> {
  const t = tr(await getLang());
  const title = t("보이스 카드 · 내 목소리 유형 알아보기", "Voice card · Find your voice type");
  const description = t(
    "문장 하나 읽으면 10초 만에 내 목소리 유형과 어울리는 배역이 나와요.",
    "Read one line and get your voice type and the roles that fit you in 10 seconds.",
  );
  return { title, description, openGraph: { title, description } };
}

export default function VoicePage() {
  return <Maker />;
}
