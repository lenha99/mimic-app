import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서비스 워커는 브라우저가 캐시하면 고친 게 안 퍼진다. 항상 새로 받게 한다.
  // 예전 밈 랭킹·투표는 주간 챌린지의 블라인드 배틀로 합쳤다. 공유된 옛 링크가 404 가 되지 않게.
  async redirects() {
    return [
      { source: "/rank", destination: "/weekly", permanent: false },
      { source: "/vote", destination: "/weekly/battle", permanent: false },
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
