import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { refAudio } from "@/lib/config";
import { getMemes } from "@/lib/memes";
import { findScript, neighbors, practiceLines, scriptNumber, SCRIPTS, TRACK_LABEL } from "@/lib/practice";
import Room, { type RoomItem } from "./room";

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
  const item = await resolve((await params).id);
  if (!item) return { title: "없는 대본" };
  if (item.kind === "script") {
    const s = item.script;
    return {
      title: `${s.title} · ${TRACK_LABEL[s.track]} 연습`,
      description: `${s.category} 대본. ${s.direction}`,
    };
  }
  return {
    title: `${item.meme.title} · 명대사 연습`,
    description: `“${item.meme.line}” 원본과 억양·타이밍을 비교해 채점해요.`,
  };
}

export default async function PracticeRoomPage({ params }: Props) {
  const item = await resolve((await params).id);
  if (!item) notFound();
  return <Room item={item} />;
}
