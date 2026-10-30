"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Piano } from "@/components/piano";
import { VoiceAvatar } from "@/components/voice-avatar";
import { useViewer } from "@/components/viewer";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink } from "@/components/weekly/use-weekly";
import { useLang, useT } from "@/components/lang";
import { DEFAULT_AVATAR, encodeAvatar } from "@/lib/avatar";
import { makeReader, stableExtreme, summarizeSpeak, toMidi, HOLD_S, type Frame } from "@/lib/pitch";
import { SCRIPTS } from "@/lib/scripts";
import { track } from "@/lib/track";
import {
  cardQuery,
  ladder,
  noteName,
  readCard,
  summary,
  tierLabel,
  tierOf,
  type Gender,
  type RangeCard,
} from "@/lib/voice-range";
import { RangeCardView, type Step } from "./card";
import styles from "./voice.module.css";

const GENDER_KEY = "mimic.voice.gender";
const CARD_KEY = "mimic.voice.range";

/** 한 번 재는 상한(초). */
const MAX_S: Record<Step, number> = { speak: 12, low: 15, high: 15 };
/** 이만큼 소리를 낸 뒤 이만큼 조용하면 저절로 끝낸다. */
const AUTO_STOP: Record<Step, { voiced: number; silence: number }> = {
  speak: { voiced: 2.5, silence: 1.6 },
  low: { voiced: 1, silence: 2.5 },
  high: { voiced: 1, silence: 2.5 },
};

type Live = { m: number | null; level: number; record: number | null; elapsed: number };
type Line = { title: string; text: string };

/**
 * 평소 목소리용 대본 — 연습실 대본 중 하나를 무작위로, 앞부분만.
 * 일부러 높게(분노·비명) 또는 낮게 깔아 읽는 대본은 뺀다(pitch: mid 만) — 평소 음을 재야 한다.
 * 대본은 한국어뿐이라 영어 화면엔 일상 문장을 따로 둔다.
 */
const LINES_KO: Line[] = SCRIPTS.filter((s) => s.pitch === "mid").map((s) => {
  let text = "";
  for (const para of s.text.split(/\n\s*\n/)) {
    text = text ? `${text} ${para}` : para;
    if ((text.match(/[가-힣]/g) ?? []).length >= 22) break;
  }
  return { title: s.title, text: text.replace(/\*/g, "").replace(/\s*\/\s*/g, " ") };
});
const LINES_EN: Line[] = [
  { title: "Running late", text: "Hey, it's me. I'm running a little late, but I'll be there in ten minutes. Save me a seat." },
  { title: "Weather", text: "Today will be clear and mild, with a light breeze in the afternoon. Perfect for a walk." },
  { title: "New café", text: "I tried the new place around the corner. Honestly? The coffee was better than the cake." },
  { title: "Voicemail", text: "Thanks for calling. I can't get to the phone right now, so leave a message after the tone." },
  { title: "Front desk", text: "Welcome back. Your room is ready on the fifth floor, and breakfast starts at seven." },
];
const pickLine = (lang: "ko" | "en", not?: Line | null): Line => {
  const pool = lang === "en" ? LINES_EN : LINES_KO;
  const rest = pool.filter((l) => l !== not);
  return rest[Math.floor(Math.random() * rest.length)] ?? pool[0];
};

