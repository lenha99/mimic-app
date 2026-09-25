import Link from "next/link";
import styles from "./back-home.module.css";

/** 홈이 아닌 화면의 맨 위 "← 홈". 녹음 화면의 "← 다른 소리"와 같은 자리·같은 모양. */
export function BackHome() {
  return (
    <nav className={styles.bar}>
      <Link href="/" className={styles.back}>
        ← 홈
      </Link>
    </nav>
  );
}
