import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import { cardQuery, noteName, readCard, summary } from "@/lib/voice-range";
import { RangeCardView } from "../card";
import styles from "../voice.module.css";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function cardFrom(searchParams: Props["searchParams"]) {
  const raw = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") q.set(k, v);
  return readCard(q);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const lang = await getLang();
  const t = tr(lang);
  const card = await cardFrom(searchParams);
  if (!card) return { title: t("목소리 음역대 테스트", "Vocal range test"), robots: { index: false } };
  const s = summary(card, lang);
  const title =
    s.range !== null
      ? t(`내 목소리 음역 ${s.range}옥타브 · ${s.sub}`, `My vocal range: ${s.range} octaves · ${s.sub}`)
      : t(`평소 내 목소리 음은 ${s.headline}`, `My speaking note is ${s.headline}`);
  const description = t(
    "평소 목소리 · 가장 낮은 음 · 가장 높은 음. 너는 몇 옥타브? 30초면 재요.",
    "Speaking voice, lowest note, highest note. How many octaves do you have? Takes 30 seconds.",
  );
  const image = `/api/og/voice?${cardQuery(card)}&ui=${lang}`;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** 친구가 보낸 음역 — 보고 나서 "나도 재 보기"가 이 화면의 전부다. 최고음이 있으면 그걸 깨 보라고 부른다. */
export default async function SharedCard({ searchParams }: Props) {
  const lang = await getLang();
  const t = tr(lang);
  const card = await cardFrom(searchParams);
  const high = card?.high != null ? noteName(card.high, lang).full : null;
  return (
    <main className={`shell ${styles.page}`}>
      <p className={styles.friend}>
        {card
          ? t("친구가 보낸 목소리 음역대", "A friend sent you their vocal range")
          : t("목소리 테스트가 새로 바뀌었어요. 내 음역대를 재 보세요!", "The voice test got an upgrade. Measure your range!")}
      </p>
      {card && <RangeCardView card={card} />}
      <div className={styles.actions}>
        <Link href="/voice" className={styles.primary}>
          {high ? t(`🎙️ ${high}, 넘을 수 있어?`, `🎙️ Can you beat ${high}?`) : t("🎙️ 나는 몇 옥타브? 재 보기", "🎙️ How many octaves am I?")}
        </Link>
      </div>
      <p className={styles.note}>{t("녹음 파일은 만들지 않아요 · 30초면 끝", "Nothing is recorded · takes 30 seconds")}</p>
    </main>
  );
}
