import type { Metadata } from "next";
import Link from "next/link";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import { cardQuery, readCard, verdict } from "@/lib/voice-card";
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
  if (!card) return { title: t("목소리 사극 판정", "Voice casting"), robots: { index: false } };
  const { role } = verdict(card);
  const title = t(`내 목소리, 사극에선 「${role.ko}」 역`, `My voice got cast as ${role.en}`);
  const description = t(
    "왕·간신·망나니·삐에로… 너는 무슨 역? 대사 한 줄이면 10초 만에 판정.",
    "King, Schemer, Executioner, Jester… what's your role? One line, 10 seconds.",
  );
  const image = `/api/og/voice?${cardQuery(card)}&ui=${t("ko", "en")}`;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** 친구가 보낸 판정 — 보고 나서 "나도 받아 보기"가 이 화면의 전부다. */
export default async function SharedCard({ searchParams }: Props) {
  const t = tr(await getLang());
  const card = await cardFrom(searchParams);
  return (
    <main className={`shell ${styles.page}`}>
      <p className={styles.friend}>
        {card
          ? t("친구가 보낸 목소리 사극 판정", "A friend sent you their voice casting")
          : t("판정 정보가 잘못됐어요.", "This link is broken.")}
      </p>
      {card && <VoiceCard card={card} stamp />}
      <div className={styles.actions}>
        <Link href="/voice" className={styles.primary}>
          {t("🎙️ 나는 무슨 역? 판정 받기", "🎙️ What's my role? Get cast")}
        </Link>
      </div>
      <p className={styles.note}>{t("녹음은 서버로 보내지 않아요 · 10초면 끝", "Nothing gets uploaded · takes 10 seconds")}</p>
    </main>
  );
}
