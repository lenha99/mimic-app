"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
import { useRecorder, usePlaylist, type PlayItem } from "@/components/relay/audio";
import { addSkip, assignNext, fetchScene, postTake, previewLines, undoTake } from "@/components/relay/client";
import { AvatarDot, useLevel } from "@/components/relay/parts";
import { ADLIB_MS, can, HALL_LABEL, isOpen, isBranch, maxTakeMs, sceneLength, premiereLabel, takeUrl, timeLeft, ttsUrl, type Assignment, type CutLine, type LineView, type SceneView } from "@/lib/relay";
import { track } from "@/lib/track";
import s from "@/components/relay/relay.module.css";

type Phase = "loading" | "none" | "ready" | "cue" | "review" | "posting" | "posted" | "adlib";

const REASON: Record<Assignment["reason"], [string, string]> = {
  cast: ["🎬 감독님이 당신을 이 배역에 캐스팅했어요", "🎬 A director cast you in this role"],
  mine: ["🎙 내가 맡은 배역의 다음 대사예요", "🎙 Next line of your role"],
  open: ["✨ 아직 아무도 안 맡은 배역이에요 — 녹음하면 내 배역!", "✨ Nobody has this role yet — record to take it!"],
  free: ["🎙 배역 주인의 우선권이 끝나 비어 있는 줄이에요", "🎙 An open line in a role whose priority ended"],
  vote: ["🗳 작가가 쓴 갈림길 대사 — 녹음하면 이 대사에 1표!", "🗳 A writer's branch line — recording it is a vote!"],
  late: ["⏰ 막판 캐스팅 — 개봉 전날이라 배역 하나 더!", "⏰ Last-call casting — one more role before the premiere!"],
};

/**
 * 녹음 — 앱이 정해 준 한 줄. 버튼을 누르면 앞 대사가 흘러나오고(큐), 끝나면 바로 내 차례.
 * 녹음이 끝나면 "앞 대사 + 내 목소리"가 곧바로 이어 재생된다(5초 남짓) — 이게 보상이다.
 * 버튼은 둘뿐: 출연하기 / 다시.
 */
