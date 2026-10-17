import type { MetadataRoute } from "next";

/**
 * 홈 화면 설치용 매니페스트. 앱스토어 없이 링크 하나로 "앱"이 되는 길이다.
 *
 * 아이콘 그림은 마스커블 안전 영역 안에 있어서 한 장을 any·maskable 둘 다로 쓴다
 * (assets/icon.svg). 배경색은 무대 검정 — 안드로이드 스플래시가 이 색으로 뜬다.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MIMIC — 목소리 따라하기",
    short_name: "MIMIC",
    description: "명대사를 듣고 따라 외치면 점수가 나와요. 성우 연습실까지.",
    lang: "ko",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0b",
    theme_color: "#0a0a0b",
    categories: ["entertainment", "education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "명대사 챌린지", url: "/challenges", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "연습실", url: "/practice", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
