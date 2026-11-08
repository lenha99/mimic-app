import Link from "next/link";
import { getT } from "@/lib/i18n-server";
import { HALL_LABEL, premiereLabel } from "@/lib/relay";
import { liveSummary } from "@/lib/relay-server";
import s from "./relay.module.css";

/**
 * 홈 — 릴레이 더빙 입구. 상영 중인 두 장면과 사람 목소리 수, 버튼 하나.
 * 홈은 5분마다 다시 만드는 정적 페이지라 "몇 시간 남음" 대신 "N일 뒤 개봉"만 쓴다.
 */
export async function RelayHomeCard() {
  const t = await getT();
  const ko = t("ko", "en") === "ko";
  // 홈은 정적 페이지 — DB 가 느리거나 안 닿아도(빌드 중) 3초 안에 카드만 비우고 지나간다
  const live = await Promise.race([liveSummary().catch(() => []), new Promise<[]>((r) => setTimeout(() => r([]), 3000))]);
  return (
    <Link href="/relay" className={s.homeCard} data-tour="home-relay">
      <span className={s.homeHead}>
        <b>🎬 {t("릴레이 더빙", "Relay Dubbing")}</b>
        <span className={s.homeNew}>NEW</span>
      </span>
      <span className={s.muted}>
        {t("한 줄만 녹음하면 여러 사람 목소리로 장면이 완성돼요. 3일 뒤 개봉!", "Record one line — a scene in many voices. Premieres in 3 days!")}
      </span>
      {live.length > 0 && (
        <span className={s.homeScenes}>
          {live.map((x) => (
            <span key={x.id} className={s.homeScene}>
              <i aria-hidden="true">{x.hall === "act" ? "🎭" : "🎙"}</i>
              <span>
                {x.title} <small>· {ko ? HALL_LABEL[x.hall].ko : HALL_LABEL[x.hall].en}</small>
              </span>
              <small>
                {t(`목소리 ${Math.min(x.total, x.voiced)}/${x.total}`, `${Math.min(x.total, x.voiced)}/${x.total} voiced`)} · {premiereLabel(x.premiereAt, ko)}
              </small>
            </span>
          ))}
        </span>
      )}
      <span className={s.homeCta}>🎙 {t("내 대사 한 줄 하러 가기", "Record my line")}</span>
    </Link>
  );
}
