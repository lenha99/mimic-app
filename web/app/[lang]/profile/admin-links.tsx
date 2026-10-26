import Link from "next/link";
import styles from "./profile.module.css";

/**
 * 운영자 메뉴 — 운영자 계정(admins 표)으로 로그인했을 때만 프로필 맨 위에 뜬다.
 * 폰에 설치한 앱에는 주소창이 없어서 /admin 주소를 칠 데가 없다.
 */
export function AdminLinks({ pending, feedback, reported }: { pending: number; feedback: number; reported: number }) {
  return (
    <div className={styles.adminCard}>
      <div className="eyebrow">운영자</div>
      <Link href="/admin/feedback" className={styles.adminRow}>
        <span>
          <b>피드백 모아보기</b>
          <small>최근 7일 {feedback}개 · 👍/👎 · 한 줄 · 신고된 글</small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>
      <Link href="/admin/weekly" className={styles.adminRow}>
        <span>
          <b>보이스 챌린지 출전작</b>
          <small>{reported > 0 ? `신고된 출전작 ${reported}개` : "신고 없음"} · 숨기기 · 되살리기</small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>
      <Link href="/admin/challenges" className={styles.adminRow}>
        <span>
          <b>챌린지 검토</b>
          <small>{pending > 0 ? `${pending}개 기다리는 중` : "기다리는 것 없음"}</small>
        </span>
        <i aria-hidden="true">→</i>
      </Link>
    </div>
  );
}
