"use client";

import Link from "next/link";
import { useCallback, useState, useSyncExternalStore } from "react";
import styles from "./probe.module.css";

/**
 * V1 검증 페이지 — 이슈 #13.
 *
 * 목적: 카카오톡 인앱 브라우저에서 getUserMedia() 가 실제로 열리는지 확인한다.
 * 웹 전환의 바이럴 루프 전체가 이 한 가지에 걸려 있고, 막히면 전략을 다시 봐야 한다.
 *
 * 덤으로 MediaRecorder 가 내보내는 실제 mimeType 과 샘플레이트도 같이 수집한다.
 * 그게 #15(웹 녹음 포맷 → 채점 재검증)의 입력값이다.
 */

const RECORD_MS = 2500;

/** 채점 서버가 받게 될 후보 포맷들. 브라우저마다 지원이 다르다. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/wav",
];

type Env = {
  ua: string;
  inApp: string | null;
  isKakao: boolean;
  secure: boolean;
  hasGetUserMedia: boolean;
  hasMediaRecorder: boolean;
  mimes: { type: string; supported: boolean }[];
};

type Result = {
  ok: boolean;
  stage: string;
  errorName?: string;
  errorMessage?: string;
  mimeType?: string;
  bytes?: number;
  sampleRate?: number;
  channelCount?: number;
};

function detectInApp(ua: string): { label: string | null; isKakao: boolean } {
  if (/KAKAOTALK/i.test(ua)) return { label: "카카오톡", isKakao: true };
  if (/Instagram/i.test(ua)) return { label: "인스타그램", isKakao: false };
  if (/FBAN|FBAV/i.test(ua)) return { label: "페이스북", isKakao: false };
  if (/NAVER\(inapp/i.test(ua)) return { label: "네이버 앱", isKakao: false };
  if (/Line\//i.test(ua)) return { label: "라인", isKakao: false };
  if (/DaumApps/i.test(ua)) return { label: "다음 앱", isKakao: false };
  return { label: null, isKakao: false };
}

/**
 * 환경 정보는 브라우저에만 존재하고 이후 바뀌지 않는다.
 * 서버 렌더에서는 null 을 주고, 클라이언트에서 한 번만 계산해 캐시한다.
 * (useSyncExternalStore 는 Object.is 로 비교하므로 반드시 같은 객체를 돌려줘야 한다)
 */
let cachedEnv: Env | null = null;

function readEnv(): Env {
  if (cachedEnv) return cachedEnv;

  const ua = navigator.userAgent;
  const { label, isKakao } = detectInApp(ua);
  const hasMediaRecorder = typeof MediaRecorder !== "undefined";

  cachedEnv = {
    ua,
    inApp: label,
    isKakao,
    secure: window.isSecureContext,
    hasGetUserMedia: Boolean(navigator.mediaDevices?.getUserMedia),
    hasMediaRecorder,
    mimes: MIME_CANDIDATES.map((type) => ({
      type,
      supported: hasMediaRecorder && MediaRecorder.isTypeSupported(type),
    })),
  };
  return cachedEnv;
}

/** 값이 변하지 않으므로 구독은 비어 있다. */
const subscribeEnv = () => () => {};
const serverEnv = () => null;

