"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
import { TourHelp } from "@/components/onboarding/tour";
import { ScreenTour } from "@/components/onboarding/tours";
import { usePlaylist } from "@/components/relay/audio";
import { fetchScene, itemsOfPreview, lineItem, postJson } from "@/components/relay/client";
import { AvatarDot, Poster, RoleCards, useLevel } from "@/components/relay/parts";
import {
  can,
  chosenLine,
  chosenTake,
  DIRECTIONS,
  directionLabel,
  genreLabel,
  HALL_LABEL,
  isBranch,
  MAX_LINE_CHARS,
  premiereLabel,
  roleColor,
  timeLeft,
  type LineView,
  type SceneView,
  type TakeView,
} from "@/lib/relay";
import { track } from "@/lib/track";
import s from "@/components/relay/relay.module.css";

const votesOf = (lineId: string, takes: TakeView[]) => new Set(takes.filter((t) => t.lineId === lineId && t.kind === "line").map((t) => t.owner)).size;

/**
 * 장면 — 대본 10줄(지금 정식판으로 갈 줄이 굵게) · 갈림길 후보와 표 · 미리 듣기.
 * 작가(LV5)는 갈림길에 대사를 쓰고, 감독은 NG/OK · 캐스팅을 한다.
 */
export default function RelayScene({ id, initial }: { id: string; initial: SceneView | null }) {
  const t = useT();
  const ko = useLang() === "ko";
  const { level } = useLevel();
  const pl = usePlaylist();
  const [scene, setScene] = useState<SceneView | null>(initial);
  const [missing, setMissing] = useState(false);
  const [writeAt, setWriteAt] = useState<number | null>(null);
  const [castOpen, setCastOpen] = useState<string | null>(null);
  const [ngFor, setNgFor] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const r = await fetchScene(id);
    if (r) setScene(r.scene);
    else if (!initial) setMissing(true);
  }, [id, initial]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 불러오기(effect 안에서 바로 바뀌지 않는다)
    void reload();
    track("relay_open", { meme_id: initial?.stockKey ?? id });
  }, [reload, id, initial?.stockKey]);

  // 작업실·사다리에서 ?write=6 으로 왔으면 — 작가면 쓰기 창을 바로, 아니면 그 갈림길로 스크롤
  const live0 = scene?.status === "live";
  useEffect(() => {
    if (!live0) return;
    const w = Number(new URLSearchParams(window.location.search).get("write"));
    if (w !== 6 && w !== 10) return;
    document.getElementById(`branch-${w}`)?.scrollIntoView({ block: "center" });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소에 적힌 대로 한 번 연다
    if (can.write(level)) setWriteAt(w);
  }, [live0, level]);

  const preview = useMemo(() => (scene ? itemsOfPreview(scene) : null), [scene]);
  const playingLine = preview && pl.index >= 0 ? preview.lines[pl.index]?.lineId : null;

  if (missing) {
    return (
      <main className={`shell ${s.page}`}>
        <Link href="/relay" className={s.back}>
          ‹ {t("릴레이 더빙", "Relay Dubbing")}
        </Link>
        <div className={s.okBox} style={{ marginTop: 30 }}>
          <Coco mood="think" size={80} />
          <b>{t("볼 수 없는 장면이에요", "This scene isn't available")}</b>
          <span className={s.muted}>{t("승인을 기다리거나 내려간 장면이에요.", "It's waiting for approval or was removed.")}</span>
        </div>
      </main>
    );
  }
  if (!scene) {
    return (
      <main className={`shell ${s.page}`}>
        <div className={s.okBox} style={{ marginTop: 40, background: "transparent", border: 0 }}>
          <Coco mood="think" size={80} />
        </div>
      </main>
    );
  }

  const live = scene.status === "live";
  const dir = Boolean(scene.amDirector) && live;
  const base = scene.lines.filter((l) => !l.candidate).sort((a, b) => a.n - b.n);
  const voiced = base.filter((l) => scene.takes.some((x) => x.lineId === l.id && x.kind === "line")).length;
  const hall = HALL_LABEL[scene.hall];
  const mineRole = scene.owners.find((o) => o.mine);

  const stamp = async (take: TakeView, value: "ok" | "ng" | null, direction?: string) => {
    const r = await postJson("/api/relay/stamp", { takeId: take.id, stamp: value, direction: direction ?? null });
    if (!r.ok) setMsg(r.data.error ?? t("찍지 못했어요", "Failed"));
    else track("relay_stamp", { via: value ?? "clear" });
    setNgFor(null);
    void reload();
  };

  const playAll = () => {
    if (!preview) return;
    if (pl.playing) return pl.stop();
    track("relay_preview", { meme_id: scene.stockKey ?? scene.id });
    void pl.play(preview.items);
  };

  return (
    <main className={`shell ${s.page}`}>
      <div className={s.spread}>
        <Link href="/relay" className={s.back} onClick={() => pl.stop()}>
          ‹ {t("상영관", "Halls")}
        </Link>
        <span className={s.row}>
          <Link href="/relay/guide" className={s.guideBtn}>
            📖 {t("가이드", "Guide")}
          </Link>
          <TourHelp id="relay-scene" short />
        </span>
      </div>

      <h1 className={s.srOnly}>{scene.title}</h1>
      <Poster
        genre={scene.genre}
        title={scene.title}
        sub={scene.logline}
        tag={
          <span className={s.hallTag}>
            {live && <i className={s.live} aria-hidden="true" />} {ko ? hall.ko : hall.en} · {genreLabel(scene.genre, ko)}
            {scene.mode === "chaos" ? ` · ${t("🌀 막장", "🌀 Chaos")}` : ""}
          </span>
        }
        right={<span className={s.posterWhen}>{live ? timeLeft(scene.premiereAt, ko) : scene.status === "premiered" ? t("개봉작", "Premiered") : ""}</span>}
      />
      {(scene.directorName || scene.promptName) && (
        <p className={s.tiny} style={{ margin: "8px 0 0" }}>
          {scene.directorName ? `🎬 ${t("감독", "Director")} ${scene.directorName}` : ""}
          {scene.promptName ? ` · 💡 ${t("원안", "Idea")} ${scene.promptName}` : ""}
        </p>
      )}

      {scene.status === "pending" && <div className={s.lock}>⏳ {t("운영자 확인을 기다리는 장면이에요. 승인되면 차례대로 열려요.", "Waiting for review.")}</div>}
      {scene.status === "queued" && <div className={s.lock}>🎟 {t("다음 상영을 기다리는 중이에요. 상영관이 비면 바로 열려요.", "Queued for the next opening.")}</div>}

      <div className={s.card} data-tour="relay-scene-cast" style={{ marginTop: 14 }}>
        <span className={s.spread}>
          <b>🎭 {live ? t("배역 고르기", "Pick a role") : t("출연진", "Cast")}</b>
          <span className={s.tiny}>{live ? premiereLabel(scene.premiereAt, ko) : ""}</span>
        </span>
        {live && !mineRole && <span className={s.muted}>{t("하고 싶은 역의 「이 배역 하기」를 누르면 그 배역 첫 대사부터 녹음해요.", "Tap “Play this” to record that role's first line.")}</span>}
        <RoleCards scene={scene} onCast={dir ? (r) => setCastOpen(r.id) : undefined} />
        <span className={s.meter}>
          <i style={{ width: `${(voiced / 10) * 100}%` }} />
        </span>
        <span className={s.tiny}>{t(`사람 목소리 ${voiced}/10줄 · 빈 줄은 AI 대역이 읽어요`, `${voiced}/10 human lines · an AI stand-in reads the rest`)}</span>
      </div>

      <div className={s.row} style={{ gap: 8, marginTop: 10 }}>
        <button type="button" className={s.ctaSmall} onClick={playAll} data-tour="relay-scene-play">
          {pl.playing ? `■ ${t("멈추기", "Stop")}` : `▶ ${live ? t("지금까지 이어 듣기", "Play so far") : t("들어 보기", "Play")}`}
        </button>
        {scene.status === "premiered" && (
          <Link href={`/relay/s/${scene.id}/premiere`} className={s.ctaSmall}>
            🍿 {t("개봉관에서 보기", "Watch premiere")}
          </Link>
        )}
        {live && (
          <span className={s.tiny}>{t("정식판은 개봉 때 자막과 함께 처음부터 끝까지", "Full cut with subtitles at the premiere")}</span>
        )}
      </div>
      {msg && (
        <div className={s.error} onClick={() => setMsg(null)}>
          {msg}
        </div>
      )}

      <div className={s.section}>
        <h2>📜 {t("대본", "Script")}</h2>
        {dir && <span className={s.tiny}>🎬 {t("감독 모드", "Director mode")}</span>}
      </div>
      <ol className={s.script}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const b = base.find((l) => l.n === n);
          if (!b) return null;
          const cands = scene.lines.filter((l) => l.n === n && l.candidate).sort((x, y) => votesOf(y.id, scene.takes) - votesOf(x.id, scene.takes) || x.at.localeCompare(y.at));
          const chosen = chosenLine(n, scene.lines, scene.takes).line;
          return (
            <li key={n}>
              <LineRow
                line={b}
                scene={scene}
                chosen={chosen?.id === b.id}
                now={playingLine === b.id}
                dir={dir}
                ngFor={ngFor}
                setNgFor={setNgFor}
                onStamp={stamp}
                onPlay={(take) => void pl.play([lineItem(b, take)])}
              />
              {isBranch(n) && (
                <div className={s.branch} id={`branch-${n}`}>
                  <span className={s.branchHead}>
                    <b>🔀 {n === 6 ? t("갈림길 ① — 6번 대사 바꿔 쓰기", "Branch ① — rewrite line 6") : t("갈림길 ② — 결말(10번) 바꿔 쓰기", "Branch ② — rewrite the ending")}</b>
                  </span>
                  <span className={s.branchHow}>
                    {t(
                      "작가(LV5+)가 위 대사 대신 새 대사를 올리면, 배우들이 마음에 드는 대사를 녹음해요. 녹음 한 번 = 1표, 제일 많이 녹음된 대사가 개봉판에 들어가요.",
                      "Writers (LV5+) post alternatives to the line above. Actors record the one they like — each recording is a vote; the top line makes the premiere.",
                    )}
                  </span>
                  {cands.length === 0 && <span className={s.tiny}>{t("아직 올라온 대사가 없어요 — 이대로면 위의 원래 대사로 개봉해요.", "Nothing posted yet — the original line stays.")}</span>}
                  {cands.map((c) => (
                    <div key={c.id} className={`${s.cand} ${chosen?.id === c.id ? s.candLead : ""}`}>
                      <LineRow
                        line={c}
                        scene={scene}
                        chosen={chosen?.id === c.id}
                        now={playingLine === c.id}
                        dir={dir}
                        ngFor={ngFor}
                        setNgFor={setNgFor}
                        onStamp={stamp}
                        onPlay={(take) => void pl.play([lineItem(c, take)])}
                        compact
                      />
                      <span className={s.spread}>
                        <span className={s.vote}>
                          🗳 {votesOf(c.id, scene.takes)}
                          {t("표", " votes")}
                          {c.twist ? ` · 🃏 ${t("반전 카드", "twist")}` : ""}
                          {c.authorName ? ` · ✍️ ${c.authorName}` : ""}
                        </span>
                        {live && !c.twist && (
                          <Link href={`/relay/rec?scene=${scene.id}&line=${c.id}`} className={s.ctaSmall}>
                            🎙 {t("녹음해서 투표", "Vote by recording")}
                          </Link>
                        )}
                      </span>
                    </div>
                  ))}
                  {live &&
                    (can.write(level) ? (
                      <button type="button" className={s.writeBtn} onClick={() => setWriteAt(n)} data-tour={n === 6 ? "relay-write" : undefined}>
                        ✍️ {n === 10 ? t("내 결말 쓰기", "Write my ending") : t("내 6번 대사 쓰기", "Write my line 6")}
                      </button>
                    ) : (
                      <Link href="/relay/guide#ranks" className={s.lock}>
                        🔒 {t(`LV5 작가부터 쓸 수 있어요 (지금 LV${level}) · 녹음해서 투표는 누구나`, `Writers from LV5 (you're LV${level}) · anyone can vote by recording`)}
                      </Link>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {scene.status === "premiered" ? (
        <div className={s.bottomBarNav}>
          <Link href={`/relay/s/${scene.id}/premiere`} className={s.cta} onClick={() => pl.stop()}>
            🍿 {t("개봉관 입장", "Enter the premiere")}
          </Link>
        </div>
      ) : live ? (
        <div className={s.bottomBarNav}>
          <Link href={`/relay/rec?scene=${scene.id}`} className={s.cta} data-tour="relay-scene-cta" onClick={() => pl.stop()}>
            🎙 {mineRole ? t("내 배역 이어서 녹음", "Continue my role") : t("아무 배역이나 바로 녹음", "Any open role, now")}
          </Link>
        </div>
      ) : null}

      {writeAt !== null && (
        <WriterSheet
          scene={scene}
          n={writeAt}
          level={level}
          onClose={() => setWriteAt(null)}
          onDone={() => {
            setWriteAt(null);
            setMsg(t("대사를 올렸어요! 배우가 녹음하면 1표씩 들어가요 ✍️", "Posted! Each recording is a vote ✍️"));
            void reload();
          }}
        />
      )}
      {castOpen && <CastSheet scene={scene} role={castOpen} onClose={() => setCastOpen(null)} onDone={() => { setCastOpen(null); void reload(); }} />}
      <ScreenTour id="relay-scene" />
    </main>
  );
}

function LineRow({
  line,
  scene,
  chosen,
  now,
  dir,
  ngFor,
  setNgFor,
  onStamp,
  onPlay,
  compact,
}: {
  line: LineView;
  scene: SceneView;
  chosen: boolean;
  now: boolean;
  dir: boolean;
  ngFor: string | null;
  setNgFor: (id: string | null) => void;
  onStamp: (take: TakeView, v: "ok" | "ng" | null, direction?: string) => void;
  onPlay: (takeId: string | null) => void;
  compact?: boolean;
}) {
  const t = useT();
  const ko = useLang() === "ko";
  const role = scene.roles.find((r) => r.id === line.role);
  const takes = scene.takes.filter((x) => x.lineId === line.id && x.kind === "line");
  const lead = chosenTake(line, scene.takes, scene.owners);
  const mine = takes.some((x) => x.mine);
  const myNg = takes.find((x) => x.mine && x.stamp === "ng");
  const list = dir ? takes : lead ? [lead] : [];
  return (
    <div className={`${s.line} ${now ? s.lineNow : ""} ${mine ? s.lineMine : ""}`} style={compact ? { border: 0, padding: 0, background: "transparent" } : chosen ? undefined : { opacity: 0.72 }}>
      {!compact && <span className={s.lineN}>{line.n}</span>}
      <span className={s.lineBody}>
        <span className={s.roleName} style={{ color: roleColor(scene.roles, line.role) }}>
          {role?.name ?? line.role}
        </span>
        <span className={s.lineText}>{line.text}</span>
        {line.dir && !compact && <span className={s.lineDir}>({line.dir})</span>}
        {myNg && (
          <span className={s.error} style={{ padding: "4px 8px" }}>
            🎬 NG — {directionLabel(myNg.direction, ko) || t("다시 한 번", "One more time")}{" "}
            {scene.status === "live" && <Link href={`/relay/rec?scene=${scene.id}&line=${line.id}`}>{t("다시 녹음", "Retake")}</Link>}
          </span>
        )}
        {list.length === 0 ? (
          <span className={s.voice}>
            <span className={s.tts}>{t("AI 대역 · 아직 비어 있어요", "AI stand-in · still open")}</span>
            <button type="button" className={s.playBtn} onClick={() => onPlay(null)} aria-label={t("듣기", "Play")}>
              ▶
            </button>
          </span>
        ) : (
          list.map((tk) => (
            <span key={tk.id} className={s.voice}>
              <AvatarDot avatar={tk.avatar} seed={tk.owner} size={18} />
              <span>{tk.mine ? t("나", "me") : tk.name}</span>
              {tk.stamp === "ok" && <span className={s.branchTag}>OK</span>}
              {tk.stamp === "ng" && dir && <span className={s.tip}>NG · {directionLabel(tk.direction, ko)}</span>}
              {!dir && takes.length > 1 && <span className={s.tiny}>+{takes.length - 1}</span>}
              <button type="button" className={s.playBtn} onClick={() => onPlay(tk.id)} aria-label={t("듣기", "Play")}>
                ▶
              </button>
              {dir && (
                <>
                  <button type="button" className={`${s.chip} ${tk.stamp === "ok" ? s.chipOn : ""}`} onClick={() => onStamp(tk, tk.stamp === "ok" ? null : "ok")}>
                    OK
                  </button>
                  <button type="button" className={`${s.chip} ${tk.stamp === "ng" ? s.chipOn : ""}`} onClick={() => (tk.stamp === "ng" ? onStamp(tk, null) : setNgFor(ngFor === tk.id ? null : tk.id))}>
                    NG
                  </button>
                </>
              )}
              {dir && ngFor === tk.id && (
                <span className={s.chips} style={{ flexBasis: "100%" }}>
                  {DIRECTIONS.map((d) => (
                    <button key={d.id} type="button" className={s.chip} onClick={() => onStamp(tk, "ng", d.id)}>
                      {ko ? d.ko : d.en}
                    </button>
                  ))}
                </span>
              )}
            </span>
          ))
        )}
      </span>
    </div>
  );
}

function WriterSheet({ scene, n, level, onClose, onDone }: { scene: SceneView; n: number; level: number; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const base = scene.lines.find((l) => l.n === n && !l.candidate);
  const [role, setRole] = useState(base?.role ?? scene.roles[0]?.id ?? "");
  const [text, setText] = useState("");
  const [twist, setTwist] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [busy, setBusy] = useState(false);
  // 막장 모드: 바로 앞 두 줄만 보고 쓴다. 보통: 앞 네 줄
  const before = scene.lines.filter((l) => !l.candidate && l.n < n).sort((a, b) => a.n - b.n);
  const context = scene.mode === "chaos" ? before.slice(-2) : before.slice(-4);
  const roleName = (id: string) => scene.roles.find((r) => r.id === id)?.name ?? id;
  const send = async () => {
    setBusy(true);
    setErr(null);
    const r = await postJson("/api/relay/lines", { sceneId: scene.id, n, role, text, twist });
    setBusy(false);
    if (r.ok) {
      track("relay_write", { via: twist ? "twist" : String(n) });
      onDone();
    } else {
      setErr(r.data.error ?? t("올리지 못했어요", "Couldn't post"));
      setNeedLogin(Boolean(r.data.needLogin));
    }
  };
  return (
    <div className={s.sheetBack} role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.sheet}>
        <span className={s.spread}>
          <b className={s.sheetTitle}>✍️ {n === 6 ? t("6번 대사 바꿔 쓰기", "Rewrite line 6") : t("결말(10번) 바꿔 쓰기", "Rewrite the ending")}</b>
          <button type="button" className={s.sheetX} onClick={onClose} aria-label={t("닫기", "Close")}>
            ✕
          </button>
        </span>

        <div className={s.wStep}>
          <span className={s.wNum}>1</span>
          <b>{scene.mode === "chaos" ? t("앞 두 줄만 보고 (🌀 막장 모드)", "Only the last two lines (🌀 chaos)") : t("앞 내용", "What came before")}</b>
        </div>
        <ol className={s.ctx}>
          {context.map((l) => (
            <li key={l.id}>
              <span className={s.ctxN}>{l.n}</span>
              <span className={s.ctxBody}>
                <b style={{ color: roleColor(scene.roles, l.role) }}>{roleName(l.role)}</b>
                <span>{l.text}</span>
              </span>
            </li>
          ))}
          {base && (
            <li className={s.ctxOld}>
              <span className={s.ctxN}>{n}</span>
              <span className={s.ctxBody}>
                <b style={{ color: roleColor(scene.roles, base.role) }}>
                  {roleName(base.role)} · {t("원래 대사", "original")}
                </b>
                <span>{base.text}</span>
              </span>
            </li>
          )}
        </ol>
        <span className={s.tiny}>{t("↑ 원래 대사 대신 들어갈, 더 웃기거나 더 극적인 대사를 써 보세요.", "↑ Write something funnier or more dramatic to replace it.")}</span>

        <div className={s.wStep}>
          <span className={s.wNum}>2</span>
          <b>{t("누가 말할까요?", "Who says it?")}</b>
        </div>
        <span className={s.chips}>
          {scene.roles.map((r) => (
            <button key={r.id} type="button" className={`${s.chip} ${role === r.id ? s.chipOn : ""}`} onClick={() => setRole(r.id)}>
              {r.name}
            </button>
          ))}
        </span>

        <div className={s.wStep}>
          <span className={s.wNum}>3</span>
          <b>{t("대사", "Line")}</b>
        </div>
        <textarea className={s.textarea} value={text} maxLength={MAX_LINE_CHARS} rows={2} placeholder={t("여기에 새 대사", "Your new line")} onChange={(e) => setText(e.target.value)} />
        <span className={s.counter}>
          {text.length}/{MAX_LINE_CHARS} · {t("숫자는 한글로 (예: 삼 초)", "Spell out numbers")}
        </span>

        {n === 10 &&
          (can.twist(level) ? (
            <label className={s.twistBox}>
              <input type="checkbox" checked={twist} onChange={(e) => setTwist(e.target.checked)} />
              <span>
                <b>🃏 {t("반전 카드로 쓰기", "Use as a twist card")}</b>
                <small>{t("투표 없이 '반전판' 결말로 따로 상영돼요. 장면당 한 장.", "Plays as a separate twist ending, no vote. One per scene.")}</small>
              </span>
            </label>
          ) : (
            <span className={s.tiny}>🔒 {t("LV6이 되면 반전 카드(투표 없이 따로 상영되는 결말)를 쓸 수 있어요", "Twist cards at LV6")}</span>
          ))}

        <span className={s.wAfter}>{t("올리면 → 배우들이 이 대사를 녹음할 때마다 1표 → 개봉 때 1등 대사가 장면에 들어가고 크레딧에 작가로 이름이 올라가요.", "After posting → each actor recording it is a vote → the winner goes in the premiere with you credited as writer.")}</span>

        {err && (
          <div className={s.error}>
            {err} {needLogin && <Link href={`/login?next=/relay/s/${scene.id}`}>{t("로그인", "Log in")}</Link>}
          </div>
        )}
        <div className={s.twoBtn}>
          <button type="button" className={s.ctaGhost} onClick={onClose}>
            {t("닫기", "Close")}
          </button>
          <button type="button" className={s.cta} disabled={busy || text.trim().length < 2} onClick={send}>
            {busy ? t("목소리 입히는 중…", "Voicing…") : t("올리기", "Post")}
          </button>
        </div>
      </div>
    </div>
  );
}

type Actor = { id: string; name: string; avatar: Record<string, string> | null; scenes: number };

function CastSheet({ scene, role, onClose, onDone }: { scene: SceneView; role: string; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [actors, setActors] = useState<Actor[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const r = scene.roles.find((x) => x.id === role);
  const current = scene.casts.find((c) => c.role === role);
  useEffect(() => {
    void (async () => {
      const { clientId } = await import("@/lib/client-id");
      const res = await fetch(`/api/relay/cast?scene=${scene.id}&client=${clientId()}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (res.ok) setActors(d.actors ?? []);
      else setErr(d.error ?? "error");
    })();
  }, [scene.id]);
  const pick = async (actor: string | null) => {
    const res = await postJson("/api/relay/cast", { sceneId: scene.id, role, actor });
    if (!res.ok) return setErr(res.data.error ?? t("지명하지 못했어요", "Couldn't cast"));
    track("relay_cast");
    onDone();
  };
  return (
    <div className={s.sheetBack} role="dialog" aria-modal="true" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={s.sheet}>
        <b>🎬 {t(`${r?.name} 캐스팅`, `Cast ${r?.name}`)}</b>
        <span className={s.muted}>{t("지명받은 사람에게 알림이 가고, 녹음 버튼을 누르면 바로 이 배역이 나와요. 장면당 둘까지.", "They get a notification and land straight on this role. Two per scene.")}</span>
        {err && <div className={s.error}>{err}</div>}
        {!actors && !err && <span className={s.tiny}>{t("불러오는 중…", "Loading…")}</span>}
        {actors && actors.length === 0 && <span className={s.tiny}>{t("아직 릴레이에 출연한 목소리가 없어요.", "No relay actors yet.")}</span>}
        <ul className={s.list} style={{ maxHeight: "48vh", overflow: "auto" }}>
          {actors?.map((a) => (
            <li key={a.id}>
              <button type="button" className={s.item} style={{ width: "100%" }} onClick={() => pick(a.id)}>
                <AvatarDot avatar={a.avatar} seed={a.id} size={28} />
                <span className={s.itemText}>
                  <b>{a.name}</b>
                  <small>{t(`출연 ${a.scenes}편`, `${a.scenes} scenes`)}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            </li>
          ))}
        </ul>
        <div className={s.twoBtn}>
          {current ? (
            <button type="button" className={s.ctaGhost} onClick={() => pick(null)}>
              {t("지명 취소", "Remove cast")}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className={s.cta} onClick={onClose}>
            {t("닫기", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
