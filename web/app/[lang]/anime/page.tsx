import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import AnimeHub from "./hub";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = t("애니 명대사 기합 대결", "Anime lines hype battle");
  const description = t(
    "심장을 바쳐라! 해적왕이 될 거야! 애니 명대사를 원어로 외치고 원본과 닮은 점수 받기. 친구랑 폰 하나로 대결해요.",
    "Shout iconic anime lines, get a hype score, and battle friends on one phone.",
  );
  return { title, description, openGraph: { title, description } };
}

export default function AnimePage() {
  return <AnimeHub />;
}
