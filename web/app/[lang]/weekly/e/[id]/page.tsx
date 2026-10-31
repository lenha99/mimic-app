import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { currentWeek, displayName, seasonLabel, weekScript } from "@/lib/weekly";
import { getEntry } from "@/lib/weekly-server";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import Stage from "./stage";

type Props = { params: Promise<{ id: string }> };

/** 링크로 들어오는 첫 화면 — 순위·❤ 는 30초 안쪽이면 충분하다. */
export const revalidate = 30;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const entry = await getEntry((await params).id).catch(() => null);
  const lang = await getLang();
  const t = tr(lang);
  if (!entry) return { title: t("없는 출전작이에요", "Entry not found"), robots: { index: false } };
  const name = displayName(entry.name, lang);
  const title = t(`${name}의 「${entry.week.title}」`, `${name} — "${entry.week.titleEn}"`);
  const description = t(
    `${seasonLabel(entry.week)} 보이스 챌린지 ${entry.rank}위 · ❤ ${entry.likes}. 들어보고 마음에 들면 ❤ 하나 눌러 주세요!`,
    `${seasonLabel(entry.week, "en")} voice challenge · #${entry.rank} · ❤ ${entry.likes}. Give it a listen and tap ❤!`,
  );
  const image = `/api/og/weekly?id=${entry.id}&lang=${t("ko", "en")}`;
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
      label={seasonLabel(entry.week, await getLang())}
      scriptText={script?.text ?? ""}
      thisWeek={now}
    />
  );
}
