"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./weekly.module.css";

/** 한 줄 알림. show(text) 하면 2.4초 떠 있다 사라진다. */
export function useToast(): [React.ReactNode, (text: string) => void] {
  const [text, setText] = useState<string | null>(null);
  const [n, setN] = useState(0);
  const timer = useRef<number | null>(null);

  const show = useCallback((t: string) => {
    setText(t);
    setN((x) => x + 1);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setText(null), 2400);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const node = text ? (
    <p key={n} className={styles.toast} role="status">
      {text}
    </p>
  ) : null;
  return [node, show];
}
