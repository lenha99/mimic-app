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
