import type { Metadata } from "next";
import { expectedSeconds } from "@/lib/practice";
import { seasonLabel, weekScript } from "@/lib/weekly";
import { findScript } from "@/lib/practice";
import { galleryEntries, getBoard, lastWeekWinners, liveWeek, RANKED_MIN } from "@/lib/weekly-server";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import Gallery from "./gallery";
import Hub from "./hub";

export async function generateMetadata(): Promise<Metadata> {
  const t = tr(await getLang());
  return {
    title: t("목소리 갤러리 · 이번 주 ❤ 순위", "Voice gallery · this week's ❤ ranking"),
    description: t(
      "연습실에서 녹음한 목소리를 올리고 들어 보세요. 어떤 대본이든 ❤ 를 모으면 이번 주 시상대에 올라요. 가입 없이 바로.",
      "Post and hear voices from the Practice Room. Any script — collect ❤ to take this week's podium. No sign-up needed.",
    ),
  };
}

/**
 * 30초마다 다시 만든다. 순위는 ❤ 하나에 바뀌지만 요청마다 서버에서 그리면 첫 화면이
 * 콜드 스타트만큼 늦는다(홈 주석 참고). 내가 누른 ❤ 는 화면이 바로 반영한다.
 */
export const revalidate = 30;

export default async function WeeklyPage() {
  const week = await liveWeek();
  const [board, last] = await Promise.all([
    getBoard(week).catch(() => ({ week, entries: [], totalLikes: 0 })),
    lastWeekWinners().catch(() => null),
  ]);
  const script = weekScript(week);
  // 이번 주 출전작이 모이기 전엔 갤러리(쌓인 목소리 듣기)가 첫 화면이다. 순위판은 RANKED_MIN 개부터.
  if (board.entries.length < RANKED_MIN) {
    const gallery = await galleryEntries(80).catch(() => []);
    return (
      <Gallery
        week={week}
        entries={gallery}
        thisWeek={board.entries.length}
        rankedMin={RANKED_MIN}
        line={firstLine(findScript(week.scriptId)?.text ?? "")}
      />
    );
  }
  return (
    <Hub
      week={week}
      label={seasonLabel(week, await getLang())}
      entries={board.entries}
      totalLikes={board.totalLikes}
      script={
        script
          ? { text: script.text, direction: script.direction, seconds: expectedSeconds(script), category: script.category }
          : null
      }
      last={last}
    />
  );
}

/** 대본 첫 줄 — 쉼(/)·강조(*) 표시를 걷어내고 짧게. */
function firstLine(text: string): string {
  const first = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const plain = first.replace(/[/*]/g, " ").replace(/\s+/g, " ").trim();
  return plain.length > 44 ? `${plain.slice(0, 43)}…` : plain;
}
