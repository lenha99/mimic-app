import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { followerCount, follows, currentUserId, profileByNickname } from "@/lib/social-server";
import { createServiceClient } from "@/lib/supabase/service";
import { weekById } from "@/lib/weekly";
import { getT } from "@/lib/i18n-server";
import Portfolio from "./portfolio";

type Props = { params: Promise<{ name: string }> };

/**
 * 목소리 포트폴리오 — /v/닉네임. 인스타 프로필에 걸 수 있는 "내 목소리 모음" 링크.
 * 출전작 · 받은 ❤ · 수상 · 구독자 수, 그리고 구독 · 메시지 버튼.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = decodeURIComponent((await params).name);
  const t = await getT();
  const title = t(`${name}의 목소리 — MIMIC`, `${name}'s voice — MIMIC`);
  const description = t("보이스 챌린지 출전작 모음 · 들어보고 마음에 들면 구독해 주세요", "Voice challenge takes · listen and subscribe");
  return { title, description, openGraph: { title, description } };
}

export default async function PortfolioPage({ params }: Props) {
  const name = decodeURIComponent((await params).name);
  const service = createServiceClient();
  const creator = await profileByNickname(name, service);
  if (!creator) notFound();
  const viewer = await currentUserId();

  const [{ data: rows }, { count: awards }, followers, following] = await Promise.all([
    service
      .from("weekly_entries")
      .select("id, challenge_id, like_count, play_count, duration_s, updated_at")
      .eq("user_id", creator.id)
      .eq("hidden", false)
      .order("challenge_id", { ascending: false })
      .limit(30),
    service.from("weekly_awards").select("place", { count: "exact", head: true }).eq("user_id", creator.id),
    followerCount(creator.id, service),
    viewer && viewer !== creator.id ? follows(viewer, creator.id, service) : Promise.resolve(false),
  ]);

  const takes = (rows ?? []).flatMap((r) => {
    const w = weekById(r.challenge_id);
    return w
      ? [{ id: r.id, title: w.title, titleEn: w.titleEn, emoji: w.emoji, likes: r.like_count, plays: r.play_count, duration: r.duration_s, v: r.updated_at }]
      : [];
  });

  return (
    <Portfolio
      creator={{ id: creator.id, nickname: creator.nickname, avatar: creator.avatar, dmPolicy: creator.dmPolicy }}
      takes={takes}
      stats={{ followers, likes: takes.reduce((n, x) => n + x.likes, 0), awards: awards ?? 0 }}
      viewer={{ loggedIn: Boolean(viewer), self: viewer === creator.id, following }}
    />
  );
}
