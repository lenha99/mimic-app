import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 브라우저 안 페이지 캐시 — 기본 5분이면 방금 올린 목소리가 홈·갤러리에 5분 늦게 뜬다(11/4). 30초로.
  experimental: { staleTimes: { static: 30 } },
  // 서비스 워커는 브라우저가 캐시하면 고친 게 안 퍼진다. 항상 새로 받게 한다.
  // 예전 밈 랭킹·투표는 주간 챌린지의 블라인드 배틀로 합쳤다. 공유된 옛 링크가 404 가 되지 않게.
  async redirects() {
    return [
      { source: "/rank", destination: "/weekly", permanent: false },
      { source: "/vote", destination: "/weekly", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
