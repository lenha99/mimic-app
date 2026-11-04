"use client";

import Link from "next/link";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useLang, useT } from "@/components/lang";
import { AvatarFrame, LevelPill, NameFx, PassBadges } from "@/components/pass/look";
import { usePass } from "@/components/pass/use-pass";
import { useViewer } from "@/components/viewer";
import { VoiceAvatar } from "@/components/voice-avatar";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { readNickname } from "@/lib/nickname";
import { BADGES, LEVEL_XP, MAX_LEVEL, rankLabel, RANKS, unlocksAt, XP_RULES, type BadgeId } from "@/lib/pass";
import { track } from "@/lib/track";
import s from "./pass.module.css";

/**
 * VOICE PASS — 게임 시즌 패스처럼.
 *
 * 11/4 다시 그림: 예전 화면은 고정폭 글꼴·세로로 긴 표라 "숙제 목록" 같았다. 이제
 *   1) 위: 내 얼굴을 XP 링이 감싸고, 바로 다음에 풀릴 것 하나만 크게(다음 목표가 한눈에)
 *   2) XP 얻는 법: 아이콘 줄 목록 — 숫자는 오른쪽 칩
 *   3) 패스 로드: 옆으로 넘기는 단계 카드(지금 단계로 자동 스크롤). 랭크가 바뀌는 단계는 랭크 칩이 상품
 *   4) 특별 배지
 */
const noop = () => () => {};

