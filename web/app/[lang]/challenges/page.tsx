import type { Metadata } from "next";
import { listApprovedChallenges } from "@/lib/challenges";
import { getMemes, playCount, type Meme } from "@/lib/memes";
import { getT } from "@/lib/i18n-server";
import Challenges, { type Card } from "./challenges";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("챌린지", "Challenges"),
    description: t(
      "레전드 명대사를 듣고 따라 하면 억양·음색·박자까지 AI가 점수로 알려드려요. 친구랑 점수 대결해 보세요!",
      "Copy iconic Korean movie lines and get AI-scored on pitch, tone and rhythm. Then challenge your friends!",
    ),
  };
}

/** 홈과 같은 5분 — 카탈로그와 친구 챌린지가 바뀌는 주기. */
export const revalidate = 300;

const card = (m: Meme): Card => ({
  id: m.id,
  title: m.title,
  source: m.source,
  emoji: m.emoji,
  line: m.line ?? null,
  plays: playCount(m),
});

export default async function ChallengesPage() {
  const [{ memes }, friends] = await Promise.all([getMemes(), listApprovedChallenges(30)]);
  return (
    <Challenges
      lines={memes.filter((m) => m.line).map(card)}
      friends={friends.map(card)}
      warmups={memes.filter((m) => !m.line).map(card)}
    />
  );
}
