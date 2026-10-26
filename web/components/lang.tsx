"use client";

import { createContext, useContext, useMemo } from "react";
import { LANG_COOKIE, tr, type Lang, type T } from "@/lib/i18n";
import styles from "./lang.module.css";

const LangContext = createContext<Lang>("ko");

/** 레이아웃이 주소의 언어를 내려준다 — 브라우저 컴포넌트는 useT() 로 꺼낸다. */
export function LangProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useT(): T {
  const lang = useLang();
  return useMemo(() => tr(lang), [lang]);
}

export function setLang(lang: Lang) {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  // 같은 주소라도 그리는 언어가 바뀐다 — 라우터 캐시를 통째로 버리고 새로 받는다.
  location.reload();
}

/** 한 · EN 전환. 눌린 쪽이 지금 언어다. */
export function LangSwitch({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <span className={`${styles.switch} ${className ?? ""}`} role="group" aria-label="Language">
      <button type="button" aria-pressed={lang === "ko"} onClick={() => lang !== "ko" && setLang("ko")}>
        한
      </button>
      <button type="button" aria-pressed={lang === "en"} onClick={() => lang !== "en" && setLang("en")}>
        EN
      </button>
    </span>
  );
}
