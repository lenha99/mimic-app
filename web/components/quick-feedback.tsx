"use client";

import { useEffect, useState } from "react";
import { clientId } from "@/lib/client-id";
import styles from "./quick-feedback.module.css";

/**
 * 결과 화면 맨 아래 한 줄 — "이거 어땠어요?" 👍 / 👎, 누르면 한 줄 칸이 열린다.
 *
 * 오픈채팅에 "피드백 주세요"라고 해도 아무도 안 쓴다. 글을 남기는 건 부담이고, 남들 앞이다.
 * 버튼 하나는 누른다. 한 번 남긴 화면(같은 항목)에선 다시 묻지 않는다.
 */
type Page = "record" | "practice" | "board";
const KEY = "mimic.feedback.done";

export function QuickFeedback({ page, item }: { page: Page; item?: string }) {
  const [state, setState] = useState<"hidden" | "ask" | "write" | "sent">("hidden");
  const [rating, setRating] = useState<1 | -1>(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const key = `${page}:${item ?? ""}`;

  useEffect(() => {
    let done: string[] = [];
    try {
      done = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    } catch {}
    // 이미 답한 항목인지는 기기에만 있다 — 붙은 뒤에 고른다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(Array.isArray(done) && done.includes(key) ? "hidden" : "ask");
  }, [key]);

  const remember = () => {
    try {
      const done = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
      localStorage.setItem(KEY, JSON.stringify([...done, key].slice(-200)));
    } catch {}
  };

  const send = async (r: 1 | -1, text: string) => {
    setBusy(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ page, item, rating: r, message: text, client: clientId() }),
      });
    } catch {
      // 보내기 실패는 조용히 — 피드백 때문에 흐름이 막히면 본말전도다.
    } finally {
      setBusy(false);
    }
  };

  if (state === "hidden") return null;

  if (state === "sent") {
    return <p className={styles.thanks}>고마워요! 하나하나 다 읽어요 · Thanks!</p>;
  }

  if (state === "ask") {
    const pick = (r: 1 | -1) => {
      setRating(r);
      setState("write");
      remember();
      void send(r, "");
    };
    return (
      <div className={styles.box}>
        <p className={styles.q}>
          이거 어땠어요? <small>How was it?</small>
        </p>
        <div className={styles.row}>
          <button type="button" className={styles.thumb} onClick={() => pick(1)} aria-label="좋았어요">
            👍 <span>좋았어요</span>
          </button>
          <button type="button" className={styles.thumb} onClick={() => pick(-1)} aria-label="아쉬웠어요">
            👎 <span>아쉬웠어요</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className={styles.box}
      onSubmit={async (e) => {
        e.preventDefault();
        if (message.trim()) await send(rating, message);
        setState("sent");
      }}
    >
      <p className={styles.q}>
        {rating === 1 ? "뭐가 좋았어요?" : "뭐가 아쉬웠어요?"} <small>한 줄이면 충분해요 · optional</small>
      </p>
      <div className={styles.row}>
        <input
          className={styles.input}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
          placeholder={rating === 1 ? "예: 대본 확인이 신기했어요" : "예: 점수가 왜 낮은지 모르겠어요"}
          autoFocus
        />
        <button type="submit" className={styles.send} disabled={busy}>
          {message.trim() ? "보내기" : "건너뛰기"}
        </button>
      </div>
    </form>
  );
}
