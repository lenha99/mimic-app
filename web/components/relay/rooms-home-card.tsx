import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import s from "./relay.module.css";

/**
 * 홈 — "온라인으로 같이" 입구(11/10). 방 기능이 있는지조차 모르면 없는 기능이라 홈에 따로 알린다.
 */
export async function RoomsHomeCard() {
  const t = await getT();
  return (
    <Link href="/relay?tab=rooms" className={s.homeCard} data-tour="home-rooms">
      <span className={s.homeHead}>
        <b>👯 {t("온라인으로 같이 연습해요", "Practice together online")}</b>
        <span className={s.homeNew}>NEW</span>
      </span>
      <span className={s.muted}>
        {t(
          "멀리 있는 친구랑도 링크 하나로 한 방에. 대본을 붙여 넣고 같이 읽고, 녹음하고, 실시간 채팅으로 떠들어요.",
          "One link puts friends anywhere in the same room — paste a script, read, record and chat live.",
        )}
      </span>
      <span className={s.homeScenes}>
        <span className={s.homeScene}>
          <i aria-hidden="true">🎭</i>
          <span>{t("연극·뮤지컬 대본 맞춰 보기", "Run lines for a play")}</span>
        </span>
        <span className={s.homeScene}>
          <i aria-hidden="true">🎤</i>
          <span>{t("발표·스피치·아나운서 원고 연습", "Speech & news-reading practice")}</span>
        </span>
        <span className={s.homeScene}>
          <i aria-hidden="true">🎬</i>
          <span>{t("준비된 장면으로 배역 나눠 더빙", "Split roles in a ready-made scene")}</span>
        </span>
      </span>
      <span className={s.homeCta}>＋ {t("방 만들고 친구 부르기", "Open a room & invite friends")}</span>
    </Link>
  );
}
