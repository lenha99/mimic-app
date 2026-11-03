import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { animeLine } from "@/lib/anime";
import { getT } from "@/lib/i18n-server";
import Solo from "./solo";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const line = animeLine((await params).id);
  const t = await getT();
  if (!line) return { title: t("없는 대사예요", "Line not found"), robots: { index: false } };
  const title = t(`「${line.say}」 따라 외치기`, `Shout "${line.en}"`);
  const description = t(`${line.series} ${line.who}의 명대사. 기합 점수 받고 친구랑 대결해요.`, `${line.seriesEn} · ${line.whoEn}. Get a hype score and battle friends.`);
  return { title, description, openGraph: { title, description } };
}

export default async function AnimeLinePage({ params }: Props) {
  const line = animeLine((await params).id);
  if (!line) notFound();
  return <Solo id={line.id} />;
}
