/**
 * 한국어 · 영어 두 벌.
 *
 * 주소는 그대로다 — proxy.ts 가 쿠키(없으면 브라우저 언어)를 보고 `/x` 를
 * `/ko/x` · `/en/x` 로 몰래 바꿔 그린다. 두 언어 모두 정적 페이지로 남는다.
 * 쿠키를 읽어 그때그때 그리면 홈이 동적이 되고, 그러면 다시 첫 응답 6초다.
 *
 * 문구는 키 사전 대신 그 자리에 두 줄로 쓴다: `t("도전하기", "Take it on")`.
 * 두 언어가 한눈에 보여서 한쪽만 고치고 잊는 일이 줄고, 키 이름을 짓느라
 * 문구가 어디 쓰이는지 잃어버리지 않는다.
 */
export const LANGS = ["ko", "en"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_COOKIE = "mimic_lang";

export function isLang(v: unknown): v is Lang {
  return v === "ko" || v === "en";
}

/** 문자열이든 JSX 든 — 둘 중 하나를 고른다. */
export type T = <X>(ko: X, en: X) => X;

export function tr(lang: Lang): T {
  return (ko, en) => (lang === "en" ? en : ko);
}

/** 쿠키가 있으면 그것, 없으면 브라우저 언어. 한국어 쓰는 사람만 ko, 나머지는 en. */
export function pickLang(cookie?: string | null, acceptLanguage?: string | null): Lang {
  if (isLang(cookie)) return cookie;
  const first = (acceptLanguage ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  if (!first) return "ko";
  return first.startsWith("ko") ? "ko" : "en";
}

/** 페이지의 params 에서 언어를 꺼낸다. 알 수 없는 값은 ko. */
export async function pageLang(params: Promise<{ lang: string }>): Promise<Lang> {
  const { lang } = await params;
  return isLang(lang) ? lang : "ko";
}

/** "3일 전" · "3d ago" 같은 짧은 상대 시간. */
export function ago(lang: Lang, iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const t = tr(lang);
  if (s < 60) return t("방금", "just now");
  const m = Math.round(s / 60);
  if (m < 60) return t(`${m}분 전`, `${m}m ago`);
  const h = Math.round(m / 60);
  if (h < 24) return t(`${h}시간 전`, `${h}h ago`);
  const d = Math.round(h / 24);
  return t(`${d}일 전`, `${d}d ago`);
}

/** API 라우트용 — 쿠키·브라우저 언어로 응답 문구 언어를 정한다. */
export function requestLang(req: Request): Lang {
  const cookie = req.headers.get("cookie") ?? "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${LANG_COOKIE}=([^;]+)`));
  return pickLang(m?.[1], req.headers.get("accept-language"));
}

export function requestT(req: Request): T {
  return tr(requestLang(req));
}

/**
 * 서버(채점 서버 등)가 한국어로만 답하는 에러를 영어 화면에서 그대로 찍지 않는다.
 * 영어인데 한글이 섞여 있으면 준비해 둔 영어 문구로 바꾼다.
 */
export function localError(t: T, msg: string | undefined | null, fallbackKo: string, fallbackEn: string): string {
  const en = t(false, true);
  if (!msg) return t(fallbackKo, fallbackEn);
  return en && /[가-힣]/.test(msg) ? fallbackEn : msg;
}
