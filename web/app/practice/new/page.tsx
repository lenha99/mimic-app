import type { Metadata } from "next";
import { Suspense } from "react";
import { ScriptEditor } from "./editor";

export const metadata: Metadata = {
  title: "내 대본 넣기",
  description: "오디션·학원 대본을 넣고 연습실에서 똑같이 진단받아요. 대본은 이 폰에만 저장돼요.",
  robots: { index: false },
};

export default function NewScriptPage() {
  return (
    <Suspense fallback={null}>
      <ScriptEditor />
    </Suspense>
  );
}
