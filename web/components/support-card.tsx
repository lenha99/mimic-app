"use client";

import { useState } from "react";
import { useT } from "@/components/lang";
import styles from "./support-card.module.css";

/** 운영자 후원 계좌 — "나" 탭 맨 아래. 광고·결제 없이 돌아가는 앱이라 계좌 한 줄과 복사 버튼만. */
const BANK = "카카오뱅크";
const ACCOUNT = "3333088303373";
const HOLDER = "권규민";
const SHOWN = "3333-08-8303373";

export function SupportCard() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${BANK} ${ACCOUNT} ${HOLDER}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("길게 눌러 복사해 주세요", "Copy this"), `${BANK} ${ACCOUNT}`);
    }
  };
  return (
    <section className={styles.card} aria-label={t("운영자 후원", "Support the maker")}>
      <b className={styles.title}>☕ {t("운영자 후원 부탁드립니다", "Support the maker")}</b>
      <p className={styles.body}>
        {t(
          "MIMIC 은 광고·결제 없이 혼자 만들고 있어요. 서버비에 보태 주시면 더 오래, 더 재밌게 만들게요.",
          "MIMIC runs with no ads or payments, made by one person. Any support helps keep the servers on.",
        )}
      </p>
      <button type="button" className={styles.account} onClick={copy}>
        <span>
          {BANK} <b>{SHOWN}</b> {HOLDER}
        </span>
        <small>{copied ? t("✓ 복사됨", "✓ Copied") : t("복사", "Copy")}</small>
      </button>
    </section>
  );
}
