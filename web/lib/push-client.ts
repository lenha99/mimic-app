import { clientId } from "./client-id";

/**
 * 웹 푸시 켜기 — 브라우저 전용.
 *
 * 안드로이드 크롬은 그냥 되고, 아이폰은 홈 화면에 설치한 앱에서만 된다(iOS 16.4+).
 * 안 되는 환경이면 "unsupported"/"needs-install" 을 돌려줘서 화면이 설치 안내로 보낸다.
 */
export type PushState = "on" | "off" | "denied" | "unsupported" | "needs-install";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function supported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!KEY;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function standalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/**
 * 브라우저 푸시 API 는 가끔 대답 없이 멈춘다(서비스 워커가 아직 안 깼거나 푸시 서버가 느릴 때).
 * 그대로 기다리면 버튼이 "잠깐만요…"에 멈춰 앱이 굳은 것처럼 보인다 — 시간을 정해 끊는다.
 */
function within<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

/** 화면에 버튼이 여러 개여도 한 번만 묻는다. */
let stateOnce: Promise<PushState> | null = null;
export function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return Promise.resolve("unsupported");
  if (!supported()) return Promise.resolve(isIos() && !standalone() ? "needs-install" : "unsupported");
  if (Notification.permission === "denied") return Promise.resolve("denied");
  if (Notification.permission !== "granted") return Promise.resolve("off");
  stateOnce ??= within(
    (async (): Promise<PushState> => {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      return sub ? "on" : "off";
    })(),
    3000,
  ).catch((): PushState => "off");
  return stateOnce;
}

function keyBytes(b64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** 권한을 묻고 구독해서 서버에 저장한다. 버튼을 누른 순간에만 부를 것(브라우저 규칙). */
export async function enablePush(opts: { newEntries?: boolean } = {}): Promise<PushState> {
  if (!supported()) return isIos() && !standalone() ? "needs-install" : "unsupported";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  stateOnce = null;
  const reg = await within(
    (async () => {
      const r = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
      await navigator.serviceWorker.ready;
      return r;
    })(),
    8000,
  );
  const sub = await within(
    (async () =>
      (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) })))(),
    10000,
  );
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), client: clientId(), newEntries: opts.newEntries !== false }),
      signal: ctrl.signal,
    });
    return res.ok ? "on" : "off";
  } finally {
    clearTimeout(timer);
  }
}

export async function disablePush(): Promise<PushState> {
  stateOnce = null;
  const reg = await within(navigator.serviceWorker.getRegistration("/"), 3000).catch(() => undefined);
  const sub = reg ? await within(reg.pushManager.getSubscription(), 3000).catch(() => null) : null;
  if (sub) {
    // 서버 정리는 기다리지 않는다 — 꺼진 건 화면에 바로 보여야 한다.
    void fetch("/api/push", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
      keepalive: true,
    }).catch(() => {});
    await within(sub.unsubscribe(), 3000).catch(() => {});
  }
  return "off";
}

/**
 * 이미 켠 구독을 서버에 다시 알린다 — 손님일 때 켜고 나중에 로그인하면 그 구독에 계정을
 * 붙여야 구독·메시지 알림이 온다. 권한을 묻지 않는다. 하루 한 번이면 충분하다.
 */
export async function syncPush(): Promise<void> {
  try {
    if (!supported() || Notification.permission !== "granted") return;
    const day = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem("mimic.push.sync") === day) return;
    const reg = await within(navigator.serviceWorker.getRegistration("/"), 3000);
    const sub = reg ? await within(reg.pushManager.getSubscription(), 3000) : null;
    if (!sub) return;
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), client: clientId(), newEntries: localStorage.getItem("mimic.push.new") !== "off" }),
    });
    if (res.ok) localStorage.setItem("mimic.push.sync", day);
  } catch {}
}
