import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import PassView from "./pass-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: "VOICE PASS",
    description: t("목소리를 올리고 ❤ 를 모으면 레벨이 올라요. 아바타 프레임·닉네임 효과·배지가 풀려요.", "Post voices and collect ❤ to level up and unlock frames, name effects and badges."),
  };
}

export default function PassPage() {
  return <PassView />;
}
