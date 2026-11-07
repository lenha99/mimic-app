import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import { getMemes } from "@/lib/memes";
import { movieLines } from "@/lib/movie-lines";
import Duel, { type Pack } from "../anime/duel/duel";

type Props = { searchParams: Promise<{ pack?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = t("명대사 대결 — 내가 니 이겼다", "Line battle");
  const description = t(
    "폰 하나로 돌려 가며 영화·드라마·애니 명대사를 외치고, 원본과 누가 더 똑같은지로 1등을 가려요.",
    "Pass one phone around, shout iconic movie and anime lines, and see who sounds most like the original.",
  );
  return { title, description, openGraph: { title, description } };
}

export const revalidate = 300;

/** 챌린지에서 들어온 명대사 대결 — 기본은 영화·드라마 대사 */
export default async function DuelPage({ searchParams }: Props) {
  const [{ pack }, { memes }] = await Promise.all([searchParams, getMemes()]);
  const p: Pack = pack === "anime" || pack === "mix" ? pack : "movie";
  return <Duel first={null} movies={movieLines(memes)} pack={p} back="challenges" />;
}
