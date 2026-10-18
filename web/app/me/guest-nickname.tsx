"use client";

import { useEffect, useState } from "react";
import { cleanNickname, NICK_MAX, nicknameProblem, readNickname, writeNickname } from "@/lib/nickname";
import styles from "./me.module.css";

/**
 * 손님 닉네임 — 로그인 없이 출전할 때 순위에 보일 이름. 이 기기에만 적어 둔다.
 * 이미 나가 있는 출전작은 다음에 출전·교체할 때 이 이름으로 바뀐다.
 */
export function GuestNickname() {
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
      setError(nicknameProblem(value));
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
          <small>닉네임</small>
          <b>{saved || "아직 없어요 · 익명의 목소리"}</b>
        </span>
        {!editing && (
          <button type="button" className={styles.nickEdit} onClick={() => setEditing(true)}>
            {saved ? "바꾸기" : "정하기"}
          </button>
        )}
      </div>
      {editing && (
        <div className={styles.nickForm}>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={NICK_MAX}
            placeholder="순위에 보일 이름"
            autoComplete="nickname"
            autoFocus
          />
          <button type="button" className={styles.nickSave} onClick={save}>
            저장
          </button>
        </div>
      )}
      {error && <p className={styles.nickError}>{error}</p>}
      <p className={styles.nickNote}>챌린지에 출전하면 이 이름으로 보여요 · 이 폰에만 저장 · 로그인하면 계정 닉네임을 써요</p>
    </section>
  );
}
