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

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (!supported()) return isIos() && !standalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
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
  const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) }));
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), client: clientId(), newEntries: opts.newEntries !== false }),
  });
  return res.ok ? "on" : "off";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
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
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON(), client: clientId(), newEntries: localStorage.getItem("mimic.push.new") !== "off" }),
    });
    if (res.ok) localStorage.setItem("mimic.push.sync", day);
  } catch {}
}