export default function RelayRecorder({ sceneId, lineId, room = null }: { sceneId: string | null; lineId: string | null; room?: string | null }) {
  const t = useT();
  const ko = useLang() === "ko";
  const { level } = useLevel();
  const rec = useRecorder();
  const adlib = useRecorder();
  const pl = usePlaylist();
  const [phase, setPhase] = useState<Phase>("loading");
  const [scene, setScene] = useState<SceneView | null>(null);
  const [line, setLine] = useState<LineView | null>(null);
  const [reason, setReason] = useState<Assignment["reason"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [posted, setPosted] = useState<{ id: string; claimed: boolean; late: boolean } | null>(null);
  const [undoLeft, setUndoLeft] = useState(0);
  const [adlibDone, setAdlibDone] = useState(false);
  const myUrl = useRef<string | null>(null);
  const adlibUrl = useRef<string | null>(null);

  const load = useCallback(
    async (preferScene?: string | null, exactLine?: string | null) => {
      setPhase("loading");
      setError(null);
      setPosted(null);
      setAdlibDone(false);
      rec.reset();
      if (exactLine && preferScene) {
        const r = await fetchScene(preferScene);
        const l = r?.scene.lines.find((x) => x.id === exactLine);
        if (r && l && isOpen(r.scene.status)) {
          setScene(r.scene);
          setLine(l);
          setReason(l.candidate ? "vote" : r.scene.owners.some((o) => o.role === l.role && o.mine) ? "mine" : "open");
          setPhase("ready");
          return;
        }
      }
      // 친구 방 — 앱이 다른 상영관 줄을 배정하면 안 된다. 내 배역의 다음 빈 줄, 없으면 방으로.
      if (room && preferScene) {
        const r = await fetchScene(preferScene);
        const mineRoles = new Set(r?.scene.owners.filter((o) => o.mine).map((o) => o.role) ?? []);
        const l = r?.scene.lines
          .filter((x) => !x.candidate && mineRoles.has(x.role) && !r.scene.takes.some((tk) => tk.lineId === x.id && tk.kind === "line"))
          .sort((a, b) => a.n - b.n)[0];
        setScene(r?.scene ?? null);
        if (r && l && isOpen(r.scene.status)) {
          setLine(l);
          setReason("mine");
          setPhase("ready");
        } else setPhase("none");
        return;
      }
      const r = await assignNext(preferScene);
      if (!r?.assignment || !r.scene) {
        setScene(r?.scene ?? null);
        setPhase("none");
        return;
      }
      const l = r.scene.lines.find((x) => x.id === r.assignment!.lineId) ?? null;
      setScene(r.scene);
      setLine(l);
      setReason(r.assignment.reason);
      setPhase(l ? "ready" : "none");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 불러오기(effect 안에서 바로 바뀌지 않는다)
    void load(sceneId, lineId);
  }, [load, sceneId, lineId]);

  const cut = useMemo(() => (scene ? previewLines(scene) : []), [scene]);
  const role = scene?.roles.find((r) => r.id === line?.role);
  const prev: CutLine | null = line ? (cut.find((c) => c.n === line.n - 1) ?? null) : null;
  const next: CutLine | null = line ? (cut.find((c) => c.n === line.n + 1) ?? null) : null;
  const itemOf = (c: CutLine): PlayItem => ({ key: c.lineId, url: c.takeId ? takeUrl(c.takeId) : ttsUrl({ lineId: c.lineId, tts: c.tts }), text: c.text });
  const roleLeft = scene && line && !line.candidate ? scene.lines.filter((l) => !l.candidate && l.role === line.role && l.n > line.n && !scene.takes.some((x) => x.lineId === l.id && x.mine)).length : 0;

  // 녹음이 끝나면 바로 보상 재생 — 앞 대사 + 내 목소리
  useEffect(() => {
    if (rec.state !== "done" || !rec.blob) return;
    if (myUrl.current) URL.revokeObjectURL(myUrl.current);
    myUrl.current = URL.createObjectURL(rec.blob);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 불러오기(effect 안에서 바로 바뀌지 않는다)
    setPhase("review");
    track("relay_rec", { meme_id: scene?.stockKey ?? scene?.id });
    const items: PlayItem[] = [...(prev ? [itemOf(prev)] : []), { key: "me", url: myUrl.current }];
    void pl.play(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.state, rec.blob]);

  useEffect(() => {
    if (adlib.state !== "done" || !adlib.blob) return;
    if (adlibUrl.current) URL.revokeObjectURL(adlibUrl.current);
    adlibUrl.current = URL.createObjectURL(adlib.blob);
    void (async () => {
      if (!line) return;
      const r = await postTake(line.id, adlib.blob!, adlib.duration, "adlib");
      if (!r.ok) {
        setError(r.error);
        setPhase("posted");
        return;
      }
      setAdlibDone(true);
      setPhase("posted");
      track("relay_adlib");
      void pl.play([
        { key: "me", url: myUrl.current },
        { key: "ad", url: adlibUrl.current },
      ]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adlib.state, adlib.blob]);

  useEffect(() => {
    if (undoLeft <= 0) return;
    const id = setTimeout(() => setUndoLeft(undoLeft - 1), 1000);
    return () => clearTimeout(id);
  }, [undoLeft]);

  const begin = () => {
    if (!line) return;
    setError(null);
    pl.stop();
    if (prev) {
      setPhase("cue");
      void pl.play([itemOf(prev)], {
        onDone: () => {
          setPhase("ready");
          void rec.start(maxTakeMs(line.sec), { countdown: false });
        },
      });
    } else void rec.start(maxTakeMs(line.sec));
  };

  const appear = async () => {
    if (!line || !rec.blob) return;
    pl.stop();
    setPhase("posting");
    const r = await postTake(line.id, rec.blob, rec.duration);
    if (!r.ok) {
      setError(r.error);
      if (/로그인|Log in/.test(r.error)) setNeedLogin(true);
      setPhase("review");
      return;
    }
    setPosted(r);
    setUndoLeft(5);
    setPhase("posted");
    track("relay_post", { meme_id: scene?.stockKey ?? scene?.id, via: reason ?? undefined });
  };

  const undo = async () => {
    if (!posted) return;
    setUndoLeft(0);
    if (await undoTake(posted.id)) {
      track("relay_undo");
      setPosted(null);
      setPhase("review");
    }
  };

  const skip = () => {
    if (!scene || !line) return;
    addSkip(`${scene.id}:${line.role}`);
    track("relay_skip");
    void load(null, null);
  };

  const pct = line ? Math.min(100, (rec.elapsed / maxTakeMs(line.sec)) * 100) : 0;
  const recording = rec.state === "rec" || rec.state === "count";

  return (
    <main className={`shell ${s.page}`}>
      <div className={s.spread}>
        <Link href={room ? `/relay/r/${room}` : scene ? `/relay/s/${scene.id}` : "/relay"} className={s.back} onClick={() => pl.stop()}>
          ‹ {scene ? scene.title : t("릴레이 더빙", "Relay Dubbing")}
        </Link>
        {scene && (
          <span className={s.tiny}>
            {room ? t("친구 방", "Friends' room") : `${ko ? HALL_LABEL[scene.hall].ko : HALL_LABEL[scene.hall].en} · ${premiereLabel(scene.premiereAt, ko)}`}
          </span>
        )}
      </div>

      {phase === "loading" && (
        <div className={s.okBox} style={{ marginTop: 40, background: "transparent", border: 0 }}>
          <Coco mood="think" size={88} />
          <span className={s.muted}>{t("배역을 고르는 중…", "Finding your role…")}</span>
        </div>
      )}

      {phase === "none" && room && (
        <div className={s.stage}>
          <div className={s.okBox}>
            <Coco mood="happy" size={88} />
            <b>{t("내 배역 대사를 다 녹음했어요!", "You've recorded all your lines!")}</b>
            <span className={s.muted}>{t("방으로 돌아가 다른 빈 배역을 맡거나, 친구들 녹음을 들어 보세요.", "Head back to the room to take another open role or listen.")}</span>
          </div>
          <Link href={`/relay/r/${room}`} className={s.cta}>
            {t("방으로", "Back to the room")}
          </Link>
        </div>
      )}

      {phase === "none" && !room && (
        <div className={s.stage}>
          <div className={s.okBox}>
            <Coco mood="happy" size={88} />
            <b>{t("지금은 내가 할 줄이 없어요", "No lines for you right now")}</b>
            <span className={s.muted}>
              {t(
                "상영 중인 장면에서 맡을 수 있는 배역을 다 했거나, 모든 배역이 찼어요. 개봉 하루 전부터는 빈 배역을 하나 더 맡을 수 있어요.",
                "You've done every role you can, or all roles are taken. A day before the premiere you can take one more empty role.",
              )}
            </span>
          </div>
          <Link href="/relay" className={s.cta}>
            {t("상영관으로", "Back to the halls")}
          </Link>
        </div>
      )}

      {scene && line && role && phase !== "loading" && phase !== "none" && (
        <div className={s.stage}>
          {reason && !room && <p className={s.muted} style={{ margin: 0 }}>{ko ? REASON[reason][0] : REASON[reason][1]}</p>}
          {room && <p className={s.muted} style={{ margin: 0 }}>{t("🎬 친구 방 — 내가 고른 배역이에요", "🎬 Friends' room — your role")}</p>}

          {prev ? (
            <div className={s.prevLine} style={phase === "cue" ? { borderColor: "var(--volt)" } : undefined}>
              <span className={s.roleName}>
                {prev.n}. {prev.roleName} {prev.name ? `· ${prev.name}` : "· TTS"}
              </span>
              <p>{prev.text}</p>
            </div>
          ) : (
            <p className={s.tiny} style={{ margin: 0 }}>
              {t("첫 대사예요 — 장면을 여는 목소리!", "Opening line — you start the scene!")}
            </p>
          )}

          <div className={s.myLine} data-tour="relay-myline">
            <span className={s.spread}>
              <span className={s.roleName}>
                {line.n}. {role.name} — {t("당신 차례", "your turn")}
              </span>
              {isBranch(line.n, sceneLength(scene.lines)) && <span className={s.branchTag}>{line.candidate ? t("작가 대사 · 투표", "writer line · vote") : t("갈림길", "branch")}</span>}
            </span>
            <p className={s.lineText}>{line.text}</p>
            <span className={s.lineMeta}>
              {line.dir && <span className={s.lineDir}>({line.dir})</span>}
              {line.tip && line.tip !== "작가 대사" && <span className={s.tip}>{line.tip}</span>}
            </span>
            <span className={s.tiny}>{role.desc}</span>
          </div>

          {(error || rec.error) && (
            <div className={s.error}>
              {error ?? rec.error}
              {needLogin && (
                <>
                  {" "}
                  <Link href={`/login?next=/relay/rec`}>{t("로그인", "Log in")}</Link>
                </>
              )}
            </div>
          )}

          {(phase === "ready" || phase === "cue") && (
            <>
              {rec.state === "count" && <span className={s.countdown}>{rec.count}</span>}
              {rec.state === "rec" && (
                <>
                  <span className={s.levelBar} aria-hidden="true">
                    <i style={{ width: `${Math.round(rec.level * 100)}%` }} />
                  </span>
                  <span className={s.timeBar} aria-hidden="true">
                    <i style={{ width: `${pct}%` }} />
                  </span>
                </>
              )}
              {phase === "cue" && <span className={s.muted} style={{ textAlign: "center" }}>{t("앞 대사가 끝나면 바로 녹음돼요…", "Recording starts when the cue ends…")}</span>}
              <button
                type="button"
                className={s.recCircle}
                data-tour="relay-rec"
                disabled={phase === "cue" || rec.state === "count"}
                onClick={() => (rec.state === "rec" ? rec.stop() : begin())}
                aria-label={rec.state === "rec" ? t("녹음 끝내기", "Stop") : t("녹음하기", "Record")}
              >
                {rec.state === "rec" ? t("끝", "Stop") : "🎙"}
              </button>
              {!recording && phase === "ready" && (
                <p className={s.tiny} style={{ textAlign: "center", margin: 0 }}>
                  {prev ? t("누르면 앞 대사가 나오고, 끝나자마자 녹음이 시작돼요", "Tap: the cue plays, then you record") : t("누르면 3·2·1 뒤에 녹음돼요", "Tap to record after 3·2·1")}
                </p>
              )}
              {!recording && phase === "ready" && reason !== "mine" && !room && (
                <button type="button" className={s.ctaSmall} style={{ justifySelf: "center" }} onClick={skip}>
                  {t("다른 배역 할래요", "Try another role")}
                </button>
              )}
            </>
          )}

          {(phase === "review" || phase === "posting") && (
            <>
              <div className={s.row} style={{ justifyContent: "center", gap: 8 }}>
                <button type="button" className={s.ctaSmall} onClick={() => void pl.play([...(prev ? [itemOf(prev)] : []), { key: "me", url: myUrl.current }])}>
                  ▶ {t("다시 듣기", "Replay")}
                </button>
                {next && (
                  <button type="button" className={s.ctaSmall} onClick={() => void pl.play([...(prev ? [itemOf(prev)] : []), { key: "me", url: myUrl.current }, itemOf(next)])}>
                    ▶ {t("뒤 대사까지", "With next line")}
                  </button>
                )}
              </div>
              <div className={s.bottomBar}>
                <div className={s.twoBtn}>
                  <button type="button" className={s.ctaGhost} disabled={phase === "posting"} onClick={() => { pl.stop(); rec.reset(); setPhase("ready"); }}>
                    {t("다시", "Retake")}
                  </button>
                  <button type="button" className={s.cta} disabled={phase === "posting"} onClick={appear} data-tour="relay-appear">
                    {phase === "posting" ? t("올리는 중…", "Posting…") : t("✓ 출연하기", "✓ Appear")}
                  </button>
                </div>
                <span className={s.tiny} style={{ textAlign: "center" }}>
                  {room
                    ? t("이 방 멤버에게만 들려요 · +30 XP (장면당 한 번)", "Only this room hears it · +30 XP per scene")
                    : t("출연하면 이 장면에 공개되고 +30 XP (장면당 한 번)", "Appearing makes this take public · +30 XP per scene")}
                </span>
              </div>
            </>
          )}

          {(phase === "posted" || phase === "adlib") && (
            <>
              <div className={s.okBox}>
                <Coco mood="wow" size={72} />
                <b>{t(`${role.name} 역으로 출연했어요!`, `You're in as ${role.name}!`)}</b>
                <span className={s.muted}>
                  {posted?.late ? t("막판 캐스팅으로 두 번째 배역이에요. ", "Last-call second role. ") : ""}
                  {room
                    ? roleLeft > 0
                      ? t(`${role.name}의 대사가 ${roleLeft}줄 더 있어요.`, `${roleLeft} more ${role.name} lines.`)
                      : t("방 채팅에 녹음했다고 알렸어요. 친구들이 들을 수 있어요!", "The room has been told — your friends can listen now!")
                    : line.candidate
                    ? t("이 대사에 1표가 들어갔어요. 표가 가장 많은 대사가 정식판에 들어가요.", "Your vote is in — the line with the most takes makes the final cut.")
                    : roleLeft > 0
                      ? t(`${role.name}의 대사가 ${roleLeft}줄 더 있어요. 24시간 동안 당신 차례예요.`, `${roleLeft} more ${role.name} lines are yours for 24h.`)
                      : t(`${timeLeft(scene.premiereAt, true)} — 개봉하면 크레딧에 이름이 올라가요.`, `${timeLeft(scene.premiereAt, false)} — you'll be in the credits.`)}
                </span>
              </div>

              {can.adlib(level) && !adlibDone && !line.candidate && (
                <div className={s.card}>
                  <b>😏 {t("애드리브 붙이기 (2초)", "Add a 2s ad-lib")}</b>
                  <span className={s.muted}>{t("내 대사 바로 뒤에 붙어요. \"크큭…\", 한숨, 비명 — 장면을 살리거나 망치거나!", "It plays right after your line. A laugh, a sigh, a scream.")}</span>
                  {adlib.state === "count" && <span className={s.countdown}>{adlib.count}</span>}
                  {adlib.state === "rec" ? (
                    <span className={s.levelBar}>
                      <i style={{ width: `${Math.round(adlib.level * 100)}%` }} />
                    </span>
                  ) : (
                    <button type="button" className={s.ctaSmall} disabled={adlib.state === "count"} onClick={() => { setPhase("adlib"); void adlib.start(ADLIB_MS); }}>
                      🎙 {t("애드리브 녹음", "Record ad-lib")}
                    </button>
                  )}
                </div>
              )}
              {adlibDone && <p className={s.muted} style={{ textAlign: "center" }}>{t("애드리브가 붙었어요 😏", "Ad-lib added 😏")}</p>}
              {!can.adlib(level) && !line.candidate && (
                <p className={s.lock}>🔒 {t("LV3이 되면 내 대사 뒤에 애드리브를 붙일 수 있어요", "At LV3 you can add ad-libs after your line")}</p>
              )}

              <div className={s.bottomBar}>
                <div className={s.twoBtn}>
                  <Link href={room ? `/relay/r/${room}` : `/relay/s/${scene.id}`} className={s.ctaGhost} onClick={() => pl.stop()}>
                    {room ? t("방으로", "Room") : t("장면 보기", "See scene")}
                  </Link>
                  <button type="button" className={s.cta} onClick={() => { pl.stop(); track("relay_next"); void load(scene.id, null); }}>
                    {t("다음 줄 하기 →", "Next line →")}
                  </button>
                </div>
              </div>
            </>
          )}

          {scene.owners.length > 0 && (phase === "ready" || phase === "review") && (
            <div className={s.castRow}>
              {scene.owners.map((o) => {
                const tk = scene.takes.find((x) => x.owner === o.owner && x.kind === "line");
                return (
                  <span key={o.role} className={`${s.castChip} ${o.mine ? s.castMine : ""}`}>
                    <AvatarDot avatar={tk?.avatar} seed={o.owner} />
                    {scene.roles.find((r) => r.id === o.role)?.name} <em>{o.mine ? t("나", "me") : o.name}</em>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}

      {posted && undoLeft > 0 && (
        <div className={s.toast} role="status">
          {t("출연 완료!", "You're in!")}
          <button type="button" onClick={undo}>
            {t(`되돌리기 ${undoLeft}`, `Undo ${undoLeft}`)}
          </button>
        </div>
      )}
    </main>
  );
}
