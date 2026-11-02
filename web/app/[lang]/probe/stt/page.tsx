"use client";

import { useRef, useState } from "react";
import { analyzeBlob } from "@/lib/voice-analysis";

/**
 * 폰 자체 음성인식 시험 — 대본 확인을 서버 받아쓰기 대신 무료로 할 수 있나.
 *
 * 크롬·사파리의 SpeechRecognition 은 비용이 0 이지만, 녹음(MediaRecorder)과 마이크를 동시에 쓸 때
 * 기기에 따라 녹음이 무음이 되거나 인식이 안 켜진다. 그걸 실제 폰(안드로이드 크롬·아이폰 사파리·카톡 인앱)에서
 * 확인하는 페이지다. 결과는 화면에만 — 아무것도 서버로 보내지 않는다.
 */

type SR = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

const SAMPLE = "시청자 여러분, 안녕하십니까. 저녁 뉴스입니다.";

export default function SttProbe() {
  const [state, setState] = useState<"idle" | "rec" | "done">("idle");
  const [heard, setHeard] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [rec, setRec] = useState<{ url: string; peak: number; span: number } | null>(null);
  const srRef = useRef<SR | null>(null);
  const mrRef = useRef<MediaRecorder | null>(null);
  const finals = useRef<string[]>([]);
  const add = (s: string) => setLog((l) => [...l, s]);

  const Ctor =
    typeof window === "undefined"
      ? undefined
      : ((window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }).SpeechRecognition ??
        (window as unknown as { webkitSpeechRecognition?: new () => SR }).webkitSpeechRecognition);

  const start = async () => {
    setLog([navigator.userAgent]);
    setHeard("");
    setRec(null);
    finals.current = [];
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      add("✅ 마이크 열림");
    } catch (e) {
      add(`❌ 마이크 실패: ${String(e)}`);
      return;
    }
    const chunks: Blob[] = [];
    const mr = new MediaRecorder(stream);
    mrRef.current = mr;
    mr.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mr.mimeType || "audio/webm" });
      try {
        const a = await analyzeBlob(blob, null);
        setRec({ url: URL.createObjectURL(blob), peak: a.peakDb, span: a.span });
        add(a.peakDb > -40 ? `✅ 녹음에 소리 있음 (최대 ${a.peakDb.toFixed(0)}dB, ${a.span.toFixed(1)}초)` : `❌ 녹음이 거의 무음 (최대 ${a.peakDb.toFixed(0)}dB)`);
      } catch (e) {
        add(`❌ 녹음 분석 실패: ${String(e)}`);
      }
    };
    mr.start();
    add("✅ 녹음 시작");

    if (!Ctor) {
      add("❌ 이 브라우저엔 음성인식(SpeechRecognition)이 없어요");
    } else {
      const sr = new Ctor();
      srRef.current = sr;
      sr.lang = "ko-KR";
      sr.continuous = true;
      sr.interimResults = true;
      sr.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const r = e.results[i];
          if (r.isFinal) finals.current.push(r[0].transcript);
          else interim += r[0].transcript;
        }
        setHeard(`${finals.current.join(" ")} ${interim}`.trim());
      };
      sr.onerror = (e) => add(`❌ 음성인식 오류: ${e.error}`);
      sr.onend = () => add("ℹ️ 음성인식 끝남");
      try {
        sr.start();
        add("✅ 음성인식 시작");
      } catch (e) {
        add(`❌ 음성인식 시작 실패: ${String(e)}`);
      }
    }
    setState("rec");
  };

  const stop = () => {
    srRef.current?.stop();
    mrRef.current?.stop();
    setState("done");
  };

  return (
    <main className="shell" style={{ padding: "24px 16px", display: "grid", gap: 14 }}>
      <h1 style={{ margin: 0, fontSize: 22 }}>폰 음성인식 시험</h1>
      <p style={{ margin: 0, color: "var(--ash)", fontSize: 14 }}>
        버튼을 누르고 아래 문장을 읽은 뒤 멈추세요. 녹음과 음성인식이 <b>동시에</b> 되는지 봐요. 아무것도 서버로 보내지 않아요.
      </p>
      <p style={{ margin: 0, padding: 12, borderRadius: 12, background: "var(--panel)", fontSize: 17, fontWeight: 700 }}>{SAMPLE}</p>
      {state === "rec" ? (
        <button type="button" onClick={stop} style={btn("var(--pink)")}>
          ■ 멈추기
        </button>
      ) : (
        <button type="button" onClick={() => void start()} style={btn("var(--volt)")}>
          ● 시작
        </button>
      )}
      <section style={{ padding: 12, borderRadius: 12, background: "var(--panel)" }}>
        <small style={{ color: "var(--ash)" }}>들린 말</small>
        <p style={{ margin: "4px 0 0", fontSize: 16, minHeight: 24 }}>{heard || "—"}</p>
      </section>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 14, lineHeight: 1.7 }}>
        {log.map((l, i) => (
          <li key={i}>{l}</li>
        ))}
      </ul>
      {rec && <audio controls src={rec.url} />}
    </main>
  );
}

function btn(bg: string): React.CSSProperties {
  return { minHeight: 52, border: 0, borderRadius: 999, background: bg, color: "var(--on-accent)", fontSize: 17, fontWeight: 800 };
}