export default function ProbePage() {
  const env = useSyncExternalStore(subscribeEnv, readEnv, serverEnv);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  const runTest = useCallback(async () => {
    setRunning(true);
    setResult(null);
    setCopied(false);

    // 1단계 — API 자체가 있는지. 인앱 웹뷰에서는 여기서 먼저 막히는 경우가 있다.
    if (!navigator.mediaDevices?.getUserMedia) {
      setResult({
        ok: false,
        stage: "getUserMedia 없음",
        errorMessage: window.isSecureContext
          ? "이 브라우저에 mediaDevices API 자체가 없습니다."
          : "보안 컨텍스트(HTTPS)가 아니어서 API가 노출되지 않았습니다.",
      });
      setRunning(false);
      return;
    }

    let stream: MediaStream | null = null;
    try {
      // 2단계 — 권한 요청. 인앱 웹뷰가 차단하면 여기서 예외가 난다.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      const err = e as DOMException;
      setResult({
        ok: false,
        stage: "마이크 권한 거부/차단",
        errorName: err.name,
        errorMessage: err.message,
      });
      setRunning(false);
      return;
    }

    const settings = stream.getAudioTracks()[0]?.getSettings() ?? {};

    if (typeof MediaRecorder === "undefined") {
      stream.getTracks().forEach((t) => t.stop());
      setResult({
        ok: false,
        stage: "MediaRecorder 없음",
        errorMessage: "마이크는 열렸지만 녹음 API가 없습니다.",
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
      });
      setRunning(false);
      return;
    }

    // 3단계 — 실제로 소리가 담기는지. 권한만 통과하고 빈 버퍼가 오는 웹뷰도 있다.
    try {
      const chunks: Blob[] = [];
      const rec = new MediaRecorder(stream);

      await new Promise<void>((resolve) => {
        rec.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunks.push(ev.data);
        };
        rec.onstop = () => resolve();
        rec.start();
        setTimeout(() => rec.state !== "inactive" && rec.stop(), RECORD_MS);
      });

      const blob = new Blob(chunks, { type: rec.mimeType });
      setResult({
        ok: blob.size > 0,
        stage: blob.size > 0 ? "정상" : "빈 녹음",
        mimeType: rec.mimeType || "(비어 있음)",
        bytes: blob.size,
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
        errorMessage:
          blob.size > 0
            ? undefined
            : "권한은 통과했지만 오디오 데이터가 들어오지 않았습니다.",
      });
    } catch (e) {
      const err = e as Error;
      setResult({
        ok: false,
        stage: "녹음 실패",
        errorName: err.name,
        errorMessage: err.message,
        sampleRate: settings.sampleRate,
        channelCount: settings.channelCount,
      });
    } finally {
      stream.getTracks().forEach((t) => t.stop());
      setRunning(false);
    }
  }, []);

  /** 이슈 #13 에 그대로 붙여넣을 수 있는 형태로 만든다. */
  const report = useCallback(() => {
    if (!env) return "";
    const lines = [
      "### 마이크 검사 결과",
      "",
      `- 결과: **${result ? (result.ok ? "통과" : "실패") : "미실행"}**`,
      `- 단계: ${result?.stage ?? "-"}`,
      `- 인앱 브라우저: ${env.inApp ?? "아님 (일반 브라우저)"}`,
      `- 보안 컨텍스트: ${env.secure}`,
      `- getUserMedia: ${env.hasGetUserMedia}`,
      `- MediaRecorder: ${env.hasMediaRecorder}`,
    ];
    if (result?.errorName) lines.push(`- 오류: \`${result.errorName}\``);
    if (result?.errorMessage) lines.push(`- 메시지: ${result.errorMessage}`);
    if (result?.mimeType) lines.push(`- mimeType: \`${result.mimeType}\``);
    if (result?.bytes !== undefined) lines.push(`- 크기: ${result.bytes} bytes`);
    if (result?.sampleRate) lines.push(`- 샘플레이트: ${result.sampleRate} Hz`);
    if (result?.channelCount) lines.push(`- 채널: ${result.channelCount}`);
    lines.push(
      `- 지원 포맷: ${env.mimes.filter((m) => m.supported).map((m) => m.type).join(", ") || "없음"}`,
      "",
      "<details><summary>User-Agent</summary>",
      "",
      "```",
      env.ua,
      "```",
      "",
      "</details>",
    );
    return lines.join("\n");
  }, [env, result]);

  const copyReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(report());
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [report]);

  const openExternal = useCallback(() => {
    // 카카오톡 인앱 브라우저는 이 스킴으로 기본 브라우저를 연다.
    window.location.href =
      "kakaotalk://web/openExternal?url=" + encodeURIComponent(window.location.href);
  }, []);

  return (
    <main className="shell">
      <header className={styles.head}>
        <span className="eyebrow">V1 · 이슈 #13</span>
        <h1 className={styles.title}>마이크 검사</h1>
        <p className={styles.sub}>
          이 브라우저에서 녹음이 가능한지 확인합니다. <strong>카카오톡으로 이 링크를
          보내고, 카톡 안에서 열어서</strong> 실행해 주세요.
        </p>
      </header>

      {env && (
        <div className={styles.rows}>
          <div className={styles.row}>
            <span className={styles.rowLabel}>실행 환경</span>
            <span
              className={`${styles.rowValue} ${env.inApp ? styles.warn : styles.dim}`}
            >
              {env.inApp ? `${env.inApp} 인앱` : "일반 브라우저"}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>보안 컨텍스트 (HTTPS)</span>
            <span
              className={`${styles.rowValue} ${env.secure ? styles.ok : styles.bad}`}
            >
              {env.secure ? "확보" : "없음"}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>getUserMedia API</span>
            <span
              className={`${styles.rowValue} ${
                env.hasGetUserMedia ? styles.ok : styles.bad
              }`}
            >
              {env.hasGetUserMedia ? "있음" : "없음"}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>MediaRecorder API</span>
            <span
              className={`${styles.rowValue} ${
                env.hasMediaRecorder ? styles.ok : styles.bad
              }`}
            >
              {env.hasMediaRecorder ? "있음" : "없음"}
            </span>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>지원 녹음 포맷</span>
            <span className={`${styles.rowValue} ${styles.dim}`}>
              {env.mimes.filter((m) => m.supported).length}개
            </span>
            <div className={styles.mimeList}>
              {env.mimes.map((m) => (
                <span
                  key={m.type}
                  className={`${styles.mime} ${m.supported ? styles.mimeOk : ""}`}
                >
                  {m.supported ? "✓" : "✗"} {m.type}
                </span>
              ))}
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowLabel}>User-Agent</span>
            <span className={`${styles.rowValue} ${styles.dim}`}>&nbsp;</span>
            <p className={styles.ua}>{env.ua}</p>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        <button
          className={styles.primary}
          onClick={runTest}
          disabled={running || !env}
        >
          {running ? `녹음 중… ${RECORD_MS / 1000}초` : "마이크 열고 2.5초 녹음"}
        </button>
        {env?.isKakao && (
          <button className={styles.secondary} onClick={openExternal}>
            외부 브라우저로 열기
          </button>
        )}
      </div>

      {result && (
        <section
          className={`${styles.verdict} ${
            result.ok ? styles.verdictPass : styles.verdictFail
          }`}
        >
          <h2 className={styles.verdictTitle}>
            {result.ok ? "통과 — 녹음됩니다" : `실패 — ${result.stage}`}
          </h2>
          <p className={styles.verdictBody}>
            {result.ok
              ? "이 환경에서는 웹 녹음이 정상 동작합니다. 이 조합의 결과를 이슈 #13에 기록해 주세요."
              : "이 환경에서는 웹 녹음을 할 수 없습니다. 카카오톡 인앱이라면 외부 브라우저 유도가 필수가 됩니다."}
          </p>

          <div className={styles.detail}>
            {[
              `단계        ${result.stage}`,
              result.errorName && `오류        ${result.errorName}`,
              result.errorMessage && `메시지      ${result.errorMessage}`,
              result.mimeType && `mimeType    ${result.mimeType}`,
              result.bytes !== undefined && `크기        ${result.bytes} bytes`,
              result.sampleRate && `샘플레이트  ${result.sampleRate} Hz`,
              result.channelCount && `채널        ${result.channelCount}`,
            ]
              .filter(Boolean)
              .join("\n")}
          </div>

          <div className={styles.actions}>
            <button className={styles.secondary} onClick={copyReport}>
              {copied ? "복사됨 ✓" : "결과 복사 (이슈 #13용)"}
            </button>
          </div>
        </section>
      )}

      <p className={styles.note}>
        이 페이지는 검증용입니다. 녹음 데이터는 어디에도 전송되지 않고, 측정이 끝나면
        즉시 폐기됩니다. 여기서 수집되는 mimeType·샘플레이트는 이슈 #15(웹 녹음 포맷
        채점 재검증)의 입력값으로도 씁니다.
      </p>

      <Link href="/" className={styles.back}>
        ← 홈으로
      </Link>
    </main>
  );
}