function readSaved(): RangeCard | null {
  try {
    const raw = localStorage.getItem(CARD_KEY);
    return raw ? readCard(new URLSearchParams(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * 목소리 음역대 테스트 — "아~" 끝까지 올리기(최고음) · "음~" 끝까지 내리기(최저음) · 대본 한 줄(평소 음).
 * 셋은 따로따로 잰다. 하나만 재도 결과 카드가 나오고, 나머지 칸은 카드에서 원할 때 채운다.
 *
 * 녹음 파일을 만들지 않는다. 마이크를 실시간으로 읽어 프레임마다 음 하나만 모으고, 결과는 숫자 몇 개다.
 * 지금 내는 음이 건반 위에서 바로 움직여야 한다 — 그게 이 테스트의 재미 절반이다.
 * 최저·최고는 개인 최고 기록으로 남는다. "기록 깨기"로 다시 오게 한다.
 */
export default function Maker() {
  const t = useT();
  const lang = useLang();
  const viewer = useViewer();
  const avatar = viewer?.avatar ?? DEFAULT_AVATAR;
  const [gender, setGender] = useState<Gender>("x");
  const [card, setCard] = useState<RangeCard | null>(null);
  /** null 이면 결과(카드가 있을 때)나 첫 화면 */
  const [step, setStep] = useState<Step | null>(null);
  const [listening, setListening] = useState(false);
  const [live, setLive] = useState<Live>({ m: null, level: 0, record: null, elapsed: 0 });
  const [error, setError] = useState<string | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [origin, setOrigin] = useState("");
  const [line, setLine] = useState<Line | null>(null);
  /** 방금 새로 오른 등급 — 잠깐 반짝인다 */
  const [flash, setFlash] = useState<number | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(location.origin);
    // 무작위는 화면이 붙은 뒤에 — 서버 렌더와 어긋나지 않게.
    setLine(pickLine(lang));
    try {
      const g = localStorage.getItem(GENDER_KEY);
      if (g === "m" || g === "f" || g === "x") setGender(g);
    } catch {}
    const saved = readSaved();
    if (saved) setCard(saved);
  }, [lang]);

  const pickGender = (g: Gender) => {
    setGender(g);
    setCard((c) => (c ? { ...c, gender: g } : c));
    try {
      localStorage.setItem(GENDER_KEY, g);
    } catch {}
  };

  const save = (c: RangeCard) => {
    setCard(c);
    try {
      localStorage.setItem(CARD_KEY, cardQuery({ ...c, avatar: "" }));
    } catch {}
  };

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((x) => x.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  useEffect(() => () => release(), [release]);

  const base = (): RangeCard =>
    card ?? { speak: null, spread: null, low: null, high: null, gender, lang, avatar: encodeAvatar(avatar) };

  const finish = (s: Step, frames: Frame[]) => {
    const prev = base();
    const next: RangeCard = { ...prev, gender, lang, avatar: encodeAvatar(avatar) };
    if (s === "speak") {
      const r = summarizeSpeak(frames);
      if (!r) {
        setError(t("목소리가 잘 안 들렸어요. 조용한 곳에서 평소처럼 읽어 주세요.", "We couldn't hear enough. Read in your normal voice somewhere quiet."));
        return;
      }
      next.speak = r.speak;
      next.spread = r.spread;
    } else {
      const v = stableExtreme(frames, s);
      if (v === null) {
        setError(
          t(
            `음이 안 잡혔어요. 맨 ${s === "low" ? "아래" : "위"}에서 ${HOLD_S}초만 버텨 주세요!`,
            `Couldn't catch a note. Hold your ${s === "low" ? "lowest" : "highest"} note for ${HOLD_S}s!`,
          ),
        );
        return;
      }
      const old = s === "low" ? prev.low : prev.high;
      const better = old === null || (s === "low" ? v < old : v > old);
      if (s === "low") next.low = better ? v : old;
      else next.high = better ? v : old;
      if (old !== null && better) showToast(t(`🎉 새 기록! ${noteName(v, lang).full}`, `🎉 New record! ${noteName(v, lang).full}`));
      else if (old !== null) showToast(t(`이번엔 ${noteName(v, lang).full} — 기록은 그대로예요`, `${noteName(v, lang).full} this time — record stands`));
    }
    save(next);
    buzz(40);
    // 잰 값을 남긴다 — 등급 경계·평균 음높이를 실제 사용자 분포로 다시 맞추는 데 쓴다. via 는 16자라 값은 meme_id 칸에.
    track("voice_card_done", { via: s, meme_id: cardQuery({ ...next, avatar: "" }) });
    // 하나 재면 바로 결과. 나머지는 결과 카드의 "재기 →" 로.
    setStep(null);
  };

  const listen = async (s: Step) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("이 브라우저는 마이크를 못 써요. 크롬이나 사파리로 열어 주세요", "This browser can't use the mic. Open in Chrome or Safari"));
      return;
    }
    setError(null);
    let ms: MediaStream;
    try {
      // 음높이만 잰다 — 자동 음량·잡음 제거는 끈다(목소리 모양을 바꾼다).
      ms = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: false },
      });
    } catch {
      setError(t("마이크를 허용해야 잴 수 있어요 🎙️", "Allow the mic to measure 🎙️"));
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      ms.getTracks().forEach((x) => x.stop());
      setError(t("이 브라우저는 소리 분석을 못 해요", "This browser can't analyze audio"));
      return;
    }
    const c = new Ctor();
    void c.resume().catch(() => {});
    const analyser = c.createAnalyser();
    analyser.fftSize = 4096;
    c.createMediaStreamSource(ms).connect(analyser);
    stream.current = ms;
    ctx.current = c;
    const read = makeReader(analyser, c.sampleRate);

    const frames: Frame[] = [];
    const t0 = performance.now();
    let prev = t0;
    let voiced = 0;
    let lastVoiced = t0;
    let n = 0;
    let record: number | null = null;
    let tierIdx = -1;
    let done = false;
    const end = () => {
      if (done) return;
      done = true;
      stopRef.current = null;
      release();
      setListening(false);
      setLive({ m: null, level: 0, record: null, elapsed: 0 });
      finish(s, frames);
    };
    stopRef.current = end;
    setListening(true);
    setLive({ m: null, level: 0, record: null, elapsed: 0 });
    track("voice_card_start", { via: `${s}-${lang}-${gender}` });

    const loop = () => {
      if (done) return;
      const now = performance.now();
      const { hz, level } = read(s);
      const m = hz ? toMidi(hz) : null;
      if (m !== null) {
        frames.push({ t: (now - t0) / 1000, m });
        voiced += Math.min(0.05, (now - prev) / 1000);
        lastVoiced = now;
      }
      prev = now;
      n += 1;
      if (s !== "speak" && n % 6 === 0) {
        record = stableExtreme(frames, s);
        // 등급이 오르는 순간이 이 테스트의 하이라이트다 — 진동과 반짝임.
        const idx = record === null ? -1 : tierOf(s, record, gender).index;
        if (idx > tierIdx) {
          if (tierIdx >= 0 || idx > 0) {
            buzz(35);
            setFlash(idx);
          }
          tierIdx = idx;
        }
      }
      setLive({ m, level, record, elapsed: (now - t0) / 1000 });
      const rule = AUTO_STOP[s];
      const quiet = (now - lastVoiced) / 1000;
      if ((now - t0) / 1000 >= MAX_S[s] || (voiced >= rule.voiced && quiet >= rule.silence && (s === "speak" || record !== null))) {
        end();
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  const stop = () => stopRef.current?.();

  const query = card ? cardQuery(card) : "";
  const shareUrl = card && origin ? `${origin}/voice/c?${query}` : "";
  const storyUrl = card && step === null ? `/api/og/voice?${query}&fmt=story&ui=${lang}` : "";

  // 공유 시트는 누른 그 순간에만 열린다(사파리). 이미지를 누른 뒤에 받으면 늦으니 미리 받아 둔다.
  useEffect(() => {
    if (!storyUrl) return;
    let alive = true;
    fetch(storyUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (alive && b) setImage(new File([b], "mimic-vocal-range.png", { type: "image/png" }));
      })
      .catch(() => {});
    return () => {
      alive = false;
      setImage(null);
    };
  }, [storyUrl]);

  const share = async () => {
    if (!card) return;
    const s = summary(card, lang);
    const text = s.emoji
      ? t(`${s.lead} ${s.emoji} ${s.headline} 나옴 (${s.sub}). 너도 재 봐!`, `${s.lead}: ${s.emoji} ${s.headline} (${s.sub}). Try yours!`)
      : t(`평소 내 목소리 음은 ${s.headline}. 너도 재 봐!`, `My speaking note is ${s.headline}. Try yours!`);
    track("voice_card_share", { via: card.high !== null ? "high" : card.low !== null ? "low" : "speak" });
    // 버튼은 하나 — 카드 그림과 친구가 바로 해 볼 링크를 같이 보낸다.
    // 인스타처럼 글을 버리는 앱이 있어 링크는 클립보드에도 넣어 둔다(스토리 링크 스티커에 붙여 넣기).
    let copied = false;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copied = true;
    } catch {}
    try {
      if (image && navigator.canShare?.({ files: [image] })) {
        await navigator.share({ files: [image], text: `${text}\n${shareUrl}` });
        if (copied) showToast(t("링크도 복사해 뒀어요. 스토리엔 링크 스티커로 붙여 넣으세요!", "Link copied too — add it as a link sticker in your story!"));
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    const r = await shareLink(shareUrl, text);
    if (r === "copied" || copied) showToast(t("링크를 복사했어요. 단톡방에 붙여 넣어 보세요!", "Link copied. Paste it in your group chat!"));
  };

  const reset = () => {
    setCard(null);
    setStep(null);
    try {
      localStorage.removeItem(CARD_KEY);
    } catch {}
  };

  /* --- 측정 화면 --------------------------------------------------------- */
  if (step) {
    const liveName = live.m !== null ? noteName(live.m, lang) : null;
    const recName = live.record !== null ? noteName(live.record, lang).full : null;
    const doneSpeak = card?.speak ?? null;
    const guide: Record<Step, { title: string; how: string; tip: string }> = {
      speak: {
        title: t("평소 목소리", "Speaking voice"),
        how: t("이 대본을 평소 말투로 읽어 주세요", "Read this in your normal voice"),
        tip: t("다 읽고 잠깐 조용히 있으면 저절로 끝나요", "Stop when you're done — it ends by itself"),
      },
      low: {
        title: t("가장 낮은 음", "Lowest note"),
        how: t("‘음~’ 하고 낼 수 있는 데까지 천천히 내려가세요", "Hum ‘mmm’ and slide down as low as you can"),
        tip: t(`맨 아래에서 ${HOLD_S}초만 버티면 기록돼요`, `Hold the bottom for ${HOLD_S}s to lock it in`),
      },
      high: {
        title: t("가장 높은 음", "Highest note"),
        how: t("‘아~’ 하고 낼 수 있는 데까지 천천히 올라가세요", "Sing ‘ahh’ and slide up as high as you can"),
        tip: t(`가성도 돼요. 꼭대기에서 ${HOLD_S}초 버티기!`, `Falsetto counts. Hold the top for ${HOLD_S}s!`),
      },
    };
    const g = guide[step];
    return (
      <main className={`shell ${styles.page}`}>
        <nav className={styles.nav}>
          <button type="button" onClick={() => (listening ? stop() : setStep(null))}>
            {t("← 그만하기", "← Stop")}
          </button>
        </nav>

        <p className="eyebrow">{g.title}</p>
        <h1 className={styles.how}>{g.how}</h1>
        {step === "speak" && line && (
          <div className={styles.script}>
            <small>{line.title}</small>
            <p>{line.text}</p>
            {!listening && (
              <button type="button" onClick={() => setLine(pickLine(lang, line))}>
                {t("🔀 다른 대본", "🔀 Another one")}
              </button>
            )}
          </div>
        )}

        <div className={styles.meterBox}>
          <div className={styles.liveTop}>
            <VoiceAvatar avatar={avatar} level={live.level} size={64} />
            <div className={styles.liveNote} aria-live="off">
              {liveName ? (
                <>
                  <small>{liveName.octave}</small>
                  <b>{liveName.note}</b>
                </>
              ) : (
                <b className={styles.liveIdle}>{listening ? "…" : "♪"}</b>
              )}
            </div>
            {step !== "speak" && (
              <div className={styles.record}>
                <small>{t("기록", "Record")}</small>
                <b>{recName ?? "—"}</b>
              </div>
            )}
          </div>
          <Piano
            lang={lang}
            live={live.m}
            low={step === "low" && live.record !== null ? live.record : undefined}
            high={step === "high" && live.record !== null ? live.record : undefined}
            speak={step === "speak" ? undefined : doneSpeak}
          />
          {step !== "speak" && (
            <Ladder
              mode={step}
              gender={gender}
              record={live.record ?? (step === "low" ? card?.low : card?.high) ?? null}
              live={live.m}
              flash={listening ? flash : null}
            />
          )}
          {listening && (
            <div className={styles.timer} aria-hidden="true">
              <i style={{ width: `${Math.min(100, (live.elapsed / MAX_S[step]) * 100)}%` }} />
            </div>
          )}
        </div>
        <p className={styles.tip}>{g.tip}</p>

        {error && <p className={styles.error}>{error}</p>}

        {listening ? (
          <button type="button" className={`${styles.primary} ${styles.rec}`} onClick={stop}>
            {step === "speak" ? t("다 읽었어요", "Done") : t("끝", "Done")}
          </button>
        ) : (
          <button type="button" className={styles.primary} onClick={() => void listen(step)}>
            {t("🎙️ 시작", "🎙️ Start")}
          </button>
        )}
        {!listening && card && (
          <button type="button" className={styles.ghost} onClick={() => setStep(null)}>
            {t("내 결과로 돌아가기", "Back to my result")}
          </button>
        )}
        <p className={styles.note}>{t("녹음 파일은 만들지 않아요. 지금 내는 음만 이 기기에서 읽어요.", "Nothing is recorded or uploaded. We only read the note you're making, on this device.")}</p>
        {toast}
      </main>
    );
  }

  /* --- 결과 ------------------------------------------------------------- */
  if (card) {
    return (
      <main className={`shell ${styles.page}`}>
        <nav className={styles.nav}>
          <Link href="/">{t("← 홈", "← Home")}</Link>
        </nav>
        <RangeCardView card={card} onChallenge={(s) => setStep(s)} />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void share()}>
            {t("내 음역 자랑하기", "Share my range")}
          </button>
          {card.low !== null && card.high !== null && (
            <div className={styles.actionRow}>
              <button type="button" className={styles.secondary} onClick={() => setStep("low")}>
                {t("⬇ 최저음 기록 깨기", "⬇ Beat my low")}
              </button>
              <button type="button" className={styles.secondary} onClick={() => setStep("high")}>
                {t("⬆ 최고음 기록 깨기", "⬆ Beat my high")}
              </button>
            </div>
          )}
          <button type="button" className={styles.ghost} onClick={reset}>
            {t("처음부터 다시 재기", "Start over")}
          </button>
        </div>

        <Link href="/weekly" className={styles.next}>
          <span>
            <b>{t("이 목소리로 이번 주 챌린지 출전", "Enter this week's voice challenge")}</b>
            <small>{t("매주 대본 하나, ❤ 많이 받으면 시상대", "One script a week — most ❤ takes the podium")}</small>
          </span>
          <i aria-hidden="true">→</i>
        </Link>
        <GenderPick gender={gender} onPick={pickGender} />
        <p className={styles.note}>
          {t(
            "음은 실제로 잰 값이에요. 같은 성별 순위는 성인 평균 음높이(남 약 120Hz, 여 약 210Hz)와 견준 대략적인 위치예요.",
            "Notes are measured, not guessed. The ranking compares you with typical adult speaking pitch (about 120Hz for men, 210Hz for women).",
          )}
        </p>
        {toast}
      </main>
    );
  }

  /* --- 첫 화면 ---------------------------------------------------------- */
  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/">{t("← 홈", "← Home")}</Link>
      </nav>
      <header className={styles.head}>
        <p className="eyebrow">MIMIC</p>
        <h1 className={styles.title}>{t("목소리 음역대 테스트", "Vocal range test")}</h1>
        <p className={styles.sub}>
          {t(
            "내 최고음·최저음이 피아노 건반 어디까지인지, 노래방 기준으로 어느 정도인지 알려 줘요. 하고 싶은 것만 골라 재세요.",
            "See where your highest and lowest notes land on a piano and how they rank at karaoke. Pick any one to start.",
          )}
        </p>
      </header>

      <div className={styles.introPiano}>
        <Piano lang={lang} low={45} high={69} speak={50} />
        <p>{t("예시: 최고음 2옥타브 라 🔥 노래방 에이스 · 최저음 0옥타브 라 📻 라디오 DJ", "Example: high A4 🔥 Karaoke Ace · low A2 📻 Radio DJ")}</p>
      </div>

      <GenderPick gender={gender} onPick={pickGender} />
      {/* 셋 중 아무거나 하나만 재도 결과가 나온다. */}
      <div className={styles.picks}>
        {(
          [
            ["high", "⬆", t("최고음 재기", "Highest note"), t("‘아~’ 끝까지 올리기 · 🚿 샤워실 가수 ~ 🐬 돌고래", "Slide ‘ahh’ up · 🚿 Shower Singer to 🐬 Dolphin")],
            ["low", "⬇", t("최저음 재기", "Lowest note"), t("‘음~’ 끝까지 내리기 · 🙂 담백한 저음 ~ 🪨 지하 암반수", "Hum ‘mmm’ down · 🙂 Easygoing Low to 🪨 Bedrock Bass")],
            ["speak", "💬", t("평소 목소리 음 재기", "Speaking note"), t("대본 한 줄 읽기 · 같은 성별 100명 중 몇 번째로 낮은지", "Read one line · how low you are out of 100")],
          ] as const
        ).map(([s, icon, title, sub]) => (
          <button key={s} type="button" onClick={() => setStep(s)}>
            <b aria-hidden="true">{icon}</b>
            <span>
              {title}
              <small>{sub}</small>
            </span>
            <i aria-hidden="true">→</i>
          </button>
        ))}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <p className={styles.note}>{t("하나씩 따로 재도 돼요. 각각 10초면 끝. 녹음 파일은 만들지 않아요.", "Measure one at a time — about 10 seconds each. Nothing is recorded.")}</p>
      {toast}
    </main>
  );
}

