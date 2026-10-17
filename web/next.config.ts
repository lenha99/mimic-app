import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 서비스 워커는 브라우저가 캐시하면 고친 게 안 퍼진다. 항상 새로 받게 한다.
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
