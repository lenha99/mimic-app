import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentWeek, seasonLabel, weekScript } from "@/lib/weekly";
import { getEntry } from "@/lib/weekly-server";
import Stage from "./stage";

type Props = { params: Promise<{ id: string }> };

/** 링크로 들어오는 첫 화면 — 순위·❤ 는 30초 안쪽이면 충분하다. */
export const revalidate = 30;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getEntry((await params).id).catch(() => null);
  if (!entry) return { title: "없는 출전작", robots: { index: false } };
  const title = `${entry.name}의 「${entry.week.title}」`;
  const description = `${seasonLabel(entry.week)} 보이스 챌린지 ${entry.rank}위 · ❤ ${entry.likes}. 들어보고 ❤ 를 눌러 주세요.`;
  const image = `/api/og/weekly?id=${entry.id}`;
  return {
    title,
    description,
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default async function EntryPage({ params }: Props) {
  const entry = await getEntry((await params).id).catch(() => null);
  if (!entry) notFound();
  const script = weekScript(entry.week);
  const now = currentWeek();
  return (
    <Stage
      entry={{
        id: entry.id,
        rank: entry.rank,
        total: entry.total,
        name: entry.name,
        guest: entry.guest,
        avatar: entry.avatar,
        duration: entry.duration,
        likes: entry.likes,
        plays: entry.plays,
        trophies: entry.trophies,
        createdAt: entry.createdAt,
      }}
      week={entry.week}
      label={seasonLabel(entry.week)}
      scriptText={script?.text ?? ""}
      thisWeek={now}
    />
  );
}
