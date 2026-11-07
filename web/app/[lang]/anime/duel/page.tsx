import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import { getMemes } from "@/lib/memes";
import { movieLines } from "@/lib/movie-lines";
import Duel, { type Pack } from "./duel";

type Props = { searchParams: Promise<{ line?: string; pack?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = t("애니 명대사 대결 — 내가 니 이겼다", "Anime line battle");
  const description = t("폰 하나로 돌려 가며 애니 명대사를 외치고, 원본과 닮은 점수로 1등을 가려요.", "Pass one phone around, shout anime lines, crown the winner.");
  return { title, description, openGraph: { title, description } };
}

export const revalidate = 300;

/** 애니 화면에서 들어온 대결 — 애니 묶음으로 열린다(바꿀 수 있다) */
export default async function AnimeDuelPage({ searchParams }: Props) {
  const [{ line, pack }, { memes }] = await Promise.all([searchParams, getMemes()]);
  const p: Pack = pack === "movie" || pack === "mix" ? pack : "anime";
  return <Duel first={typeof line === "string" ? line : null} movies={movieLines(memes)} pack={p} back="anime" />;
}
