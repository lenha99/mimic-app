import { lang as rootLang } from "next/root-params";
import { isLang, tr, type Lang, type T } from "@/lib/i18n";

/** 서버 컴포넌트 어디서든 — 주소의 [lang] 을 props 없이 꺼낸다. */
export async function getLang(): Promise<Lang> {
  const l = await rootLang();
  return isLang(l) ? l : "ko";
}

export async function getT(): Promise<T> {
  return tr(await getLang());
}
