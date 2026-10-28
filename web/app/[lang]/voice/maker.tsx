"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceAvatar } from "@/components/voice-avatar";
import { useViewer } from "@/components/viewer";
import { useToast } from "@/components/weekly/toast";
import { buzz, shareLink } from "@/components/weekly/use-weekly";
import { useLang, useT } from "@/components/lang";
import { DEFAULT_AVATAR, encodeAvatar } from "@/lib/avatar";
import { track } from "@/lib/track";
import { analyzeBlob } from "@/lib/voice-analysis";
import { cardQuery, READ_LINE, ROLES, SEALS, verdict, type CardData, type Gender } from "@/lib/voice-card";
import { Seal, VoiceCard } from "./card";
import styles from "./voice.module.css";

/** 녹음 상한 — 문장은 8~12초면 읽는다. */
const MAX_MS = 18_000;
/** 이보다 짧으면 음높이를 믿을 수 없다. */
const MIN_SPAN_S = 2.5;
/** 판정 연출 최소 시간 — 도장이 돌아가는 맛이 있어야 한다. */
const REVEAL_MS = 1_600;

type Phase = "ready" | "recording" | "analyzing" | "done";

const GENDER_KEY = "mimic.voice.gender";

/**
 * 보이스 카드 만들기 — 사극 한 줄 읽기 → 브라우저에서 측정 → 16역 중 하나로 판정.
 *
 * 녹음은 어디에도 올리지 않는다. 숫자 몇 개만 남고 그것도 공유할 때 링크에만 담긴다.
 * 로그인도 서버도 필요 없다 — 인스타에서 보고 들어온 사람이 10초 만에 결과를 받는 입구다.
 */
