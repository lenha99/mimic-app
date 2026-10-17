import type { Metadata } from "next";
import { listApprovedChallenges } from "@/lib/challenges";
import { getMemes, playCount, type Meme } from "@/lib/memes";
import { socialReady } from "@/lib/social";
import Challenges, { type Card } from "./challenges";

export const metadata: Metadata = {
  title: "챌린지",
  description: "명대사를 듣고 따라 외치면 억양·음색·타이밍을 채점해요. 친구한테 점수로 도전장을 던져보세요.",
};

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
  const [{ memes }, friends, social] = await Promise.all([
    getMemes(),
    listApprovedChallenges(30),
    socialReady(),
  ]);
  return (
    <Challenges
      lines={memes.filter((m) => m.line).map(card)}
      friends={friends.map(card)}
      warmups={memes.filter((m) => !m.line).map(card)}
      social={social}
    />
  );
}
