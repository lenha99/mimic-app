import type { Metadata } from "next";
import { getT } from "@/lib/i18n-server";
import Duel from "./duel";

type Props = { searchParams: Promise<{ line?: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const title = t("명대사 대결 — 내가 니 이겼다", "Line battle");
  const description = t("폰 하나로 돌려 가며 애니 명대사를 외치고, 기합 점수로 1등을 가려요.", "Pass one phone around, shout anime lines, crown the winner.");
  return { title, description, openGraph: { title, description } };
}

export default async function DuelPage({ searchParams }: Props) {
  const { line } = await searchParams;
  return <Duel first={typeof line === "string" ? line : null} />;
}
