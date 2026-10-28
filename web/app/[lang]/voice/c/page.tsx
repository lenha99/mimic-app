import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import { cardQuery, readCard, VOICE_TYPES } from "@/lib/voice-card";
import { VoiceCard } from "../card";
import styles from "../voice.module.css";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

async function cardFrom(searchParams: Props["searchParams"]) {
  const raw = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") q.set(k, v);
  return readCard(q);
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const t = tr(await getLang());
  const card = await cardFrom(searchParams);
  if (!card) return { title: t("보이스 카드", "Voice card"), robots: { index: false } };
  const type = VOICE_TYPES[card.type];
  const title = t(`내 목소리 유형은 「${type.ko}」`, `My voice type: ${type.en}`);
  const description = t("너는 무슨 유형? 문장 하나 읽으면 10초 만에 나와요.", "What's yours? Read one line and find out in 10 seconds.");
  const image = `/api/og/voice?${cardQuery(card, card.lang)}&ui=${t("ko", "en")}`;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** 친구가 보낸 카드 — 보고 나서 "나도 해 보기"가 이 화면의 전부다. */
export default async function SharedCard({ searchParams }: Props) {
  const t = tr(await getLang());
  const card = await cardFrom(searchParams);
  return (
    <main className={`shell ${styles.page}`}>
      {card ? (
        <>
          <p className={styles.friend}>{t("친구가 보낸 보이스 카드", "A friend sent you their voice card")}</p>
          <VoiceCard card={card} readLang={card.lang} />
        </>
      ) : (
        <p className={styles.friend}>{t("카드 정보가 잘못됐어요.", "This card link is broken.")}</p>
      )}
      <div className={styles.actions}>
        <Link href="/voice" className={styles.primary}>
          {t("🎙️ 내 목소리 유형도 알아보기", "🎙️ Find my voice type")}
        </Link>
        <Link href="/weekly" className={styles.secondary}>
          {t("이번 주 보이스 챌린지 구경하기 →", "See this week's voice challenge →")}
        </Link>
      </div>
    </main>
  );
}
