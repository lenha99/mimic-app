"use client";

import { useEffect, useState } from "react";
import { cleanNickname, NICK_MAX, nicknameProblem, readNickname, writeNickname } from "@/lib/nickname";
import { useLang, useT } from "@/components/lang";
import styles from "./me.module.css";

/**
 * 손님 닉네임 — 로그인 없이 출전할 때 순위에 보일 이름. 이 기기에만 적어 둔다.
 * 이미 나가 있는 출전작은 다음에 출전·교체할 때 이 이름으로 바뀐다.
 */
export function GuestNickname() {
  const t = useT();
  const lang = useLang();
  const [saved, setSaved] = useState("");
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const n = readNickname();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaved(n);
    setValue(n);
  }, []);

  const save = () => {
    if (value.trim() && !cleanNickname(value)) {
      setError(nicknameProblem(value, lang));
      return;
    }
    writeNickname(value);
    setSaved(cleanNickname(value) ?? "");
    setError(null);
    setEditing(false);
  };

  return (
    <section className={styles.nick} data-tour="me-nickname">
      <div className={styles.nickHead}>
        <span>
          <small>{t("닉네임", "Nickname")}</small>
          <b>{saved || t("아직 없어요 · 익명의 목소리", "Not set · Anonymous voice")}</b>
        </span>
        {!editing && (
          <button type="button" className={styles.nickEdit} onClick={() => setEditing(true)}>
            {saved ? t("바꾸기", "Change") : t("정하기", "Set")}
          </button>
        )}
      </div>
      {editing && (
        <div className={styles.nickForm}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={NICK_MAX}
            placeholder={t("순위에 보일 이름", "Name on the leaderboard")}
            autoComplete="nickname"
            autoFocus
          />
          <button type="button" className={styles.nickSave} onClick={save}>
            {t("저장", "Save")}
          </button>
        </div>
      )}
      {error && <p className={styles.nickError}>{error}</p>}
      <p className={styles.nickNote}>
        {t(
          "챌린지에 출전하면 이 이름으로 보여요 · 이 폰에만 저장 · 로그인하면 계정 닉네임을 써요",
          "Shown when you enter challenges · saved on this phone · logged-in users use their account nickname",
        )}
      </p>
    </section>
  );
}
