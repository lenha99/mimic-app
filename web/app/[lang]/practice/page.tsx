import type { Metadata } from "next";
import { getMemes } from "@/lib/memes";
import { waitingCount } from "@/lib/board-server";
import { practiceLines, SCRIPTS } from "@/lib/practice";
import { getT } from "@/lib/i18n-server";
import PracticeHome from "./practice-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("연습실", "Practice Room"),
    description: t(
      `성우·아나운서 준비생을 위한 대본 ${SCRIPTS.length}편. 읽고 녹음하면 속도·쉼·억양·말끝을 바로 짚어드려요. 녹음은 내 폰에만 남아요.`,
      `${SCRIPTS.length} Korean scripts for voice actors and anchors. Record and get instant notes on pace, pauses, intonation and endings. Takes stay on your phone.`,
    ),
  };
}

/** 대본은 정적, 명대사는 카탈로그를 따른다(홈과 같은 5분). */
export const revalidate = 300;

export default async function PracticePage() {
  const [{ memes }, waiting] = await Promise.all([getMemes(), waitingCount()]);
  const lines = practiceLines(memes).map((m) => ({
    id: m.id,
    title: m.title,
    source: m.source,
    line: m.line ?? "",
  }));
  return <PracticeHome scripts={SCRIPTS} lines={lines} waiting={waiting} />;
}
