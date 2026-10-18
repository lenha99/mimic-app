import styles from "./privacy-tag.module.css";

/**
 * 이 녹음은 어디 있고 누가 들을 수 있나 — 한눈에.
 *
 * 연습 녹음은 폰에만, 출전작은 모두에게, 명대사는 저장 방식에 따라 다르다. 같은 앱 안에서
 * 녹음의 운명이 갈리니, 녹음이 보이는 곳마다 같은 모양의 딱지를 붙인다. 자물쇠 = 나만,
 * 지구 = 모두, 고리 = 링크 받은 사람.
 */
export type PrivacyKind = "device" | "unsaved" | "private" | "link" | "public";

const COPY: Record<PrivacyKind, { icon: string; label: string; sub: string }> = {
  device: { icon: "🔒", label: "내 폰에만 저장", sub: "다른 사람은 들을 수 없어요" },
  unsaved: { icon: "⏳", label: "아직 저장 안 됨", sub: "저장하지 않으면 이 화면을 나갈 때 사라져요" },
  private: { icon: "🔒", label: "서버에 저장 · 나만", sub: "다른 사람은 들을 수 없어요. 프로필에서 지울 수 있어요" },
  link: { icon: "🔗", label: "링크 공개", sub: "링크를 받은 사람만 들을 수 있어요" },
  public: { icon: "🌐", label: "모두에게 공개", sub: "누구나 들을 수 있어요. 언제든 내릴 수 있어요" },
};

export function PrivacyTag({ kind, compact = false }: { kind: PrivacyKind; compact?: boolean }) {
  const c = COPY[kind];
  const tone = kind === "public" || kind === "link" ? styles.open : kind === "unsaved" ? styles.temp : styles.closed;
  if (compact) {
    return (
      <span className={`${styles.chip} ${tone}`} title={c.sub}>
        <span aria-hidden="true">{c.icon}</span> {c.label}
      </span>
    );
  }
  return (
    <p className={`${styles.tag} ${tone}`}>
      <span className={styles.icon} aria-hidden="true">
        {c.icon}
      </span>
      <span>
        <b>{c.label}</b>
        <small>{c.sub}</small>
      </span>
    </p>
  );
}
