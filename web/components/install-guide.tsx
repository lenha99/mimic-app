"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  detectInstallEnv,
  openInBrowser,
  promptInstall,
  subscribeInstallPrompt,
  type InstallEnv,
} from "@/lib/install";
import styles from "./install-guide.module.css";

/**
 * "지금 연 곳"에 맞는 설치 방법 하나만 보여준다. 방법을 다 늘어놓으면 대부분은
 * 자기 경우를 못 찾고 닫는다. 외국인 학습자도 받으니 한 줄씩 영어를 붙인다.
 */
export function InstallGuide() {
  const [env, setEnv] = useState<InstallEnv | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // 기기·브라우저는 서버에서 모른다. 첫 그림은 비워 두고 붙은 뒤에 고른다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv(detectInstallEnv());
    return subscribeInstallPrompt(setCanPrompt);
  }, []);

  if (!env) return <div className={styles.card} aria-busy="true" />;

  if (env.kind === "installed" || done) {
    return (
      <div className={styles.card}>
        <p className={styles.title}>설치 완료! 홈 화면의 MIMIC 아이콘으로 열어 주세요</p>
        <p className={styles.en}>Installed — open MIMIC from your home screen.</p>
        <Link href="/" className={styles.primary}>
          지금 시작하기 · Start
        </Link>
      </div>
    );
  }

  if (env.kind === "inapp") {
    const canJump = env.app === "kakao" || env.os === "android";
    const copy = async () => {
      try {
        await navigator.clipboard.writeText(location.origin + "/install");
        setCopied(true);
      } catch {
        setCopied(false);
      }
    };
    return (
      <div className={styles.card}>
        <p className={styles.title}>
          {env.app === "kakao" ? "카카오톡 안에서는" : "이 앱 안에서는"} 설치가 안 돼요
        </p>
        <p className={styles.sub}>
          {env.os === "ios" ? "Safari" : "Chrome"}로 열면 설치할 수 있어요.
        </p>
        <p className={styles.en}>
          In-app browsers can&apos;t install apps. Open this page in {env.os === "ios" ? "Safari" : "Chrome"}.
        </p>
        {canJump ? (
          <button type="button" className={styles.primary} onClick={() => openInBrowser(env)}>
            {env.os === "ios" ? "Safari로 열기" : "Chrome으로 열기"}
          </button>
        ) : (
          <ol className={styles.steps}>
            <li>
              오른쪽 아래·위의 <b>···</b> 메뉴를 누르고
              <span className={styles.en}>Tap the ··· menu</span>
            </li>
            <li>
              <b>Safari로 열기</b>를 고르세요
              <span className={styles.en}>Choose “Open in Safari”</span>
            </li>
          </ol>
        )}
        <button type="button" className={styles.ghost} onClick={copy}>
          {copied ? "링크 복사됨 · Copied" : "링크 복사 · Copy link"}
        </button>
      </div>
    );
  }

  if (env.kind === "ios") {
    return (
      <div className={styles.card}>
        <p className={styles.title}>아이폰은 이렇게 설치해요</p>
        <p className={styles.en}>Add to Home Screen on iPhone</p>
        <ol className={styles.steps}>
          <li>
            화면 아래 <ShareIcon /> <b>공유</b> 버튼
            <span className={styles.en}>Tap Share</span>
          </li>
          <li>
            <b>홈 화면에 추가</b> <PlusIcon />
            <span className={styles.en}>Add to Home Screen</span>
          </li>
          <li>
            오른쪽 위 <b>추가</b>
            <span className={styles.en}>Tap Add</span>
          </li>
        </ol>
        <p className={styles.hint}>목록에 없으면 공유 창을 위로 끌어올려 보세요</p>
      </div>
    );
  }

  // 삼성 인터넷 등도 자기 설치 버튼을 띄우지만, 그렇게 만든 설치 파일은 Play 프로텍트가
  // "이전 버전 Android용"이라며 막는 일이 있다. 설치 창보다 먼저 크롬으로 보낸다.
  if (env.kind === "android" && !env.chrome) {
    return (
      <div className={styles.card}>
        <p className={styles.title}>Chrome에서 설치해 주세요</p>
        <p className={styles.sub}>
          지금 브라우저로 설치하면 &ldquo;이전 버전의 Android용으로 개발되어 차단됨&rdquo; 경고가 뜰 수 있어요.
          Chrome으로 설치하면 안 떠요.
        </p>
        <p className={styles.en}>Install from Chrome — other browsers may get blocked by Play Protect.</p>
        <button type="button" className={styles.primary} onClick={() => openInBrowser(env)}>
          Chrome으로 열기
        </button>
        <p className={styles.hint}>경고가 이미 떴다면 그 설치는 취소하고 Chrome에서 다시 해 주세요</p>
      </div>
    );
  }

  if (canPrompt) {
    const install = async () => {
      const outcome = await promptInstall();
      if (outcome === "accepted") setDone(true);
    };
    return (
      <div className={styles.card}>
        <p className={styles.title}>버튼 한 번이면 설치돼요</p>
        <p className={styles.en}>One tap to install — no app store needed.</p>
        <button type="button" className={styles.primary} onClick={install}>
          앱 설치하기 · Install
        </button>
        <p className={styles.hint}>용량 거의 0 · 앱스토어 안 거쳐요</p>
      </div>
    );
  }

  if (env.kind === "android") {
    return (
      <div className={styles.card}>
        <p className={styles.title}>브라우저 메뉴에서 설치해요</p>
        <p className={styles.en}>Install from the browser menu</p>
        <ol className={styles.steps}>
          <li>
            오른쪽 위 <b>⋮</b> 메뉴
            <span className={styles.en}>Open the menu</span>
          </li>
          <li>
            <b>앱 설치</b> (없으면 <b>홈 화면에 추가</b>)
            <span className={styles.en}>Install app / Add to Home screen</span>
          </li>
        </ol>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.title}>휴대폰에서 열어 주세요</p>
      <p className={styles.sub}>마이크로 외치는 앱이라 폰이 제일 편해요. 이 주소를 폰으로 보내세요.</p>
      <p className={styles.en}>Best on your phone — open this link there to install.</p>
      <p className={styles.url}>{location.host}/install</p>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-label="공유">
      <path d="M12 3v12M7.5 7.5 12 3l4.5 4.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 11H6a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className={styles.icon} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" strokeWidth="1.9" />
      <path d="M12 8.5v7M8.5 12h7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}
