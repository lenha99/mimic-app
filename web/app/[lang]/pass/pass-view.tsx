"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { useLang, useT } from "@/components/lang";
import { AvatarFrame, LevelPill, NameFx, PassBadges } from "@/components/pass/look";
import { usePass } from "@/components/pass/use-pass";
import { useViewer } from "@/components/viewer";
import { VoiceAvatar } from "@/components/voice-avatar";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { readNickname } from "@/lib/nickname";
import { BADGES, LEVEL_XP, MAX_LEVEL, RANKS, rankOf, unlocksAt, XP_RULES, type BadgeId } from "@/lib/pass";
import { track } from "@/lib/track";
import s from "./pass.module.css";

/**
 * VOICE PASS — "어떻게 하면 뭐가 풀리는지"를 한 화면에.
 * 게임 시즌 패스 트랙처럼 레벨마다 풀리는 걸 실제 모습 그대로(내 아바타·내 닉네임으로) 미리 보여 준다.
 */
const noop = () => () => {};

export default function PassView() {
  const t = useT();
  const lang = useLang();
  const v = usePass();
  const viewer = useViewer();
  const avatar = viewer?.avatar ?? DEFAULT_AVATAR;
  const local = useSyncExternalStore(noop, readNickname, () => "");
  const name = viewer?.nickname || local || t("나", "Me");
  const level = v?.progress.level ?? 1;
  const look = v?.look;
  const toNext = v?.next ? LEVEL_XP[v.next.level - 1] - v.xp : 0;
  useEffect(() => track("pass_view"), []);

  return (
    <main className={`shell ${s.page}`}>
      <header className={s.hero}>
        <p className={s.kicker}>VOICE PASS · SEASON 1</p>
        <div className={s.heroFace}>
          <AvatarFrame frame={look?.frame}>
            <VoiceAvatar avatar={avatar} size={118} level={0.15} />
          </AvatarFrame>
        </div>
        <h1 className={s.heroName}>
          <NameFx fx={look?.name}>{name}</NameFx>
        </h1>
        <div className={s.heroMeta}>
          <LevelPill level={level} rank={look?.rank ?? "rookie"} />
          <PassBadges badges={look?.badges} lang={lang} />
        </div>
        <div className={s.heroBar} aria-label={t("경험치", "XP")}>
          <span style={{ width: `${Math.round((v?.progress.ratio ?? 0) * 100)}%` }} />
        </div>
        <p className={s.heroXp}>
          <b>{v?.xp ?? 0} XP</b>
          {v?.next && toNext > 0 && (
            <>
              {" · "}
              {t(`LV.${v.next.level} ${v.next.ko}까지 ${toNext} XP`, `${toNext} XP to LV.${v.next.level} ${v.next.en}`)}
            </>
          )}
          {v && !v.next && " · MAX"}
        </p>
      </header>

      <section className={s.section}>
        <h2 className={s.h2}>{t("XP 모으는 법", "How to earn XP")}</h2>
        <ul className={s.rules}>
          {XP_RULES.map((r) => (
            <li key={r.key} className={s.rule}>
              <b>+{r.xp}</b>
              <span>{t(r.ko, r.en)}</span>
              <small>{t(r.noteKo, r.noteEn)}</small>
            </li>
          ))}
        </ul>
        <div className={s.ctaRow}>
          <Link href="/practice?post=1" className={s.cta}>
            {t("목소리 올리기 +30", "Post a voice +30")}
          </Link>
          <Link href="/weekly" className={s.ctaAlt}>
            {t("❤ 주러 가기 +3", "Give ❤ +3")}
          </Link>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>{t("패스 트랙", "Pass track")}</h2>
        <p className={s.lede}>
          {t(
            "레벨이 오르면 꾸미기가 자동으로 적용돼요. 갤러리·홈·내 목소리 페이지에서 모두에게 보여요.",
            "Unlocks apply automatically and show everywhere — gallery, home and your voice page.",
          )}
        </p>
        <ol className={s.track}>
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((lv) => {
            const got = lv <= level;
            const now = lv === level;
            const items = unlocksAt(lv);
            return (
              <li key={lv} className={`${s.step} ${got ? s.stepGot : ""} ${now ? s.stepNow : ""}`}>
                <span className={s.node}>
                  <LevelPill level={lv} rank={rankOf(lv)} compact />
                </span>
                <div className={s.stepBody}>
                  <small className={s.stepXp}>
                    {LEVEL_XP[lv - 1]} XP{now ? ` · ${t("지금 여기", "YOU")}` : ""}
                  </small>
                  {items.length === 0 ? (
                    <span className={s.stepNone}>
                      {lv === 1 ? t("시작 — 목소리 하나면 LV.2", "Start — one voice gets you LV.2") : t("새 랭크 칩", "New rank chip")}
                    </span>
                  ) : (
                    items.map((u) => (
                      <span key={u.id} className={s.unlock}>
                        {u.kind === "frame" ? (
                          <AvatarFrame frame={u.id}>
                            <VoiceAvatar avatar={avatar} size={40} />
                          </AvatarFrame>
                        ) : (
                          <b className={s.sampleName}>
                            <NameFx fx={u.id}>{name}</NameFx>
                          </b>
                        )}
                        <span>{t(u.ko, u.en)}</span>
                        {!got && (
                          <i className={s.lock} aria-label={t("잠김", "Locked")}>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path fill="currentColor" d="M17 9h-1V7a4 4 0 10-8 0v2H7a2 2 0 00-2 2v8a2 2 0 002 2h10a2 2 0 002-2v-8a2 2 0 00-2-2zm-7-2a2 2 0 114 0v2h-4V7z" />
                            </svg>
                          </i>
                        )}
                      </span>
                    ))
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>{t("랭크", "Ranks")}</h2>
        <div className={s.ranks}>
          {RANKS.map((r) => (
            <span key={r.id} className="">
              <LevelPill level={r.from} rank={r.id} />
            </span>
          ))}
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>{t("특별 배지", "Special badges")}</h2>
        <ul className={s.badgeList}>
          {(Object.keys(BADGES) as BadgeId[]).map((b) => (
            <li key={b}>
              <PassBadges badges={[b]} lang={lang} />
              <span>{t(BADGES[b].ko, BADGES[b].en)}</span>
            </li>
          ))}
        </ul>
        <p className={s.lede}>{t("운영자 픽이 되면 레벨과 상관없이 스포트라이트 프레임을 받아요.", "Getting picked gives you the Spotlight frame at any level.")}</p>
      </section>

      {viewer && !viewer.loggedIn && (
        <Link href="/login?next=/pass" className={s.login}>
          {t("로그인하면 레벨이 계정에 남아요 — 폰을 바꿔도 그대로 ›", "Log in to keep your level on any device ›")}
        </Link>
      )}
    </main>
  );
}
