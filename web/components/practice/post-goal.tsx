"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { UNDO_MS } from "@/lib/post-take";

/**
 * 올리는 이유 — "홈 추천에 뽑히면"은 너무 멀다. 금방 닿을 목표를 보여 준다(VOICE PASS 규칙 그대로).
 * 올리기 +30 XP 면 첫 목소리는 바로 LV2(네온 프레임), 첫 ❤ 는 FIRST ❤ 배지, 구독자는 한 명마다 +25 XP.
 */
export function PostGoal({ className }: { className?: string }) {
  const t = useT();
  return (
    <p className={className}>
      {t(
        <>
          🎯 첫 ❤ 받으면 <b>FIRST ❤</b> 배지 · 구독자 한 명마다 <b>+25 XP</b>
        </>,
        <>
          🎯 First ❤ earns the <b>FIRST ❤</b> badge · each subscriber <b>+25 XP</b>
        </>,
      )}
    </p>
  );
}

/** 5초 되돌리기 버튼 — 시간이 지나면 사라진다. */
export function UndoButton({ onUndo, busy, className }: { onUndo: () => void; busy: boolean; className?: string }) {
  const t = useT();
  const [left, setLeft] = useState(Math.ceil(UNDO_MS / 1000));
  useEffect(() => {
    const at = Date.now();
    const iv = window.setInterval(() => {
      const s = Math.ceil((UNDO_MS - (Date.now() - at)) / 1000);
      setLeft(Math.max(0, s));
      if (s <= 0) window.clearInterval(iv);
    }, 200);
    return () => window.clearInterval(iv);
  }, []);
  if (left <= 0 && !busy) return null;
  return (
    <button type="button" className={className} onClick={onUndo} disabled={busy}>
      {busy ? t("되돌리는 중…", "Undoing…") : t(`↩ 되돌리기 (${left})`, `↩ Undo (${left})`)}
    </button>
  );
}
