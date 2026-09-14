import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { refAudio } from "@/lib/config";
import { getMemes } from "@/lib/memes";
import Recorder from "./recorder";
import styles from "./record.module.css";

type Props = { params: Promise<{ id: string }> };

async function findMeme(id: string) {
  const { memes } = await getMemes();
  return memes.find((m) => m.id === id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const meme = await findMeme((await params).id);
  if (!meme) return { title: "없는 챌린지" };
  return {
    title: `${meme.title} 따라하기`,
    description: `${meme.source} 소리를 따라해 보세요. AI가 피치·톤·타이밍을 채점합니다.`,
  };
}

export default async function RecordPage({ params }: Props) {
  const meme = await findMeme((await params).id);
  if (!meme) notFound();

  return (
    <main className="shell">
      <header className={styles.head}>
        <Link href="/" className={styles.back}>
          ← 목록
        </Link>
        <div className={styles.titleRow}>
          <span className={styles.emoji} aria-hidden="true">
            {meme.emoji}
          </span>
          <div>
            <h1 className={styles.title}>{meme.title}</h1>
            <p className={styles.source}>{meme.source}</p>
          </div>
        </div>
      </header>

      <Recorder meme={meme} refUrl={refAudio(meme.id)} />
    </main>
  );
}
