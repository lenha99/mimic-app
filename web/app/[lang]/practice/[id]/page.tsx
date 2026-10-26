import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { refAudio } from "@/lib/config";
import { getMemes } from "@/lib/memes";
import { findScript, neighbors, practiceLines, scriptNumber, SCRIPTS, trackLabel } from "@/lib/practice";
import { MY_PREFIX } from "@/lib/my-scripts";
import { MyRoom } from "./my-room";
import Room, { type RoomItem } from "./room";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import { memeText } from "@/lib/meme-i18n";
import { fieldName, scriptTitle } from "@/lib/script-i18n";

type Props = { params: Promise<{ id: string }> };

/** 대본은 빌드 때 찍어두고, 명대사는 요청이 오면 만든다(카탈로그가 바뀔 수 있다). */
export function generateStaticParams() {
  return SCRIPTS.map((s) => ({ id: s.id }));
}

export const revalidate = 300;

async function resolve(id: string): Promise<RoomItem | null> {
  const script = findScript(id);
  if (script) {
    const { prev, next } = neighbors(id);
    const total = SCRIPTS.filter((s) => s.track === script.track).length;
    return {
      kind: "script",
      script,
      number: scriptNumber(id),
      total,
      prev: prev && { id: prev.id, title: prev.title },
      next: next && { id: next.id, title: next.title },
    };
  }

  const { memes } = await getMemes({ includeDraft: true });
  const lines = practiceLines(memes);
  const at = lines.findIndex((m) => m.id === id);
  if (at < 0) return null;
  const meme = lines[at];
  const live = lines.filter((m) => !m.draft);
  const j = live.findIndex((m) => m.id === id);
  const prev = j > 0 ? live[j - 1] : null;
  const next = j >= 0 && j < live.length - 1 ? live[j + 1] : null;
  return {
    kind: "line",
    meme,
    refUrl: refAudio(meme.id),
    number: j + 1,
    total: live.length,
    prev: prev && { id: prev.id, title: prev.title },
    next: next && { id: next.id, title: next.title },
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).id;
  const lang = await getLang();
  const t = tr(lang);
  if (id.startsWith(MY_PREFIX)) return { title: t("내 대본 연습", "My script practice"), robots: { index: false } };
  const item = await resolve(id);
  if (!item) return { title: t("없는 대본이에요", "Script not found") };
  if (item.kind === "script") {
    const s = item.script;
    return {
      title: t(`${s.title} · ${trackLabel(s.track, lang)} 연습`, `${scriptTitle(s.id, s.title, lang)} · ${trackLabel(s.track, lang)} practice`),
      description: t(`${s.category} 대본. ${s.direction}`, `${fieldName(s.category, lang)} script in Korean.`),
    };
  }
  const mt = memeText(item.meme, lang);
  return {
    title: t(`${mt.title} · 명대사 연습`, `${mt.title} · line practice`),
    description: t(
      `“${item.meme.line}” 원본과 억양·타이밍을 비교해 채점해요.`,
      `“${item.meme.line}” — scored against the original on pitch and rhythm.`,
    ),
  };
}

export default async function PracticeRoomPage({ params }: Props) {
  const id = (await params).id;
  // 내 대본은 서버가 모른다(이 기기에만 있다). 브라우저가 꺼내서 같은 연습 화면을 그린다.
  if (id.startsWith(MY_PREFIX)) return <MyRoom id={id} />;
  const item = await resolve(id);
  if (!item) notFound();
  return <Room item={item} />;
}
