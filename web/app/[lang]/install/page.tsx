import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { InstallGuide } from "@/components/install-guide";
import styles from "./install.module.css";

/**
 * 오픈채팅방에 뿌리는 링크의 착지점. 처음 보는 사람이 3초 안에 "뭐 하는 앱인지"와
 * "어떻게 까는지"를 알아야 한다. 받는 사람이 성우 지망생과 한국어 배우는 외국인이라
 * 연습실을 놀이와 같은 무게로 내세우고, 문구마다 영어 한 줄을 붙인다.
 */
export const metadata: Metadata = {
  title: "앱 설치",
  description: "명대사 따라 외치고 점수 받기 · 성우 연습실. 앱스토어 없이 홈 화면에 바로 설치.",
  openGraph: {
    title: "MIMIC — 목소리 따라하기 앱",
    description: "명대사 따라 외치고 점수 받기 · 성우 연습실 · Speak Korean like the movies",
  },
};

const FEATURES = [
  { mark: "🎬", ko: "명대사 따라 외치기", en: "Shout famous Korean movie lines", sub: "억양·톤·타이밍을 점수로" },
  { mark: "🎙️", ko: "성우·아나운서 연습실", en: "Voice-actor practice scripts", sub: "빠뜨린 말, 처진 끝음까지 짚어줘요" },
  { mark: "🏆", ko: "친구한테 점수 도전장", en: "Challenge friends to beat your score", sub: "링크 하나로 바로 대결" },
];

export default function InstallPage() {
  return (
    <main className={`shell ${styles.page}`}>
      <header className={styles.hero}>
        <div className={styles.iconWrap}>
          <Image src="/icons/icon-192.png" alt="" width={96} height={96} className={styles.icon} priority />
        </div>
        <h1 className={styles.name}>MIMIC</h1>
        <p className={styles.tag}>듣고, 따라 외치면, 점수가 나와요</p>
        <p className={styles.tagEn}>Listen. Repeat. Get scored on your Korean.</p>
      </header>

      <InstallGuide />

      <ul className={styles.features}>
        {FEATURES.map((f) => (
          <li key={f.ko} className={styles.feature}>
            <span className={styles.mark} aria-hidden="true">
              {f.mark}
            </span>
            <span className={styles.text}>
              <b>{f.ko}</b>
              <small>{f.sub}</small>
              <small className={styles.en}>{f.en}</small>
            </span>
          </li>
        ))}
      </ul>

      <Link href="/" className={styles.skip}>
        설치 없이 그냥 써보기 · Try without installing →
      </Link>
      <p className={styles.fine}>무료 · 로그인 없이 시작 · 녹음은 저장을 눌러야만 남아요</p>
    </main>
  );
}
