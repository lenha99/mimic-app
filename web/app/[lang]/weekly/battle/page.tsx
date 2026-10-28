import type { Metadata } from "next";
import { getLang } from "@/lib/i18n-server";
import { tr } from "@/lib/i18n";
import Battle from "./battle";

export async function generateMetadata(): Promise<Metadata> {
  const t = tr(await getLang());
  return {
    title: t("블라인드 보이스 배틀", "Blind voice battle"),
    description: t(
      "이름도 캐릭터도 없이 같은 대본을 읽은 두 목소리. 더 좋은 쪽을 골라 주세요.",
      "Two voices, same script, no names. Pick the better one.",
    ),
  };
}

/** 짝은 요청마다 서버가 고른다 — 페이지는 껍데기만 정적으로. */
export default function BattlePage() {
  return <Battle />;
}
