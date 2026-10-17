/**
 * 홈 화면 설치 — 브라우저 전용.
 *
 * 링크는 대부분 카카오톡 오픈채팅으로 들어온다. 카톡 안 브라우저(인앱)에서는 설치가
 * 아예 안 되므로, 설치 안내는 "지금 어디서 열었나"부터 갈라야 한다:
 *   이미 설치됨 → 아무것도 안 보인다
 *   인앱(카톡·인스타 등) → 먼저 진짜 브라우저로 내보낸다
 *   안드로이드 크롬 → 설치 버튼 한 번 (beforeinstallprompt)
 *   아이폰 → 공유 → 홈 화면에 추가 (자동 설치 API 가 없다)
 */

export type InstallEnv =
  | { kind: "installed" }
  | { kind: "inapp"; app: "kakao" | "other"; os: "ios" | "android" | "other" }
  | { kind: "ios" }
  | { kind: "android" }
  | { kind: "desktop" };

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    /** layout 의 인라인 스크립트가 하이드레이션 전에 잡아 둔 설치 이벤트. */
    __mimicInstall?: PromptEvent | null;
  }
}

export function detectInstallEnv(): InstallEnv {
  const ua = navigator.userAgent;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  if (standalone) return { kind: "installed" };

  // iPadOS 는 데스크톱 맥처럼 자기소개한다 — 터치 지점 수로 가른다.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const os = ios ? "ios" : android ? "android" : "other";

  if (/KAKAOTALK/i.test(ua)) return { kind: "inapp", app: "kakao", os };
  if (/Instagram|FBAN|FBAV|NAVER\(inapp|Line\/|DaumApps|everytimeApp|; wv\)/i.test(ua)) {
    return { kind: "inapp", app: "other", os };
  }
  if (ios) return { kind: "ios" };
  if (android) return { kind: "android" };
  return { kind: "desktop" };
}

/**
 * 인앱 브라우저에서 바깥 브라우저로 같은 주소를 연다. 열 수 없으면 false.
 * 카톡은 자체 스킴이 안드로이드·아이폰 둘 다 된다. 다른 앱은 안드로이드에서만
 * 크롬 인텐트로 뺄 수 있고, 아이폰은 사용자가 메뉴에서 "Safari로 열기"를 눌러야 한다.
 */
export function openInBrowser(env: InstallEnv, url = location.href): boolean {
  if (env.kind !== "inapp") return false;
  if (env.app === "kakao") {
    location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    return true;
  }
  if (env.os === "android") {
    const u = new URL(url);
    location.href = `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;end`;
    return true;
  }
  return false;
}

/** 크롬의 설치 창을 띄울 수 있는지 구독한다. 이벤트가 늦게 오기도 해서 듣고 있어야 한다. */
export function subscribeInstallPrompt(cb: (ready: boolean) => void): () => void {
  const update = () => cb(Boolean(window.__mimicInstall));
  update();
  window.addEventListener("mimic:installable", update);
  window.addEventListener("appinstalled", update);
  return () => {
    window.removeEventListener("mimic:installable", update);
    window.removeEventListener("appinstalled", update);
  };
}

/** 크롬 설치 창을 띄운다. 이벤트는 한 번만 쓸 수 있다. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  const ev = window.__mimicInstall;
  if (!ev) return "unavailable";
  window.__mimicInstall = null;
  await ev.prompt();
  const { outcome } = await ev.userChoice;
  window.dispatchEvent(new Event("mimic:installable"));
  return outcome;
}

/**
 * 하이드레이션보다 먼저 돌아야 하는 인라인 스크립트. beforeinstallprompt 는 페이지가
 * 뜨자마자 한 번 오고 다시 안 오기 때문에 React 가 붙기 전에 잡아 둔다.
 * 서비스 워커 등록도 여기서 한다 — 설치 조건이자 오프라인 안내용이다.
 */
export const INSTALL_BOOTSTRAP = `
window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__mimicInstall=e;window.dispatchEvent(new Event("mimic:installable"))});
window.addEventListener("appinstalled",function(){window.__mimicInstall=null});
if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(function(){})})}
`;
