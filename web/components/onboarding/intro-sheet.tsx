"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExamplePlayer } from "@/components/example-player";
import { PrivacyTag } from "@/components/privacy-tag";
import { SCRIPT_EXAMPLES } from "@/lib/examples";
import { markSeen, seen } from "@/lib/onboarding";
import { track } from "@/lib/track";
import styles from "./onboarding.module.css";

const SLIDES = 3;

/**
 * 처음 온 사람에게 세 장으로 "이 앱에서 뭘 하는지"를 보여준다 — 홈에서, 딱 한 번.
 *
 * 공유 링크로 온 사람(/p, /weekly/e, /record?s=)에겐 띄우지 않는다. 그 사람은 이미 할
 * 일이 정해져 있고, 거기서 안내부터 들이밀면 닫고 나간다. 언제든 건너뛸 수 있고,
 * "사용법 다시 보기"(/?intro=1)로 다시 연다.
 *
 * 세 장이 답하는 질문: 뭘 하는 앱? → 내 연습 녹음은 누가 듣나? → 어떻게 순위에 오르나?
 */
export function IntroSheet({ scriptId, title }: { scriptId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const again = new URLSearchParams(window.location.search).get("intro") === "1";
    if (!again && seen("intro")) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    track("intro_view", { via: again ? "replay" : "first" });
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const close = (how: "skip" | "done") => {
    markSeen("intro");
    setOpen(false);
    setStep(0);
    track(how === "done" ? "intro_done" : "intro_skip", { via: String(step + 1) });
    if (window.location.search.includes("intro=1")) window.history.replaceState(null, "", "/");
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="MIMIC 사용법">
      <div className={styles.sheet}>
        <div className={styles.top}>
          <span className={styles.dots} aria-label={`${step + 1} / ${SLIDES}`}>
            {Array.from({ length: SLIDES }, (_, i) => (
              <i key={i} className={i === step ? styles.dotOn : undefined} />
            ))}
          </span>
          <button type="button" className={styles.skip} onClick={() => close("skip")}>
            건너뛰기
          </button>
        </div>

        {step === 0 && (
          <section className={styles.slide}>
            <p className={styles.kicker}>MIMIC 이 처음이라면</p>
            <h2 className={styles.head}>
              매주 대본 하나,
              <br />
              <em>목소리로 겨뤄요</em>
            </h2>
            <p className={styles.body}>
              이번 주 대본은 <b>{title}</b>. 이런 식으로 읽어서 올리면 돼요 — 한번 들어 보세요.
            </p>
            <ExamplePlayer
              example={SCRIPT_EXAMPLES[scriptId]}
              title="AI가 읽어 본 이번 주 대본"
              note="AI 예시라 순위에는 없어요. 사람 목소리는 이걸 쉽게 넘어요"
            />
          </section>
        )}

        {step === 1 && (
          <section className={styles.slide}>
            <p className={styles.kicker}>연습실</p>
            <h2 className={styles.head}>
              몇 번이고 연습해요
              <br />
              <em>아무도 못 들어요</em>
            </h2>
            <p className={styles.body}>녹음하면 속도·쉼·억양·말끝을 바로 짚어줘요. 연습 녹음은 서버에 올라가지 않아요.</p>
            <ul className={styles.demo} aria-hidden="true">
              <li>
                <span>속도</span>
                <b className={styles.ok}>딱 좋아요</b>
              </li>
              <li>
                <span>쉼</span>
                <b className={styles.warn}>조금 짧아요</b>
              </li>
              <li>
                <span>말끝</span>
                <b className={styles.ok}>또렷해요</b>
              </li>
            </ul>
            <PrivacyTag kind="device" />
          </section>
        )}

        {step === 2 && (
          <section className={styles.slide}>
            <p className={styles.kicker}>출전 · 랭킹</p>
            <h2 className={styles.head}>
              제일 잘된 한 테이크만
              <br />
              <em>출전해요</em>
            </h2>
            <PrivacyTag kind="public" />
            <p className={styles.body}>
              <b>❤ 는 다른 사용자들이 듣고 눌러줘요.</b> 당신도 다른 출전작을 듣고 ❤ 를 눌러 보세요. 일요일 밤
              마감 때 ❤ 순 1~3위가 시상대에 남아요.
            </p>
            <p className={styles.small}>로그인 없이 바로 돼요 · 출전작은 언제든 내릴 수 있어요</p>
          </section>
        )}

        <div className={styles.actions}>
          {step === SLIDES - 1 ? (
            <>
              <Link href={`/practice/${scriptId}?from=weekly`} className={styles.go} onClick={() => close("done")}>
                이번 주 대본 연습하러 가기 →
              </Link>
              <button type="button" className={styles.later} onClick={() => close("done")}>
                먼저 둘러볼게요
              </button>
            </>
          ) : (
            <>
              {step > 0 && (
                <button type="button" className={styles.back} onClick={() => setStep(step - 1)}>
                  이전
                </button>
              )}
              <button type="button" className={styles.next} onClick={() => setStep(step + 1)}>
                다음
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
