"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/components/lang";
import { useRecorder, usePlaylist, type PlayItem } from "@/components/relay/audio";
import { saveJoined, saveOne } from "@/components/relay/save";
import { clientId } from "@/lib/client-id";
import { saveMine, MAX_CHARS } from "@/lib/my-scripts";
import { PART_SEC, WHOLE_SEC } from "@/lib/room-script";
import { track } from "@/lib/track";
import s from "@/components/relay/relay.module.css";
import r from "@/components/relay/room.module.css";

export type ScriptTake = { id: string; part: number | null; name: string; who: string; mine: boolean; sec: number; at: string };

const audioOf = (id: string) => `/api/relay/audio/r_${id}`;

/**
 * 우리 대본 방 — 배역 없음. 단락마다 아무나 녹음하고, 이어 듣고, 처음부터 끝까지 한 번에 읽기도 한다.
 * 🔦 같이 보기: 켜 두면 누가 단락을 누를 때 모두의 화면에서 그 단락이 강조된다(보이스톡 켜고 리허설).
 */
export function ScriptPanel({
  code,
  title,
  parts,
  takes,
  onChanged,
  focus,
  follow,
  setFollow,
  sendFocus,
  toast,
}: {
  code: string;
  title: string;
  parts: string[];
  takes: ScriptTake[];
  onChanged: () => void;
  focus: number | null;
  follow: boolean;
  setFollow: (v: boolean) => void;
  sendFocus: (part: number) => void;
  toast: (m: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const pl = usePlaylist();
  const rec = useRecorder();
  const [recFor, setRecFor] = useState<number | "whole" | null>(null);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 단락마다 이어 듣기에 쓸 녹음 — 기본은 가장 최근 것, 칩을 누르면 바꾼다
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const myUrl = useRef<string | null>(null);

  const byPart = useMemo(() => {
    const m = new Map<number, ScriptTake[]>();
    for (const tk of takes) if (tk.part !== null) m.set(tk.part, [...(m.get(tk.part) ?? []), tk]);
    return m;
  }, [takes]);
  const wholes = takes.filter((tk) => tk.part === null);
  const pickFor = (n: number): ScriptTake | null => {
    const list = byPart.get(n) ?? [];
    return list.find((x) => x.id === chosen[n]) ?? list[list.length - 1] ?? null;
  };
  const items: PlayItem[] = parts.map((text, i) => {
    const tk = pickFor(i + 1);
    return { key: `p${i + 1}`, url: tk ? audioOf(tk.id) : null, text };
  });
  const recorded = parts.filter((_, i) => byPart.has(i + 1)).length;

  // 같이 보기 — 다른 사람이 누른 단락으로 스크롤
  useEffect(() => {
    if (!follow || !focus) return;
    document.getElementById(`part-${focus}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus, follow]);

  useEffect(() => {
    if (rec.state !== "done" || !rec.blob) return;
    if (myUrl.current) URL.revokeObjectURL(myUrl.current);
    myUrl.current = URL.createObjectURL(rec.blob);
  }, [rec.state, rec.blob]);

  const start = (which: number | "whole") => {
    pl.stop();
    setError(null);
    setRecFor(which);
    rec.reset();
    void rec.start((which === "whole" ? WHOLE_SEC : PART_SEC) * 1000);
  };

  const upload = async () => {
    if (!rec.blob || recFor === null) return;
    setPosting(true);
    setError(null);
    try {
      const body = new FormData();
      const ext = rec.blob.type.includes("mp4") ? "m4a" : rec.blob.type.includes("ogg") ? "ogg" : "webm";
      body.append("file", rec.blob, `take.${ext}`);
      body.append("duration", String(Math.round(rec.duration * 100) / 100));
      body.append("client", clientId());
      if (recFor !== "whole") body.append("part", String(recFor));
      const res = await fetch(`/api/relay/room/${code}/take`, { method: "POST", body });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? t("올리지 못했어요.", "Couldn't upload."));
      track("relay_post", { meme_id: "script", via: recFor === "whole" ? "whole" : "part" });
      setRecFor(null);
      rec.reset();
      onChanged();
      toast(t("올렸어요! 방 사람들에게 알렸어요", "Posted — the room has been told"));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("올리지 못했어요.", "Couldn't upload."));
    } finally {
      setPosting(false);
    }
  };

  const remove = async (tk: ScriptTake) => {
    const res = await fetch(`/api/relay/room/${code}/take?id=${tk.id}&client=${clientId()}`, { method: "DELETE" });
    if (res.ok) onChanged();
  };

  const playAll = () => {
    if (pl.playing) return pl.stop();
    track("room_play", { meme_id: "script", via: "joined" });
    void pl.play(items);
  };

  const saveAll = async () => {
    toast(t("이어 붙이는 중…", "Joining…"));
    const r2 = await saveJoined(items.map((i) => i.url), title);
    toast(
      r2.ok
        ? r2.skipped
          ? t(`저장했어요 (녹음 없는 단락 ${r2.skipped}개는 빠졌어요)`, `Saved (${r2.skipped} unrecorded skipped)`)
          : t("내 기기에 저장했어요", "Saved to your device")
        : t("저장할 녹음이 없어요", "Nothing to save yet"),
    );
  };

  const toPractice = () => {
    // 연습실 대본은 900자까지 — 넘으면 앞 단락부터 담을 수 있는 만큼
    let text = "";
    for (const p of parts) {
      if ((text + "\n" + p).length > MAX_CHARS) break;
      text = text ? `${text}\n${p}` : p;
    }
    try {
      const id = saveMine({ title: title.slice(0, 30) || "방 대본", track: "speech", pace: "mid", pitch: "mid", direction: "", text });
      router.push(`/practice/${id}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : t("연습실로 옮기지 못했어요.", "Couldn't open practice."));
    }
  };

  const recording = rec.state === "rec" || rec.state === "count";

  return (
    <>
      <div className={s.card}>
        <span className={s.spread}>
          <b>{t(`단락 ${parts.length}개 · 녹음된 단락 ${recorded}`, `${parts.length} paragraphs · ${recorded} recorded`)}</b>
          <button type="button" className={s.ctaSmall} onClick={playAll}>
            {pl.playing ? t("■ 멈춤", "■ Stop") : t("▶ 이어 듣기", "▶ Play all")}
          </button>
        </span>
        <span className={s.tiny}>{t("단락마다 가장 최근 녹음을 이어 들어요. 녹음 없는 단락은 AI가 읽어요.", "Plays the latest take per paragraph; AI reads the rest.")}</span>
        <div className={s.row} style={{ flexWrap: "wrap" }}>
          <button type="button" className={s.ctaSmall} disabled={recording} onClick={() => start("whole")}>
            🎙 {t("처음부터 끝까지 녹음", "Record it all")}
          </button>
          <button type="button" className={`${s.ctaSmall} ${follow ? r.takeOn : ""}`} onClick={() => setFollow(!follow)} aria-pressed={follow}>
            🔦 {follow ? t("같이 보기 켜짐", "Following") : t("같이 보기", "Follow along")}
          </button>
        </div>
        {follow && <span className={s.tiny}>{t("단락을 누르면 모두의 화면에서 그 단락이 강조돼요. 보이스톡 켜고 같이 읽어 보세요.", "Tap a paragraph to highlight it for everyone.")}</span>}
      </div>

      {wholes.length > 0 && (
        <div className={s.card} style={{ marginTop: 10 }}>
          <b>{t("처음부터 끝까지 읽은 녹음", "Full read-throughs")}</b>
          <div className={r.takeRow}>
            {wholes.map((tk) => (
              <span key={tk.id} className={r.takeRow}>
                <button type="button" className={`${r.takeChip} ${tk.mine ? r.takeMine : ""}`} onClick={() => void pl.play([{ key: tk.id, url: audioOf(tk.id) }])}>
                  ▶ {tk.mine ? t("나", "me") : tk.name} · {Math.round(tk.sec)}{t("초", "s")}
                </button>
                <button type="button" className={r.linkBtn} onClick={() => void saveOne(audioOf(tk.id), `${title}_${tk.name}`)}>
                  💾
                </button>
                {tk.mine && (
                  <button type="button" className={r.linkBtn} onClick={() => void remove(tk)}>
                    {t("지우기", "Delete")}
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <ol className={r.parts} style={{ marginTop: 12 }}>
        {parts.map((text, i) => {
          const n = i + 1;
          const list = byPart.get(n) ?? [];
          const cur = pickFor(n);
          const playing = pl.playing && pl.index === i;
          return (
            <li key={n} id={`part-${n}`} className={`${r.part} ${follow && focus === n ? r.partFocus : ""} ${playing ? r.partPlaying : ""}`}>
              <span className={s.spread}>
                <span className={r.partNo}>#{n}</span>
                <button type="button" className={s.ctaSmall} disabled={recording} onClick={() => start(n)} aria-label={t(`${n}번 단락 녹음`, `Record paragraph ${n}`)}>
                  🎙
                </button>
              </span>
              <p className={r.partText} onClick={() => follow && sendFocus(n)}>
                {text}
              </p>
              {list.length > 0 && (
                <div className={r.takeRow}>
                  {list.map((tk) => (
                    <button
                      key={tk.id}
                      type="button"
                      className={`${r.takeChip} ${tk.mine ? r.takeMine : ""} ${cur?.id === tk.id ? r.takeOn : ""}`}
                      onClick={() => {
                        setChosen((c) => ({ ...c, [n]: tk.id }));
                        void pl.play([{ key: tk.id, url: audioOf(tk.id) }]);
                      }}
                    >
                      ▶ {tk.mine ? t("나", "me") : tk.name}
                    </button>
                  ))}
                  {list.some((x) => x.mine) && (
                    <button type="button" className={r.linkBtn} onClick={() => void remove(list.find((x) => x.mine)!)}>
                      {t("내 녹음 지우기", "Delete mine")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <div className={s.row} style={{ marginTop: 14, flexWrap: "wrap" }}>
        <button type="button" className={s.ctaSmall} onClick={() => void saveAll()}>
          💾 {t("이어 듣기를 내 기기에 저장", "Save the joined take")}
        </button>
        <button type="button" className={s.ctaSmall} onClick={toPractice}>
          🎯 {t("연습실에서 혼자 다듬기", "Polish alone in Practice")}
        </button>
      </div>
      <p className={s.tiny} style={{ marginTop: 6 }}>
        {t("처음부터 끝까지 읽은 녹음은 💾로 하나씩 저장할 수 있어요.", "Full read-throughs can be saved one by one with 💾.")}
        {" "}
        <Link href="/practice">{t("연습실이란?", "What's Practice?")}</Link>
      </p>

      {recFor !== null && (
        <div className={r.recBar}>
          <b>{recFor === "whole" ? t("처음부터 끝까지", "Whole script") : t(`#${recFor} 단락`, `Paragraph #${recFor}`)}</b>
          {recFor !== "whole" && <p className={r.partText}>{parts[recFor - 1]}</p>}
          {rec.state === "count" && <span className={s.countdown}>{rec.count}</span>}
          {rec.state === "rec" && (
            <>
              <span className={s.levelBar} aria-hidden="true">
                <i style={{ width: `${Math.round(rec.level * 100)}%` }} />
              </span>
              <span className={s.tiny}>
                {Math.floor(rec.elapsed / 1000)}
                {t("초", "s")} / {recFor === "whole" ? WHOLE_SEC : PART_SEC}
                {t("초", "s")}
              </span>
              <button type="button" className={s.cta} onClick={() => rec.stop()}>
                ■ {t("녹음 끝", "Stop")}
              </button>
            </>
          )}
          {rec.state === "done" && (
            <>
              <button type="button" className={s.ctaSmall} onClick={() => void pl.play([{ key: "me", url: myUrl.current }])}>
                ▶ {t("들어 보기", "Listen")}
              </button>
              <div className={s.twoBtn}>
                <button type="button" className={s.ctaGhost} disabled={posting} onClick={() => start(recFor)}>
                  {t("다시", "Retake")}
                </button>
                <button type="button" className={s.cta} disabled={posting} onClick={() => void upload()}>
                  {posting ? t("올리는 중…", "Posting…") : t("✓ 방에 올리기", "✓ Post")}
                </button>
              </div>
            </>
          )}
          {(error || rec.error) && <div className={s.error}>{error ?? rec.error}</div>}
          <button
            type="button"
            className={r.linkBtn}
            onClick={() => {
              rec.reset();
              setRecFor(null);
            }}
          >
            {t("닫기", "Close")}
          </button>
        </div>
      )}
    </>
  );
}