const RULE_ICON: Record<string, string> = {
  posts: "M12 3a3 3 0 00-3 3v6a3 3 0 006 0V6a3 3 0 00-3-3zm7 9a7 7 0 01-6 6.92V21h-2v-2.08A7 7 0 015 12h2a5 5 0 0010 0h2z",
  likesReceived: "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.5 5c2 0 3.5 1.1 4.5 2.6C12 6.1 13.5 5 15.5 5 19 5 21.1 8.4 19.6 11.8 17.5 16.4 12 21 12 21z",
  followers: "M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5z",
  likesGiven: "M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 5 6.5 5c2 0 3.5 1.1 4.5 2.6C12 6.1 13.5 5 15.5 5 19 5 21.1 8.4 19.6 11.8 17.5 16.4 12 21 12 21z",
  picked: "M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7.1L12 17.3 5.8 21l1.6-7.1L2 9.2l7.1-.6z",
  prophet: "M12 5C6.5 5 2.4 9.2 1 12c1.4 2.8 5.5 7 11 7s9.6-4.2 11-7c-1.4-2.8-5.5-7-11-7zm0 11a4 4 0 110-8 4 4 0 010 8z",
};

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
  const ratio = v?.progress.ratio ?? 0;
  const toNext = v?.next ? LEVEL_XP[v.next.level - 1] - v.xp : 0;
  const road = useRef<HTMLOListElement | null>(null);

  useEffect(() => track("pass_view"), []);
  // 패스 로드는 지금 단계가 보이게 옆으로 넘겨 둔다.
  useEffect(() => {
    const el = road.current?.querySelector<HTMLElement>("[data-now]");
    if (el && road.current) road.current.scrollLeft = el.offsetLeft - 24;
  }, [level]);

  return (
    <main className={`shell ${s.page}`}>
      <header className={s.hero}>
        <p className={s.kicker}>
          VOICE PASS <span>{t("시즌 1", "Season 1")}</span>
        </p>
        <div className={s.ring} style={{ "--p": ratio } as React.CSSProperties} aria-label={t(`다음 레벨까지 ${Math.round(ratio * 100)}%`, `${Math.round(ratio * 100)}% to next level`)}>
          <AvatarFrame frame={look?.frame}>
            <VoiceAvatar avatar={avatar} size={108} level={0.15} />
          </AvatarFrame>
          <span className={s.medal}>
            <LevelPill level={level} rank={look?.rank ?? "rookie"} compact />
          </span>
        </div>
        <h1 className={s.heroName}>
          <NameFx fx={look?.name}>{name}</NameFx>
        </h1>
        <p className={s.heroRank}>
          {rankLabel(look?.rank ?? "rookie")} · <b>{v?.xp ?? 0} XP</b>
          {look?.badges?.length ? (
            <>
              {" "}
              <PassBadges badges={look.badges} lang={lang} />
            </>
          ) : null}
        </p>

        {v?.next ? (
          <div className={s.next}>
            <span className={s.nextThumb} aria-hidden="true">
              {v.next.kind === "frame" ? (
                <AvatarFrame frame={v.next.id}>
                  <VoiceAvatar avatar={avatar} size={34} />
                </AvatarFrame>
              ) : (
                <b className={s.nextName}>
                  <NameFx fx={v.next.id}>Aa</NameFx>
                </b>
              )}
            </span>
            <span className={s.nextText}>
              <small>{t(`다음 · Lv ${v.next.level}`, `Next · Lv ${v.next.level}`)}</small>
              <b>{t(v.next.ko, v.next.en)}</b>
              <span className={s.bar}>
                <i style={{ width: `${Math.round(ratio * 100)}%` }} />
              </span>
            </span>
            <span className={s.nextLeft}>
              <b>{toNext}</b>
              <small>XP</small>
            </span>
          </div>
        ) : (
          v && <p className={s.max}>{t("모든 단계를 풀었어요 👑", "Everything unlocked 👑")}</p>
        )}
      </header>

      <section className={s.section}>
        <h2 className={s.h2}>{t("XP 얻기", "Earn XP")}</h2>
        <ul className={s.rules}>
          {XP_RULES.map((r) => (
            <li key={r.key} className={s.rule}>
              <span className={`${s.ruleIcon} ${s[`ri_${r.key}`] ?? ""}`} aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path fill="currentColor" d={RULE_ICON[r.key] ?? RULE_ICON.posts} />
                </svg>
              </span>
              <span className={s.ruleText}>
                <b>{t(r.ko, r.en)}</b>
                <small>{t(r.noteKo, r.noteEn)}</small>
              </span>
              <span className={s.ruleXp}>+{r.xp}</span>
            </li>
          ))}
        </ul>
        <div className={s.ctaRow}>
          <Link href="/practice?post=1" className={s.cta}>
            {t("🎧 목소리 들려주기 +30", "🎧 Post a voice +30")}
          </Link>
          <Link href="/weekly" className={s.ctaAlt}>
            {t("❤ 주러 가기 +3", "Give ❤ +3")}
          </Link>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.h2Row}>
          <h2 className={s.h2}>{t("패스 로드", "Pass road")}</h2>
          <small>
            Lv {level} / {MAX_LEVEL}
          </small>
        </div>
        <ol className={s.road} ref={road}>
          {Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((lv) => {
            const got = lv <= level;
            const now = lv === level;
            const items = unlocksAt(lv);
            const newRank = RANKS.find((r) => r.from === lv && lv > 1);
            return (
              <li key={lv} className={`${s.tier} ${got ? s.tierGot : ""} ${now ? s.tierNow : ""}`} data-now={now ? "" : undefined}>
                <span className={s.tierLv}>Lv {lv}</span>
                <span className={s.tierPrize}>
                  {items.length > 0 ? (
                    items.map((u) =>
                      u.kind === "frame" ? (
                        <AvatarFrame key={u.id} frame={u.id}>
                          <VoiceAvatar avatar={avatar} size={items.length > 1 ? 34 : 46} />
                        </AvatarFrame>
                      ) : (
                        <b key={u.id} className={s.tierName}>
                          <NameFx fx={u.id}>{name}</NameFx>
                        </b>
                      ),
                    )
                  ) : newRank ? (
                    <LevelPill level={lv} rank={newRank.id} />
                  ) : (
                    <span className={s.tierStart}>🎧</span>
                  )}
                </span>
                <span className={s.tierLabel}>
                  {items.length > 0
                    ? items.map((u) => t(u.ko, u.en)).join(" + ")
                    : newRank
                      ? t(`${newRank.label} 랭크`, `${newRank.label} rank`)
                      : t("시작", "Start")}
                </span>
                <span className={s.tierState}>
                  {now ? t("지금", "Now") : got ? "✓" : `${LEVEL_XP[lv - 1]} XP`}
                </span>
              </li>
            );
          })}
        </ol>
        <p className={s.lede}>
          {t("풀린 꾸미기는 자동으로 껴져요 — 홈·갤러리·내 목소리 페이지에서 모두에게 보여요.", "Unlocks apply automatically and show everywhere — Home, gallery and your voice page.")}
        </p>
      </section>

      <section className={s.section}>
        <h2 className={s.h2}>{t("특별 배지", "Special badges")}</h2>
        <ul className={s.badgeList}>
          {(Object.keys(BADGES) as BadgeId[]).map((b) => (
            <li key={b} className={look?.badges?.includes(b) ? s.badgeGot : undefined}>
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
