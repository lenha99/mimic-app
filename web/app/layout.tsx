import type { Metadata, Viewport } from "next";
import { Black_Han_Sans, IBM_Plex_Mono } from "next/font/google";
import { config } from "@/lib/config";
import "./globals.css";

// 데이터·코드·라벨용. next/font 가 자체 호스팅하므로 외부 요청이 없다.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * 점수·제목 전용 디스플레이 서체. 본문은 Pretendard 그대로 둔다.
 *
 * 점수가 이 제품의 얼굴인데 본문 서체로 크게만 키우면 그냥 큰 글씨다.
 * 노래방 점수판처럼 두껍고 좁은 한글 서체가 있어야 "점수가 나온다"는 느낌이 산다.
 */
const display = Black_Han_Sans({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
  display: "swap",
});

/**
 * OG 태그는 웹 전환의 핵심 이득이다 (기획서 v0.2 결정 03).
 * 카톡·인스타 DM·슬랙·아이메시지가 전부 여기서 카드를 만든다.
 * 결과 페이지별 이미지는 #14 에서 확정한 뒤 generateMetadata 로 붙인다.
 */
export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: {
    default: "MIMIC — 목소리 따라하기 챌린지",
    template: "%s · MIMIC",
  },
  description: "원본 소리를 듣고 따라해 보세요. AI가 피치·톤·타이밍을 채점합니다.",
  openGraph: {
    type: "website",
    siteName: "MIMIC",
    locale: "ko_KR",
    title: "MIMIC — 목소리 따라하기 챌린지",
    description: "원본 소리를 듣고 따라해 보세요. AI가 피치·톤·타이밍을 채점합니다.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${mono.variable} ${display.variable}`}>
      <head>
        {/* Pretendard — Flutter 앱과 같은 서체를 쓴다 (lib/theme.dart).
            next/font 에 없는 서체라 CDN 링크로 불러온다. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
