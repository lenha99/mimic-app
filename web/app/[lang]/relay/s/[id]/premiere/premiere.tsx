"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
import { usePlaylist } from "@/components/relay/audio";
import { fetchScene, itemsOfFinal, itemsOfPreview, postJson } from "@/components/relay/client";
import { AvatarDot } from "@/components/relay/parts";
import { genreLabel, HALL_LABEL, timeLeft, type CutLine, type FinalCut, type SceneView } from "@/lib/relay";
import { track } from "@/lib/track";
import s from "@/components/relay/relay.module.css";

type Cut = "main" | "twist" | "alt";

/**
 * 개봉관 — 검은 화면에 자막, 줄마다 누가 연기했는지. 끝나면 엔딩 크레딧이 올라간다.
 * 정식판 · 반전판(반전 카드) · B 루트(갈림길 2위). 처음부터 끝까지 들으면 시청률 +1.
 * 상영 중인 장면은 "지금까지의 시사회"로 같은 화면을 쓴다.
 *
 * 개봉관의 주인공은 "내 목소리가 나오는 순간"이다 — 서버는 누가 보는지 모르고 그리니,
 * 화면에서 장면을 다시 받아 내 녹음(mine)을 찾고: 상영 전 "내 목소리 N줄", 상영 중 🎙 나 표시,
 * 크레딧에서 내 이름 강조, 공유 문구에 내 배역. 아래 대본은 지금 줄을 따라가고 누르면 거기서부터 다시.
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
  const fromStart = useRef(true);
  const screenRef = useRef<HTMLDivElement>(null);
  const premiered = scene.status === "premiered" && !!scene.final;
  const [mineTakes, setMineTakes] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let alive = true;
    void fetchScene(scene.id).then((r) => {
      if (!alive || !r) return;
      setMineTakes(new Set(r.scene.takes.filter((x) => x.mine).map((x) => x.id)));
    });
    return () => {
      alive = false;
    };
  }, [scene.id]);

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

  const play = (from = 0) => {
    setEnded(false);
    setStarted(true);
    fromStart.current = from === 0;
    // 대본 아래쪽 줄을 눌렀으면 화면(자막)이 보이게 올려 준다
    if (from > 0) screenRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    void pl.play(items, {
      from,
      onDone: (complete) => {
        if (!complete) return;
        setEnded(true);
        if (premiered && fromStart.current && !counted.current) {
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
    const text = myRoles.length
      ? t(`🎙 내가 「${myRoles.join("·")}」 역으로 나온 더빙 장면 「${scene.title}」 — ${actors}명이 한 줄씩 이어 만들었어요`, `🎙 I play ${myRoles.join(" & ")} in "${scene.title}" — dubbed line by line by ${actors} people`)
      : t(`🍿 「${scene.title}」 — ${actors}명 목소리로 한 줄씩 이어 만든 더빙 장면`, `🍿 "${scene.title}" — dubbed line by line by ${actors} people`);
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
  const total = lines.length;
  const humans = lines.filter((l) => l.takeId).length;
  const hall = HALL_LABEL[scene.hall];
  const isMine = (l: CutLine) => !!l.takeId && mineTakes.has(l.takeId);
  const mineLines = lines.filter(isMine);
  const myRoles = [...new Set(mineLines.map((l) => l.roleName))];
  const myName = mineLines[0]?.name ?? null;
  const actors = final?.realActors ?? new Set(lines.filter((l) => l.owner).map((l) => l.owner)).size;
  const runSec = Math.round(lines.reduce((a, l) => a + (l.sec || 2) + 0.2, 0));
  const prev: CutLine | null = pl.index > 0 ? (lines[pl.index - 1] ?? null) : null;

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

      <div className={s.screen} aria-live="polite" ref={screenRef}>
        {started && !ended && pl.index >= 0 && (
          <span className={s.reel} aria-hidden="true">
            <i style={{ width: `${((pl.index + 1) / Math.max(1, total)) * 100}%` }} />
          </span>
        )}
        {!started && (
          <div className={s.marquee}>
            <button type="button" className={s.playBtn} style={{ width: 84, height: 84, fontSize: 30 }} onClick={() => play()} aria-label={t("상영 시작", "Play")}>
              ▶
            </button>
            <span className={s.marqueeInfo}>{t(`${total}줄 · 약 ${runSec}초 · 배우 ${actors}명`, `${total} lines · ~${runSec}s · ${actors} actors`)}</span>
            {mineLines.length > 0 && (
              <span className={s.meBadge}>🎙 {t(`내 목소리가 ${mineLines.length}줄 나와요`, `You're in ${mineLines.length} line${mineLines.length > 1 ? "s" : ""}`)}</span>
            )}
          </div>
        )}
        {started && !ended && cur && (
          <div key={`${cut}-${cur.n}`} className={s.frame}>
            {prev && (
              <p className={s.ghost}>
                <b>{prev.roleName}</b> {prev.text}
              </p>
            )}
            <span className={s.screenRole}>
              {cur.roleName} <small>· {pl.index + 1}/{total}</small>
            </span>
            <p className={s.subtitle}>{cur.text}</p>
            <span className={s.screenWho}>
              {cur.takeId ? (
                <>
                  <AvatarDot avatar={cur.avatar} seed={cur.owner ?? cur.lineId} size={18} /> {cur.name}
                  {isMine(cur) && <span className={s.meBadge}>🎙 {t("나", "you")}</span>}
                </>
              ) : (
                <span className={s.tts}>{t("AI 대역", "AI stand-in")}</span>
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
                  <dd>
                    {c.names.length
                      ? c.names.map((n, i) => (
                          <span key={n}>
                            {i > 0 && " · "}
                            {n === myName ? <mark className={s.meName}>{n}</mark> : n}
                          </span>
                        ))
                      : t("AI 대역", "AI stand-in")}
                  </dd>
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
              {total - humans > 0 && (
                <>
                  <dt>{t("AI 대역", "Stand-in")}</dt>
                  <dd>{t(`${total - humans}줄`, `×${total - humans}`)}</dd>
                </>
              )}
            </dl>
            {myRoles.length > 0 && <p className={s.meThanks}>{t(`「${myRoles.join("·")}」 역 — 수고했어요! 🎉`, `Great work as ${myRoles.join(" & ")}! 🎉`)}</p>}
            <span className={s.row} style={{ gap: 8, justifyContent: "center" }}>
              <button type="button" className={s.ctaSmall} onClick={() => play()}>
                ↻ {t("다시 상영", "Replay")}
              </button>
              <button type="button" className={s.ctaSmall} onClick={share}>
                {myRoles.length ? t("🙌 내 출연작 자랑하기", "🙌 Show it off") : t("📤 공유", "📤 Share")}
              </button>
            </span>
          </div>
        )}
      </div>

      <div className={s.stats}>
        <div className={s.stat}>
          <b>{actors}</b>
          <small>{t("출연 배우", "Actors")}</small>
        </div>
        <div className={s.stat}>
          <b>
            {humans}/{total}
          </b>
          <small>{t("사람 목소리", "Human lines")}</small>
        </div>
        <div className={s.stat}>
          <b>{listens}</b>
          <small>{t("끝까지 들은 사람", "Full listens")}</small>
        </div>
      </div>
      {scene.bestWeek && <p className={s.best}>🏆 {t("이주의 명작으로 뽑혔어요 — 참여자 전원 +30 XP", "Scene of the week — +30 XP to everyone in it")}</p>}

      <div className={s.section}>
        <h2>📜 {t("대본 따라 보기", "Follow the script")}</h2>
        <span className={s.tiny}>{t("누르면 거기서부터", "Tap to jump")}</span>
      </div>
      <ol className={s.follow}>
        {lines.map((l, i) => (
          <li key={`${cut}-${l.lineId}`}>
            <button type="button" className={`${s.followRow} ${pl.index === i ? s.followOn : ""} ${isMine(l) ? s.followMine : ""}`} onClick={() => play(i)}>
              <span className={s.followN}>{l.n}</span>
              <span className={s.followBody}>
                <b>
                  {l.roleName}
                  {l.candidate && l.authorName ? <small> · ✍️ {l.authorName}</small> : null}
                </b>
                <span>{l.text}</span>
              </span>
              <span className={s.followWho}>{l.takeId ? (isMine(l) ? `🎙 ${t("나", "you")}` : l.name) : "AI"}</span>
            </button>
          </li>
        ))}
      </ol>

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
