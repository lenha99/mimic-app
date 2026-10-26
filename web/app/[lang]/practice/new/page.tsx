import type { Metadata } from "next";
import { Suspense } from "react";
import { getT } from "@/lib/i18n-server";
import { ScriptEditor } from "./editor";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("내 대본 넣기", "Add my script"),
    description: t(
      "오디션·학원 대본을 넣고 연습실에서 똑같이 진단받아요. 대본은 이 폰에만 저장돼요.",
      "Add an audition or class script and get the same analysis. It's saved on this phone only.",
    ),
    robots: { index: false },
  };
}

export default function NewScriptPage() {
  return (
    <Suspense fallback={null}>
      <ScriptEditor />
    </Suspense>
  );
}
