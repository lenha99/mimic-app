import type { Metadata } from "next";
import { BackHome } from "@/components/back-home";
import { getT } from "@/lib/i18n-server";
import { AvatarStudio } from "./studio";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("내 캐릭터", "My character"),
    description: t("버럭이부터 할머니까지. 녹음하면 이 캐릭터가 내 목소리로 외쳐요.", "From Grumpy to Grandma — your character shouts in your voice."),
  };
}

/**
 * 캐릭터 꾸미기 탭.
 *
 * 로그인 없이도 된다. 꾸미는 재미가 로그인 벽 뒤에 있으면 대부분 문 앞에서 돌아간다.
 * 로그인 전에 꾸민 건 이 브라우저에 두고, 로그인하면 계정으로 저장한다.
 */
export default function AvatarPage() {
  return (
    <main className="shell">
      <BackHome />
      <AvatarStudio />
    </main>
  );
}