/** 등급 사다리 — 기록이 닿은 칸은 칠하고, 지금 내는 음이 닿는 칸엔 표시. 고음은 위로, 저음은 아래로 쌓는다. */
function Ladder({
  mode,
  gender,
  record,
  live,
  flash,
}: {
  mode: "low" | "high";
  gender: Gender;
  record: number | null;
  live: number | null;
  flash: number | null;
}) {
  const lang = useLang();
  const t = useT();
  const rungs = ladder(mode, gender);
  const got = record === null ? -1 : tierOf(mode, record, gender).index;
  const now = live === null ? -1 : tierOf(mode, live, gender).index;
  const rows = rungs.map((r, i) => ({ ...r, i }));
  // 고음은 위가 높은 등급, 저음은 아래가 깊은 등급 — 화면에서도 그 방향으로.
  const ordered = mode === "high" ? [...rows].reverse() : rows;
  return (
    <ol className={styles.ladder}>
      {ordered.map(({ tier, at, i }) => (
        <li
          key={i}
          data-got={i <= got}
          data-now={i === now}
          data-flash={flash === i}
        >
          <span>{tierLabel(tier, lang)}</span>
          <small>{Number.isFinite(at) ? (mode === "high" ? t(`${noteName(at, lang).full}~`, `${noteName(at, lang).full}+`) : t(`${noteName(at, lang).full} 이하`, `≤ ${noteName(at, lang).full}`)) : ""}</small>
        </li>
      ))}
    </ol>
  );
}

function GenderPick({ gender, onPick }: { gender: Gender; onPick: (g: Gender) => void }) {
  const t = useT();
  return (
    <div className={styles.gender} role="radiogroup" aria-label={t("비교 기준", "Compare with")}>
      <span>{t("비교 기준", "Compare with")}</span>
      {(
        [
          ["m", t("남자", "Men")],
          ["f", t("여자", "Women")],
          ["x", t("안 함", "Skip")],
        ] as const
      ).map(([g, label]) => (
        <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => onPick(g)}>
          {label}
        </button>
      ))}
    </div>
  );
}
