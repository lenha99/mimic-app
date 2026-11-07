"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { TourHelp } from "@/components/onboarding/tour";
import { ScreenTour } from "@/components/onboarding/tours";
import { HallCard, Ladder, PromptCard, RankBar, RelayIntro, useLevel } from "@/components/relay/parts";
import { fetchScene } from "@/components/relay/client";
import { can, genreLabel, HALL_LABEL, type Hall, type SceneView } from "@/lib/relay";
import { track } from "@/lib/track";
import s from "@/components/relay/relay.module.css";

type Done = { id: string; title: string; hall: Hall; genre: string; premiereAt: string | null; listens: number; director: string | null };

/**
 * 릴레이 더빙 허브 — 큰 버튼 하나("한 줄 녹음하기")가 주인공. 상영관 둘, 개봉작, 내 직함과 다음 권한.
 * 고르는 일은 앱이 한다 — 버튼을 누르면 /relay/rec 이 배역과 줄을 정해 준다.
 */
export default function RelayHub({ live: initial, premiered, best }: { live: SceneView[]; premiered: Done[]; best: { id: string; title: string; listens: number; logline: string } | null }) {
  const t = useT();
  const ko = useLang() === "ko";
  const { level } = useLevel();
  const [live, setLive] = useState(initial);

  useEffect(() => {
    track("relay_view");
    // 서버는 누가 보는지 모르고 그렸다 — 내 배역 표시(mine)를 위해 다시 받는다.
    let alive = true;
    void Promise.all(initial.map((x) => fetchScene(x.id))).then((rs) => {
      if (!alive) return;
      const got = rs.filter((r): r is NonNullable<typeof r> => !!r).map((r) => r.scene);
      if (got.length) setLive(got);
    });
    return () => {
      alive = false;
    };
  }, [initial]);

  return (
    <main className={`shell ${s.page}`}>
      <div className={s.spread}>
        <Link href="/" className={s.back}>
          ‹ {t("홈", "Home")}
        </Link>
        <TourHelp id="relay" short />
      </div>
      <p className={s.kicker}>RELAY DUBBING</p>
      <h1 className={s.h1}>
        {t("한 줄씩 이어 만드는", "One line each,")} <em>{t("더빙 극장", "one scene together")}</em>
      </h1>
      <p className={s.sub}>
        {t(
          "앱이 정해 주는 배역의 대사 한 줄만 녹음하면, 다른 사람들 목소리와 이어져 장면이 완성돼요. 모험·애니·면접·뉴스·영화 — 연습도 되고 웃기기도 해요.",
          "Record the one line we hand you. It joins everyone else's into a full scene — adventure, anime, interviews, news, movies.",
        )}
      </p>

      <RankBar />

      <section className={s.halls} aria-label={t("상영 중", "Now showing")}>
        {live.length === 0 && <p className={s.muted}>{t("다음 장면을 준비하고 있어요. 잠시 뒤에 다시 와 주세요!", "Preparing the next scene…")}</p>}
        {live.map((sc) => (
          <HallCard key={sc.id} scene={sc} href={`/relay/s/${sc.id}`} />
        ))}
      </section>

      <div className={s.bottomBarNav}>
        <Link href="/relay/rec" className={s.cta} data-tour="relay-cta" onClick={() => track("relay_cta")}>
          🎙 {t("내 대사 한 줄 녹음하기", "Record my line")}
        </Link>
      </div>

      {best && (
        <>
          <div className={s.section}>
            <h2>🏆 {t("이주의 명작", "Scene of the week")}</h2>
          </div>
          <Link href={`/relay/s/${best.id}/premiere`} className={s.best}>
            <b>{best.title}</b>
            <span className={s.muted}>{best.logline}</span>
            <span className={s.tiny}>{t(`끝까지 들은 사람 ${best.listens}명 · 참여자 전원 +30 XP`, `${best.listens} full listens · +30 XP to everyone in it`)}</span>
          </Link>
        </>
      )}

      <div className={s.section}>
        <h2>🍿 {t("개봉작", "Premiered")}</h2>
      </div>
      {premiered.length === 0 ? (
        <p className={s.muted}>{t("첫 개봉을 기다리는 중이에요. 지금 출연하면 첫 크레딧에 이름이 올라가요!", "No premieres yet — appear now to be in the very first credits!")}</p>
      ) : (
        <ul className={s.list}>
          {premiered.map((p) => (
            <li key={p.id}>
              <Link href={`/relay/s/${p.id}/premiere`} className={s.item}>
                <span className={s.itemIcon} aria-hidden="true">
                  {p.hall === "act" ? "🎭" : "🎙"}
                </span>
                <span className={s.itemText}>
                  <b>{p.title}</b>
                  <small>
                    {(ko ? HALL_LABEL[p.hall].ko : HALL_LABEL[p.hall].en)} · {genreLabel(p.genre, ko)} · {t(`시청 ${p.listens}`, `${p.listens} listens`)}
                    {p.director ? ` · ${t("감독", "dir.")} ${p.director}` : ""}
                  </small>
                </span>
                <span aria-hidden="true">▶</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className={s.section}>
        <h2>🎟 {t("제작 계급", "Ranks")}</h2>
        <Link href="/relay/guide">{t("가이드 ›", "Guide ›")}</Link>
      </div>
      <Ladder />
      {can.direct(level) ? (
        <Link href="/relay/studio" className={s.ctaGhost} style={{ marginTop: 10 }}>
          🎬 {t("감독 스튜디오 — 새 장면 열기", "Director studio — open a scene")}
        </Link>
      ) : (
        <Link href="/relay/studio" className={s.lock} style={{ marginTop: 10 }}>
          🔒 {t("감독 스튜디오는 LV7부터 — 미리 구경하기", "Director studio unlocks at LV7 — take a peek")}
        </Link>
      )}

      <div className={s.section}>
        <h2>{t("누구나 할 수 있는 창작", "Anyone can pitch")}</h2>
      </div>
      <PromptCard />

      <p className={s.tiny} style={{ marginTop: 18, textAlign: "center" }}>
        {t("출연한 녹음은 장면에 공개돼요 · 출연 직후 5초 안에 되돌릴 수 있어요", "Takes you appear with are public in the scene · undo within 5s")}
      </p>
      <RelayIntro />
      <ScreenTour id="relay" />
    </main>
  );
}
