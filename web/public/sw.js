/*
 * 서비스 워커 — 설치 가능 조건을 채우고, 망이 끊겼을 때 하얀 화면 대신 안내 한 장을 띄운다.
 *
 * 일부러 아무것도 캐시하지 않는다(오프라인 안내 페이지만). 채점·녹음·로그인은 어차피
 * 서버가 있어야 하고, 페이지를 캐시하면 배포 뒤에도 낡은 화면이 남는다 — 서버 배포가
 * 낡아 기능이 조용히 사라졌던 것과 같은 종류의 사고다.
 */
const OFFLINE = "/offline.html";
const CACHE = "mimic-offline-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE).then((r) => r || Response.error())),
  );
});

// 웹 푸시 — 새 출전작 · 첫 청취 · 구독 · 메시지. 내용은 서버(lib/notify-server)가 정한다.
self.addEventListener("push", (event) => {
  let d = {};
  try {
    d = event.data ? event.data.json() : {};
  } catch {
    d = { title: "MIMIC", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(d.title || "MIMIC", {
      body: d.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: d.tag,
      data: { url: d.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
