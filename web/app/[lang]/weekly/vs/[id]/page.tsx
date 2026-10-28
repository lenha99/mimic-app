import type { Metadata } from "next";
import { displayName, weekScript } from "@/lib/weekly";
import { getBoard, liveWeek } from "@/lib/weekly-server";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import Duel from "./duel";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ b?: string }> };

async function load(params: Props["params"], searchParams: Props["searchParams"]) {
  const [{ id }, { b }] = await Promise.all([params, searchParams]);
  const week = await liveWeek();
  const board = await getBoard(week).catch(() => null);
  const find = (x?: string) => board?.entries.find((e) => e.id === x) ?? null;
  return { week, a: find(id), b: b && b !== id ? find(b) : null };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const lang = await getLang();
  const t = tr(lang);
  const { a, b } = await load(params, searchParams);
  if (!a) return { title: t("1:1 목소리 대결", "1:1 voice duel"), robots: { index: false } };
  const an = displayName(a.name, lang);
  const title = b
    ? t(`${an} vs ${displayName(b.name, lang)} · 누가 더 잘했어?`, `${an} vs ${displayName(b.name, lang)} · Who did it better?`)
    : t(`${an}님이 1:1 목소리 대결을 신청했어요`, `${an} challenged you to a 1:1 voice duel`);
  const description = t("같은 대본, 두 목소리. 들어 보고 한쪽을 골라 주세요!", "Same script, two voices. Listen and pick one!");
  const image = `/api/og/weekly?id=${a.id}&lang=${t("ko", "en")}`;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** 대결 상황(몇 대 몇)은 화면이 붙은 뒤 API 로 — 표 하나에 바뀐다. */
export default async function DuelPage({ params, searchParams }: Props) {
  const { week, a, b } = await load(params, searchParams);
  const script = weekScript(week);
  return <Duel week={week} a={a} b={b} scriptText={script?.text ?? ""} />;
}
