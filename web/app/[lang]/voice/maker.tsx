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
import { track } from "@/lib/track";
import { cardQuery, instrumentOf, noteName, readCard, summary, type Gender, type RangeCard } from "@/lib/voice-range";
import { RangeCardView, type Step } from "./card";
import styles from "./voice.module.css";

const GENDER_KEY = "mimic.voice.gender";
const CARD_KEY = "mimic.voice.range";
const ORDER: Step[] = ["speak", "low", "high"];

/** 한 번 재는 상한(초). */
const MAX_S: Record<Step, number> = { speak: 12, low: 15, high: 15 };
/** 이만큼 소리를 낸 뒤 이만큼 조용하면 저절로 끝낸다. */
const AUTO_STOP: Record<Step, { voiced: number; silence: number }> = {
  speak: { voiced: 2, silence: 1.2 },
  low: { voiced: 1, silence: 2.5 },
  high: { voiced: 1, silence: 2.5 },
};

type Live = { m: number | null; level: number; record: number | null; elapsed: number };

function readSaved(): RangeCard | null {
  try {
    const raw = localStorage.getItem(CARD_KEY);
    return raw ? readCard(new URLSearchParams(raw)) : null;
  } catch {
    return null;
  }
}

/**
 * 목소리 음역대 테스트 — 1부터 10까지 세기(평소 음) → "음~" 끝까지 내리기(최저음) → "아~" 끝까지 올리기(최고음).
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
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(location.origin);
    try {
      const g = localStorage.getItem(GENDER_KEY);
      if (g === "m" || g === "f" || g === "x") setGender(g);
    } catch {}
    const saved = readSaved();
    if (saved) setCard(saved);
  }, []);

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
        setError(t("목소리가 잘 안 들렸어요. 조용한 곳에서 평소처럼 세어 주세요.", "We couldn't hear enough. Count in your normal voice somewhere quiet."));
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
    // 잰 값을 남긴다 — 악기 경계·평균 음높이를 실제 사용자 분포로 다시 맞추는 데 쓴다. via 는 16자라 값은 meme_id 칸에.
    track("voice_card_done", { via: s, meme_id: cardQuery({ ...next, avatar: "" }) });
    const i = ORDER.indexOf(s);
    // 처음 재는 길이면 다음 칸으로, 기록 깨기였으면 결과로.
    const nextStep = ORDER.slice(i + 1).find((x) => (x === "low" ? next.low : x === "high" ? next.high : next.speak) === null);
    setStep(nextStep ?? null);
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
      if (s !== "speak" && n % 6 === 0) record = stableExtreme(frames, s);
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
    const inst = s.instrument ? t(s.instrument.ko, s.instrument.en) : "";
    const text =
      s.range !== null
        ? t(`내 목소리 음역 ${s.range}옥타브 (${s.sub}) 나옴. 너는 몇 옥타브?`, `My vocal range: ${s.range} octaves (${s.sub}). How many do you have?`)
        : t(`평소 내 목소리 음은 ${s.headline}, 악기로 치면 ${inst}래. 너는?`, `My speaking note is ${s.headline} — that's a ${inst}. What's yours?`);
    track("voice_card_share", { via: s.instrument?.key ?? "range" });
    try {
      if (image && navigator.canShare?.({ files: [image] })) {
        await navigator.share({ files: [image], text: `${text}\n${shareUrl}` });
        return;
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
    }
    const r = await shareLink(shareUrl, text);
    if (r === "copied") showToast(t("링크를 복사했어요. 단톡방에 붙여 넣어 보세요!", "Link copied. Paste it in your group chat!"));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast(t("링크를 복사했어요", "Link copied"));
    } catch {
      showToast(t("복사가 안 됐어요", "Couldn't copy"));
    }
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
    const i = ORDER.indexOf(step);
    const liveName = live.m !== null ? noteName(live.m, lang) : null;
    const recName = live.record !== null ? noteName(live.record, lang).full : null;
    const doneSpeak = card?.speak ?? null;
    const guide: Record<Step, { title: string; how: string; tip: string }> = {
      speak: {
        title: t("평소 목소리", "Speaking voice"),
        how: t("1부터 10까지 평소처럼 세어 주세요", "Count from 1 to 10 in your normal voice"),
        tip: t("다 세고 잠깐 조용히 있으면 저절로 끝나요", "Stop when you're done — it ends by itself"),
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
          <ol className={styles.dots} aria-label={t(`${i + 1}/3 단계`, `Step ${i + 1} of 3`)}>
            {ORDER.map((x, k) => (
              <li key={x} data-on={k <= i} />
            ))}
          </ol>
        </nav>

        {step !== "speak" && doneSpeak !== null && !listening && (
          <p className={styles.prevResult}>
            {t("평소 목소리", "Speaking")} <b>{noteName(doneSpeak, lang).full}</b> · {instrumentOf(doneSpeak).emoji}{" "}
            {t(instrumentOf(doneSpeak).ko, instrumentOf(doneSpeak).en)}
          </p>
        )}

        <p className="eyebrow">{t(`${i + 1}/3 · ${g.title}`, `${i + 1}/3 · ${g.title}`)}</p>
        <h1 className={styles.how}>{g.how}</h1>
        {step === "speak" && (
          <p className={styles.count} aria-hidden="true">
            {Array.from({ length: 10 }, (_, k) => (
              <span key={k}>{k + 1}</span>
            ))}
          </p>
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
            {step === "speak" ? t("다 셌어요", "Done") : t("끝", "Done")}
          </button>
        ) : (
          <button type="button" className={styles.primary} onClick={() => void listen(step)}>
            {t("🎙️ 시작", "🎙️ Start")}
          </button>
        )}
        {!listening && card?.speak != null && (
          <button type="button" className={styles.ghost} onClick={() => setStep(null)}>
            {t("결과 먼저 보기", "See my result")}
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
          <div className={styles.actionRow}>
            {storyUrl && (
              <a className={styles.secondary} href={storyUrl} download="mimic-vocal-range.png" onClick={() => track("voice_card_share", { via: "save" })}>
                {t("스토리용 이미지 저장", "Save story image")}
              </a>
            )}
            <button type="button" className={styles.secondary} onClick={() => void copyLink()}>
              {t("링크 복사", "Copy link")}
            </button>
          </div>
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
        <p className="eyebrow">{t("목소리 음역대 테스트", "Vocal range test")}</p>
        <h1 className={styles.title}>{t("내 목소리는 몇 옥타브?", "How many octaves is your voice?")}</h1>
        <p className={styles.sub}>
          {t(
            "평소 목소리 · 가장 낮은 음 · 가장 높은 음. 세 번 소리 내면 건반 위에 내 음역이 나와요.",
            "Your speaking voice, your lowest note, your highest note. Three sounds and your range lights up on a keyboard.",
          )}
        </p>
      </header>

      <div className={styles.introPiano}>
        <Piano lang={lang} low={45} high={69} speak={50} />
        <p>{t("예시: 0옥타브 라 ~ 2옥타브 라 · 2옥타브", "Example: A2 – A4 · 2 octaves")}</p>
      </div>

      <ol className={styles.steps}>
        <li>
          <b>1</b>
          <span>
            {t("1부터 10까지 세기", "Count 1 to 10")}
            <small>{t("평소 내 목소리 음과 어울리는 악기", "Your speaking note and your instrument")}</small>
          </span>
        </li>
        <li>
          <b>2</b>
          <span>
            {t("‘음~’ 끝까지 내리기", "Hum down as low as you can")}
            <small>{t("내가 낼 수 있는 가장 낮은 음", "Your lowest note")}</small>
          </span>
        </li>
        <li>
          <b>3</b>
          <span>
            {t("‘아~’ 끝까지 올리기", "Slide up as high as you can")}
            <small>{t("노래방 고음 기준과 비교", "Compared with the karaoke high-note bar")}</small>
          </span>
        </li>
      </ol>

      <GenderPick gender={gender} onPick={pickGender} />
      {error && <p className={styles.error}>{error}</p>}
      <button type="button" className={styles.primary} onClick={() => setStep("speak")}>
        {t("시작하기 · 30초", "Start · 30 seconds")}
      </button>
      <p className={styles.note}>{t("녹음 파일은 만들지 않아요. 노래 실력 점수가 아니라 내 목소리 지도예요.", "Nothing is recorded. It's not a singing score — it's a map of your voice.")}</p>
      {toast}
    </main>
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
