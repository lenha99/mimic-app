import type { Metadata } from "next";
import { expectedSeconds } from "@/lib/practice";
import { seasonLabel, weekScript } from "@/lib/weekly";
import { getBoard, lastWeekWinners, liveWeek } from "@/lib/weekly-server";
import Hub from "./hub";

export const metadata: Metadata = {
  title: "이번 주 보이스 챌린지",
  description: "매주 대본 하나. 연습하고 출전해서 ❤ 를 모으면 시상대에 올라요. 로그인 없이 바로 출전.",
};

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
  return (
    <Hub
      week={week}
      label={seasonLabel(week)}
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
