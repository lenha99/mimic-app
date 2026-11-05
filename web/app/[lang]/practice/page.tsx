import type { Metadata } from "next";
import { getMemes } from "@/lib/memes";
import { boardPulse } from "@/lib/board-server";
import { practiceLines, SCRIPTS } from "@/lib/practice";
import { getT } from "@/lib/i18n-server";
import PracticeHome from "./practice-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("연습실", "Practice Room"),
    description: t(
      `성우·아나운서 준비생을 위한 대본 ${SCRIPTS.length}편. 읽고 녹음하면 코코가 대본대로 읽었는지 짚어 주고 목소리 타입도 알려 줘요. 녹음은 내 폰에만 남아요.`,
      `${SCRIPTS.length} Korean scripts for voice actors and anchors. Record and Coco checks you read it word for word, plus your voice type. Takes stay on your phone.`,
    ),
  };
}

/** 대본은 정적, 명대사는 카탈로그를 따른다(홈과 같은 5분). */
export const revalidate = 300;

export default async function PracticePage() {
  const [{ memes }, pulse] = await Promise.all([getMemes(), boardPulse()]);
  const lines = practiceLines(memes).map((m) => ({
    id: m.id,
    title: m.title,
    source: m.source,
    line: m.line ?? "",
  }));
  return <PracticeHome scripts={SCRIPTS} lines={lines} pulse={pulse} />;
}
