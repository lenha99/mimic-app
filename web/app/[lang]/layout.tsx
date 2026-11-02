import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import { BottomNav } from "@/components/bottom-nav";
import { LangProvider } from "@/components/lang";
import { LANGS, tr } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { config } from "@/lib/config";
import { INSTALL_BOOTSTRAP } from "@/lib/install";
import "./globals.css";

// 데이터·코드·라벨용. next/font 가 자체 호스팅하므로 외부 요청이 없다.
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

/**
 * OG 태그는 웹 전환의 핵심 이득이다 (기획서 v0.2 결정 03).
 * 카톡·인스타 DM·슬랙·아이메시지가 전부 여기서 카드를 만든다.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = tr(await getLang());
  // 카톡·DM 미리보기에 뜨는 기본 문구. 이제 중심은 "따라 하면 점수"가 아니라
  // 연습(코코의 심사표) → 목소리 갤러리에 올리기다.
  const title = t("MIMIC — 목소리 연습하고, 들려주세요", "MIMIC — Practice your voice, then share it");
  const description = t(
    "성우·아나운서 대본으로 녹음하면 코코가 억양·말끝·속도를 짚어 줘요. 잘 나온 목소리는 갤러리에 올려 들려주세요. 설치 없이 바로.",
    "Read voice-actor and news-anchor scripts and get notes on intonation, endings and pace. Post your best take to the voice gallery. No install.",
  );
  const image = { url: "/og-default.png", width: 1200, height: 630, alt: "MIMIC" };
  return {
    metadataBase: new URL(config.siteUrl),
    title: { default: title, template: "%s · MIMIC" },
    description,
    openGraph: {
      type: "website",
      siteName: "MIMIC",
      locale: t("ko_KR", "en_US"),
      title,
      description,
      images: [image],
    },
    twitter: { card: "summary_large_image", images: [image.url] },
    // 아이폰 "홈 화면에 추가" 용. 상태 막대는 불투명 검정 — 반투명이면 화면 맨 위가
    // 시계 밑으로 들어가서 모든 화면에 위쪽 여백을 따로 줘야 한다.
    appleWebApp: { capable: true, title: "MIMIC", statusBarStyle: "black" },
    applicationName: "MIMIC",
  };
}

/** 두 언어 모두 빌드 때 만든다. 그 밖의 값은 404. */
export function generateStaticParams() {
  return LANGS.map((lang) => ({ lang }));
}
export const dynamicParams = false;

export const viewport: Viewport = {
  themeColor: "#16141a",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await getLang();
  return (
    <html lang={lang} className={mono.variable}>
      <head>
        {/* Pretendard — Flutter 앱과 같은 서체를 쓴다 (lib/theme.dart).
            next/font 에 없는 서체라 CDN 링크로 불러온다. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 설치 이벤트는 React 가 붙기 전에 한 번 오고 끝난다 — 먼저 잡아 둔다 (lib/install). */}
        <script dangerouslySetInnerHTML={{ __html: INSTALL_BOOTSTRAP }} />
      </head>
      <body>
        <LangProvider lang={lang}>
          {children}
          <BottomNav />
        </LangProvider>
      </body>
    </html>
  );
}
