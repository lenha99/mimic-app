"use client";

import Link from "next/link";
import { ClaimPending } from "@/app/[lang]/profile/claim-pending";
import { useViewer } from "./viewer";
import { useT } from "@/components/lang";
import styles from "./viewer-welcome.module.css";

/**
 * 로그인한 사람의 홈 맨 위 — "그래서 뭘 하면 되지?"에 대한 답.
 *
 * 로그인 직후엔 이 화면으로 온다. 예전엔 프로필로 떨어져서, 닉네임 수정·탈퇴 버튼
 * 사이에서 다음에 할 일을 못 찾았다. 할 수 있는 것 네 가지를 한 번에 보여준다.
 * 로그인 전에 저장한 녹음은 여기서 계정으로 가져온다(ClaimPending).
 */
export function ViewerWelcome({ todayId, todayTitle }: { todayId?: string; todayTitle?: string }) {
  const viewer = useViewer();
  const t = useT();
  if (!viewer?.loggedIn) return null;

  const actions = [
    todayId && { href: `/record/${todayId}`, icon: "🎯", label: t("오늘의 대사 도전", "Today's challenge"), sub: todayTitle },
    { href: "/avatar", icon: "🎨", label: t("내 캐릭터 꾸미기", "Style my character"), sub: t("버럭이·할머니·MZ…", "Angry guy, grandma, Gen Z…") },
    { href: "/create", icon: "🎤", label: t("내 챌린지 만들기", "Make my challenge"), sub: t("친구들이 날 따라 하게", "Make friends copy YOU") },
    { href: "/profile", icon: "📼", label: t("내 녹음·챌린지", "My takes & challenges"), sub: t("공개·삭제·다시 보내기", "Share, delete, resend") },
  ].filter(Boolean) as { href: string; icon: string; label: string; sub?: string }[];

  return (
    <section className={styles.welcome}>
      <ClaimPending />
      <p className={styles.hi}>
        {t(
          <>반가워요, <b>{viewer.nickname ?? "친구"}</b>님! 오늘은 뭐 해볼까요?</>,
          <>Hey <b>{viewer.nickname ?? "there"}</b>! What are we doing today?</>,
        )}
      </p>
      <ul className={styles.grid}>
        {actions.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className={styles.action}>
              <span className={styles.icon} aria-hidden="true">
                {a.icon}
              </span>
              <span className={styles.label}>{a.label}</span>
              {a.sub && <span className={styles.sub}>{a.sub}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
