"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
import { usePlaylist } from "@/components/relay/audio";
import { itemsOfFinal, itemsOfPreview, postJson } from "@/components/relay/client";
import { AvatarDot } from "@/components/relay/parts";
import { genreLabel, HALL_LABEL, timeLeft, type CutLine, type FinalCut, type SceneView } from "@/lib/relay";
import { track } from "@/lib/track";
import s from "@/components/relay/relay.module.css";

type Cut = "main" | "twist" | "alt";

/**
 * 개봉관 — 검은 화면에 자막, 줄마다 누가 연기했는지. 끝나면 엔딩 크레딧이 올라간다.
 * 정식판 · 반전판(반전 카드) · B 루트(갈림길 2위). 끝까지 들으면 시청률 +1.
 * 상영 중인 장면은 "지금까지의 시사회"로 같은 화면을 쓴다.
 */
export default function RelayPremiere({ scene }: { scene: SceneView }) {
  const t = useT();
  const ko = useLang() === "ko";
  const pl = usePlaylist();
  const [cut, setCut] = useState<Cut>("main");
  const [ended, setEnded] = useState(false);
  const [started, setStarted] = useState(false);
  const [listens, setListens] = useState(scene.listens);
  const counted = useRef(false);
  const premiered = scene.status === "premiered" && !!scene.final;

  useEffect(() => {
    track("relay_premiere_view", { meme_id: scene.stockKey ?? scene.id, via: premiered ? "final" : "preview" });
  }, [scene.id, scene.stockKey, premiered]);

  const final: FinalCut | null = scene.final;
  const altLines = useMemo(() => {
    if (!final || !final.alt.length) return null;
    return final.lines.map((l) => final.alt.find((a) => a.n === l.n) ?? l);
  }, [final]);

  const { items, lines } = useMemo(() => {
    if (!final) return itemsOfPreview(scene);
    if (cut === "alt" && altLines) return itemsOfFinal({ ...final, lines: altLines });
    return itemsOfFinal(final, cut === "twist");
  }, [final, cut, altLines, scene]);

  const cur: CutLine | null = pl.index >= 0 ? (lines[pl.index] ?? null) : null;

  const play = () => {
    setEnded(false);
    setStarted(true);
    void pl.play(items, {
      onDone: (complete) => {
        if (!complete) return;
        setEnded(true);
        if (premiered && !counted.current) {
          counted.current = true;
          track("relay_listen", { meme_id: scene.stockKey ?? scene.id, via: cut });
          void postJson<{ counted?: boolean }>("/api/relay/listen", { sceneId: scene.id }).then((r) => {
            if (r.data.counted) setListens((x) => x + 1);
          });
        }
      },
    });
  };

  const choose = (c: Cut) => {
    pl.stop();
    setCut(c);
    setEnded(false);
    setStarted(false);
  };

  const share = async () => {
    const url = `${location.origin}/relay/s/${scene.id}/premiere`;
    const text = t(`🍿 「${scene.title}」 — 여러 사람 목소리로 완성된 더빙 장면`, `🍿 "${scene.title}" — a scene dubbed by many voices`);
    track("relay_share", { meme_id: scene.stockKey ?? scene.id });
    try {
      if (navigator.share) await navigator.share({ title: scene.title, text, url });
      else {
        await navigator.clipboard.writeText(`${text}\n${url}`);
        alert(t("링크를 복사했어요", "Link copied"));
      }
    } catch {}
  };

  const credits = final?.credits;
  const humans = lines.filter((l) => l.takeId).length;
  const hall = HALL_LABEL[scene.hall];

  return (
    <main className={`shell ${s.page}`}>
      <div className={s.spread}>
        <Link href={`/relay/s/${scene.id}`} className={s.back} onClick={() => pl.stop()}>
          ‹ {t("대본 보기", "Script")}
        </Link>
        <span className={s.tiny}>
          {ko ? hall.ko : hall.en} · {genreLabel(scene.genre, ko)}
        </span>
      </div>
      <p className={s.kicker}>{premiered ? t("개봉작", "PREMIERE") : t("시사회 — 아직 상영 중", "SNEAK PEEK — still showing")}</p>
      <h1 className={s.h1}>{scene.title}</h1>
      <p className={s.sub}>{scene.logline}</p>

      {premiered && (final?.twist || altLines) && (
        <div className={s.tabs} role="tablist">
          <button type="button" role="tab" aria-selected={cut === "main"} className={cut === "main" ? s.tabOn : s.tab} onClick={() => choose("main")}>
            {t("정식판", "Final")}
          </button>
          {final?.twist && (
            <button type="button" role="tab" aria-selected={cut === "twist"} className={cut === "twist" ? s.tabOn : s.tab} onClick={() => choose("twist")}>
              🃏 {t("반전판", "Twist")}
            </button>
          )}
          {altLines && (
            <button type="button" role="tab" aria-selected={cut === "alt"} className={cut === "alt" ? s.tabOn : s.tab} onClick={() => choose("alt")}>
              {t("B 루트", "Route B")}
            </button>
          )}
        </div>
      )}

      <div className={s.screen} aria-live="polite">
        {!started && (
          <button type="button" className={s.playBtn} style={{ width: 84, height: 84, fontSize: 30 }} onClick={play} aria-label={t("상영 시작", "Play")}>
            ▶
          </button>
        )}
        {started && !ended && cur && (
          <div key={`${cut}-${cur.n}`}>
            <span className={s.screenRole}>{cur.roleName}</span>
            <p className={s.subtitle}>{cur.text}</p>
            <span className={s.screenWho}>
              {cur.takeId ? (
                <>
                  <AvatarDot avatar={cur.avatar} seed={cur.owner ?? cur.lineId} size={18} /> {cur.name}
                </>
              ) : (
                <span className={s.tts}>TTS</span>
              )}
            </span>
          </div>
        )}
        {started && !ended && !cur && <Coco mood="think" size={64} />}
        {ended && (
          <div className={s.credits}>
            <span className={s.screenRole}>{t("엔딩 크레딧", "CREDITS")}</span>
            <dl>
              {credits?.director && (
                <>
                  <dt>{t("감독", "Director")}</dt>
                  <dd>{credits.director}</dd>
                </>
              )}
              {credits?.prompt && (
                <>
                  <dt>{t("원안", "Idea")}</dt>
                  <dd>{credits.prompt}</dd>
                </>
              )}
              {(credits?.cast ?? castOf(scene, lines)).map((c) => (
                <span key={c.role} style={{ display: "contents" }}>
                  <dt>{c.roleName}</dt>
                  <dd>{c.names.length ? c.names.join(" · ") : "TTS"}</dd>
                </span>
              ))}
              {credits && credits.writers.length > 0 && (
                <>
                  <dt>{t("작가", "Writers")}</dt>
                  <dd>{credits.writers.map((w) => `${w.name}(${w.twist ? t("반전", "twist") : `${w.n}${t("번", "")}`})`).join(" · ")}</dd>
                </>
              )}
              {credits && credits.adlibs.length > 0 && (
                <>
                  <dt>{t("애드리브", "Ad-libs")}</dt>
                  <dd>{credits.adlibs.join(" · ")}</dd>
                </>
              )}
              <dt>{t("목소리 대역", "Stand-in")}</dt>
              <dd>{t(`TTS ${10 - humans}줄`, `TTS ×${10 - humans}`)}</dd>
            </dl>
            <button type="button" className={s.ctaSmall} onClick={play}>
              ↻ {t("다시 상영", "Replay")}
            </button>
          </div>
        )}
      </div>

      <div className={s.stats}>
        <div className={s.stat}>
          <b>{final?.realActors ?? new Set(lines.filter((l) => l.owner).map((l) => l.owner)).size}</b>
          <small>{t("출연 배우", "Actors")}</small>
        </div>
        <div className={s.stat}>
          <b>{humans}/10</b>
          <small>{t("사람 목소리", "Human lines")}</small>
        </div>
        <div className={s.stat}>
          <b>{listens}</b>
          <small>{t("끝까지 들은 사람", "Full listens")}</small>
        </div>
      </div>
      {scene.bestWeek && <p className={s.best}>🏆 {t("이주의 명작으로 뽑혔어요 — 참여자 전원 +30 XP", "Scene of the week — +30 XP to everyone in it")}</p>}

      {!premiered && <p className={s.muted}>{t(`${timeLeft(scene.premiereAt, true)} — 그 전에 출연하면 정식판에 내 목소리가 들어가요.`, `${timeLeft(scene.premiereAt, false)} — appear before then to be in the final cut.`)}</p>}

      <div className={s.bottomBarNav}>
        <div className={s.twoBtn}>
          <button type="button" className={s.ctaGhost} onClick={share}>
            {t("공유하기", "Share")}
          </button>
          <Link href={premiered ? "/relay/rec" : `/relay/rec?scene=${scene.id}`} className={s.cta} onClick={() => pl.stop()}>
            🎙 {premiered ? t("다음 장면 출연하기", "Be in the next scene") : t("지금 출연하기", "Appear now")}
          </Link>
        </div>
      </div>
    </main>
  );
}

function castOf(scene: SceneView, lines: CutLine[]) {
  return scene.roles.map((r) => ({ role: r.id, roleName: r.name, names: [...new Set(lines.filter((l) => l.role === r.id && l.name).map((l) => l.name!))] }));
}