export default function Maker() {
  const t = useT();
  const lang = useLang();
  const viewer = useViewer();
  const avatar = viewer?.avatar ?? DEFAULT_AVATAR;
  const line = READ_LINE[lang];
  const [phase, setPhase] = useState<Phase>("ready");
  const [gender, setGender] = useState<Gender>("x");
  const [level, setLevel] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [spin, setSpin] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<CardData | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [origin, setOrigin] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const ctx = useRef<AudioContext | null>(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(location.origin);
    try {
      const g = localStorage.getItem(GENDER_KEY);
      if (g === "m" || g === "f" || g === "x") setGender(g);
    } catch {}
  }, []);

  const pickGender = (g: Gender) => {
    setGender(g);
    try {
      localStorage.setItem(GENDER_KEY, g);
    } catch {}
  };

  const release = useCallback(() => {
    stream.current?.getTracks().forEach((x) => x.stop());
    stream.current = null;
    void ctx.current?.close().catch(() => {});
    ctx.current = null;
  }, []);

  useEffect(() => () => release(), [release]);

  // 판정 중엔 도장이 슬롯머신처럼 돈다.
  useEffect(() => {
    if (phase !== "analyzing") return;
    const id = window.setInterval(() => setSpin((n) => n + 1), 90);
    return () => window.clearInterval(id);
  }, [phase]);

  const finish = async (blob: Blob) => {
    setPhase("analyzing");
    const t0 = performance.now();
    try {
      const a = await analyzeBlob(blob, line.syllables);
      if (a.span < MIN_SPAN_S || a.pitchHz === null || a.pitchRange === null) {
        setPhase("ready");
        setError(
          t(
            "목소리가 잘 안 들렸어요. 조용한 곳에서 문장을 끝까지 읽어 주세요.",
            "We couldn't hear enough. Read the whole line somewhere quiet.",
          ),
        );
        return;
      }
      const next: CardData = {
        hz: a.pitchHz,
        st: a.pitchRange,
        pace: a.pace,
        end: a.endDrop,
        gender,
        lang,
        avatar: encodeAvatar(avatar),
      };
      const wait = REVEAL_MS - (performance.now() - t0);
      if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      setCard(next);
      setPhase("done");
      buzz(40);
      track("voice_card_done", { via: verdict(next).key });
    } catch {
      setPhase("ready");
      setError(t("분석하다 문제가 생겼어요. 한 번 더 해 볼까요?", "Something went wrong while analyzing. Try again?"));
    }
  };

  const start = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(t("이 브라우저는 녹음을 지원하지 않아요. 크롬이나 사파리로 열어 주세요", "This browser can't record. Open in Chrome or Safari"));
      return;
    }
    setError(null);
    let live: MediaStream;
    try {
      // 음높이·억양 폭·말끝을 재는 게 목적이라 자동 음량 보정은 끈다.
      live = await navigator.mediaDevices.getUserMedia({
        audio: { autoGainControl: false, noiseSuppression: false, echoCancellation: true },
      });
    } catch {
      setError(t("마이크를 허용해야 녹음할 수 있어요 🎙️", "Allow the mic to record 🎙️"));
      return;
    }
    stream.current = live;
    let analyser: AnalyserNode | null = null;
    try {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        const c = new Ctor();
        analyser = c.createAnalyser();
        analyser.fftSize = 1024;
        c.createMediaStreamSource(live).connect(analyser);
        ctx.current = c;
      }
    } catch {
      analyser = null;
    }

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(live);
    recorder.current = rec;
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    rec.onstop = () => {
      release();
      setLevel(0);
      const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
      if (blob.size === 0) {
        setPhase("ready");
        setError(t("소리가 안 잡혔어요. 다시 해 볼까요?", "We couldn't hear you. Try again?"));
        return;
      }
      void finish(blob);
    };
    rec.start();
    setPhase("recording");
    track("voice_card_start", { via: `${lang}-${gender}` });

    const t0 = performance.now();
    const buf = new Uint8Array(analyser?.fftSize ?? 1024);
    let smooth = 0;
    const loop = () => {
      if (rec.state === "inactive") return;
      const ms = performance.now() - t0;
      setElapsed(ms);
      if (analyser) {
        analyser.getByteTimeDomainData(buf);
        let s = 0;
        for (let i = 0; i < buf.length; i += 1) {
          const v = (buf[i] - 128) / 128;
          s += v * v;
        }
        smooth = smooth * 0.7 + Math.min(1, Math.sqrt(s / buf.length) * 4) * 0.3;
        setLevel(smooth);
      }
      if (ms >= MAX_MS) rec.stop();
      else requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  const stop = () => {
    const rec = recorder.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  const query = card ? cardQuery(card) : "";
  const shareUrl = card && origin ? `${origin}/voice/c?${query}` : "";
  const storyUrl = card ? `/api/og/voice?${query}&fmt=story&ui=${lang}` : "";

  // 공유 시트는 누른 그 순간에만 열린다(사파리). 이미지를 누른 뒤에 받으면 늦으니 미리 받아 둔다.
  useEffect(() => {
    if (!storyUrl) return;
    let alive = true;
    fetch(storyUrl)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => {
        if (alive && b) setImage(new File([b], "mimic-voice-card.png", { type: "image/png" }));
      })
      .catch(() => {});
    return () => {
      alive = false;
      setImage(null);
    };
  }, [storyUrl]);

  const share = async () => {
    if (!card) return;
    const role = verdict(card).role;
    const text = t(`내 목소리 사극 판정: 「${role.ko}」 역 나옴ㅋㅋ 너는 무슨 역?`, `My voice got cast as ${role.en} lol. What role do you get?`);
    track("voice_card_share", { via: verdict(card).key });
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

  if (phase === "done" && card) {
    return (
      <main className={`shell ${styles.page}`}>
        <VoiceCard card={card} stamp />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void share()}>
            {t("내 판정 자랑하기", "Share my role")}
          </button>
          <div className={styles.actionRow}>
            {storyUrl && (
              <a
                className={styles.secondary}
                href={storyUrl}
                download="mimic-voice-card.png"
                onClick={() => track("voice_card_share", { via: "save" })}
              >
                {t("스토리용 이미지 저장", "Save story image")}
              </a>
            )}
            <button type="button" className={styles.secondary} onClick={() => void copyLink()}>
              {t("링크 복사", "Copy link")}
            </button>
          </div>
          <button
            type="button"
            className={styles.ghost}
            onClick={() => {
              setCard(null);
              setPhase("ready");
            }}
          >
            {t("다른 톤으로 다시 판정받기", "Try again in a different tone")}
          </button>
        </div>

        <Link href="/weekly" className={styles.next}>
          <span>
            <b>{t("이 목소리로 이번 주 챌린지 출전", "Enter this week's voice challenge")}</b>
            <small>{t("매주 대본 하나, ❤ 많이 받으면 시상대", "One script a week — most ❤ takes the podium")}</small>
          </span>
          <i aria-hidden="true">→</i>
        </Link>

        <p className={styles.note}>
          {t(
            "음높이·억양 폭·말 속도·말끝 힘을 재서 16역 중 하나로 나눠요. 재미로 보는 판정이고 목소리의 좋고 나쁨을 매기는 점수가 아니에요. 녹음은 이 기기 밖으로 나가지 않아요.",
            "We measure pitch, range, pace and how you end sentences, then sort you into one of 16 roles. It's for fun — not a grade of your voice. The recording never leaves this device.",
          )}
        </p>
        {toast}
      </main>
    );
  }

  const seals = [...SEALS];
  return (
    <main className={`shell ${styles.page}`}>
      <nav className={styles.nav}>
        <Link href="/">{t("← 홈", "← Home")}</Link>
      </nav>
      <header className={styles.head}>
        <p className="eyebrow">{t("목소리 사극 판정", "Voice casting")}</p>
        <h1 className={styles.title}>{t("내 목소리, 사극에선 무슨 역?", "What role would your voice play?")}</h1>
        <p className={styles.sub}>
          {t(
            "왕·간신·망나니·삐에로… 16역 중 하나로 판정해 드려요. 대사 한 줄이면 10초.",
            "King, Schemer, Executioner, Jester… we cast you as one of 16 roles. One line, 10 seconds.",
          )}
        </p>
      </header>

      <div className={styles.marquee} aria-hidden="true">
        <div>
          {[...seals, ...seals].map((c, i) => (
            <Seal key={i} char={c} size={40} />
          ))}
        </div>
      </div>

      <div className={styles.stage}>
        {phase === "analyzing" ? (
          <div className={styles.spin}>
            <Seal char={seals[spin % seals.length]} size={120} />
            <p>{t("판정 중…", "Casting…")}</p>
          </div>
        ) : (
          <>
            <VoiceAvatar avatar={avatar} level={level} size={130} />
            <p className={styles.lineTip}>
              {phase === "recording"
                ? t("크게, 사극 톤으로!", "Loud, like a royal drama!")
                : t("이 대사를 소리 내어 읽어 주세요", "Read this line out loud")}
            </p>
            <p className={styles.line}>{line.text}</p>
            {phase === "recording" && (
              <div className={styles.meter} aria-hidden="true">
                <i style={{ width: `${Math.min(100, (elapsed / MAX_MS) * 100)}%` }} />
              </div>
            )}
          </>
        )}
      </div>

      {phase === "ready" && (
        <div className={styles.gender} role="radiogroup" aria-label={t("목소리 기준", "Voice baseline")}>
          <span>{t("음높이 기준", "Pitch baseline")}</span>
          {(
            [
              ["m", t("남자 목소리", "Male voice")],
              ["f", t("여자 목소리", "Female voice")],
              ["x", t("상관없음", "Skip")],
            ] as const
          ).map(([g, label]) => (
            <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => pickGender(g)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      {phase === "ready" && (
        <button type="button" className={styles.primary} onClick={() => void start()}>
          {t("🎙️ 판정 받기", "🎙️ Get cast")}
        </button>
      )}
      {phase === "recording" && (
        <button type="button" className={`${styles.primary} ${styles.rec}`} onClick={stop}>
          {t("다 읽었어요", "Done")}
        </button>
      )}
      <p className={styles.note}>
        {t(
          "녹음은 서버로 보내지 않고 이 기기에서만 분석해요. 음높이 기준은 같은 성별 안에서 높고 낮음을 보기 위한 거예요.",
          "Your recording is analyzed on this device and never uploaded. The baseline just compares your pitch within a voice group.",
        )}
      </p>
      <p className={styles.roster}>
        {Object.values(ROLES)
          .map((r) => t(r.ko, r.en))
          .join(" · ")}
      </p>
      {toast}
    </main>
  );
}
