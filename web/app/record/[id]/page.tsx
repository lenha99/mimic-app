import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { refAudio } from "@/lib/config";
import { getMemes } from "@/lib/memes";
import Recorder from "./recorder";
import styles from "./record.module.css";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * 공유 링크에 실려 오는 친구 점수(`?s=87`).
 *
 * 링크를 받은 사람에게 "넘어야 할 숫자"를 보여주는 것이 이 앱의 유일한 자가증식
 * 장치다. 남의 입력이므로 0~100 정수만 통과시킨다.
 */
function parseBeat(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100 ? n : null;
}

async function findMeme(id: string) {
  // 미공개(draft) 밈도 직링크로는 열려야 한다 — 공개 전에 실기기에서 확인하는 경로다.
  const { memes } = await getMemes({ includeDraft: true });
  const meme = memes.find((m) => m.id === id);
  if (!meme) return null;

  // 결과 화면에서 목록으로 돌아가지 않고 바로 다음 소리로 넘어가기 위한 것.
  // 다음 소리는 공개된 것 중에서 고른다 — 미공개를 남에게 떠넘기면 안 된다.
  const live = memes.filter((m) => !m.draft);
  const at = live.findIndex((m) => m.id === id);
  const next = live.length > 1 && at >= 0 ? live[(at + 1) % live.length] : live[0] ?? null;
  return { meme, next: next && next.id !== id ? next : null };
}

export async function generateMetadata({
  params,
  searchParams,
}: Props): Promise<Metadata> {
  const found = await findMeme((await params).id);
  if (!found) return { title: "없는 챌린지" };

  const { meme } = found;
  const beat = parseBeat((await searchParams).s);

  // 점수가 실려 오면 카톡·DM 미리보기 자체가 도전장이 된다.
  // (OG 이미지는 아직 없다 — 이슈 #14. 그때까진 제목·설명으로 숫자를 보낸다.)
  const title = beat !== null ? `${meme.title} ${beat}점, 넘어봐` : `${meme.title} 따라하기`;
  const description =
    beat !== null
      ? `친구가 ${meme.title} 따라하기로 ${beat}점을 냈어요. 설치 없이 탭 한 번이면 도전할 수 있어요.`
      : `${meme.source} 소리를 따라해 보세요. 설치 없이 탭 한 번이면 점수가 나옵니다.`;

  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
  };
}

export default async function RecordPage({ params, searchParams }: Props) {
  const found = await findMeme((await params).id);
  if (!found) notFound();

  const { meme, next } = found;
  const beat = parseBeat((await searchParams).s);

  return (
    <main className="shell">
      <header className={styles.head}>
        <Link href="/" className={styles.back}>
          ← 다른 소리
        </Link>
        <div className={styles.titleRow}>
          <h1 className={styles.title}>{meme.title}</h1>
          <p className={styles.source}>{meme.source}</p>
        </div>
      </header>

      <Recorder
        meme={meme}
        refUrl={refAudio(meme.id)}
        beat={beat}
        next={next ? { id: next.id, title: next.title } : null}
      />
    </main>
  );
}
