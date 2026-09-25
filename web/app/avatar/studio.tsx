"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { VoiceAvatar } from "@/components/voice-avatar";
import {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  OPTION_LABELS,
  PART_GROUPS,
  PART_LABELS,
  PRESETS,
  normalizeAvatar,
  randomAvatar,
  readLocalAvatar,
  writeLocalAvatar,
  type Avatar,
  type AvatarPart,
} from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";
import styles from "./studio.module.css";

type Who = { userId: string | null; ready: boolean };

/**
 * 캐릭터 스튜디오.
 *
 * 고르는 동안 캐릭터가 가만히 있으면 "이게 내 목소리로 움직인다"가 안 보인다.
 * 그래서 뭘 바꿀 때마다 잠깐 외쳐 보인다. 선택지도 글자 대신 그 파츠를 낀 작은
 * 캐릭터로 보여준다 — "뽀글 파마"라는 말보다 뽀글 파마를 한 얼굴이 빠르다.
 */
export function AvatarStudio() {
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [saved, setSaved] = useState<Avatar>(DEFAULT_AVATAR);
  const [who, setWho] = useState<Who>({ userId: null, ready: false });
  const [group, setGroup] = useState(0);
  const [level, setLevel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const raf = useRef(0);

  // 처음 열 때: 로그인했으면 계정의 캐릭터(아직 없으면 로그인 전에 꾸민 것), 아니면 이 브라우저의 것.
  useEffect(() => {
    let alive = true;
    void (async () => {
      let start = readLocalAvatar() ?? DEFAULT_AVATAR;
      let userId: string | null = null;
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
          const { data } = await supabase.from("profiles").select("avatar").eq("id", user.id).maybeSingle();
          const stored = data?.avatar as Record<string, unknown> | undefined;
          if (stored && Object.keys(stored).length > 0) start = normalizeAvatar(stored);
        }
      } catch {
        // 오프라인이면 이 브라우저의 것으로 시작한다.
      }
      if (!alive) return;
      setAvatar(start);
      setSaved(userId ? start : (readLocalAvatar() ?? DEFAULT_AVATAR));
      setWho({ userId, ready: true });
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const shout = () => {
    cancelAnimationFrame(raf.current);
    let start = -1;
    const loop = (now: number) => {
      if (start < 0) start = now;
      const t = (now - start) / 1000;
      if (t > 1.2) {
        setLevel(0);
        return;
      }
      // "무야~"(짧게) → "호!"(크게)
      const hump = (from: number, len: number, peak: number) =>
        t >= from && t < from + len ? Math.sin(((t - from) / len) * Math.PI) * peak : 0;
      setLevel(hump(0, 0.4, 0.55) + hump(0.5, 0.6, 1));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  const apply = (next: Avatar) => {
    setAvatar(next);
    setMessage(null);
    shout();
  };

  const choose = <K extends AvatarPart>(part: K, value: Avatar[K]) => apply({ ...avatar, [part]: value });

  const dirty = (Object.keys(avatar) as AvatarPart[]).some((k) => avatar[k] !== saved[k]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    writeLocalAvatar(avatar);
    if (!who.userId) {
      setSaved(avatar);
      setSaving(false);
      setMessage("이 폰에 저장했어요. 녹음하면 이 캐릭터가 외쳐요.");
      return;
    }
    const { error } = await createClient().from("profiles").update({ avatar }).eq("id", who.userId);
    setSaving(false);
    if (error) {
      setMessage("저장에 실패했어요. 다시 시도해주세요.");
      return;
    }
    setSaved(avatar);
    setMessage("저장했어요! 녹음·투표·랭킹에 이 캐릭터로 나와요.");
  };

  const parts = PART_GROUPS[group].parts;

  return (
    <div className={styles.studio}>
      <header className={styles.head}>
        <h1>내 캐릭터</h1>
        <p>녹음하면 이 녀석이 네 목소리로 외쳐</p>
      </header>

      <div className={styles.stage}>
        <button type="button" className={styles.preview} onClick={shout} aria-label="캐릭터 외쳐보기">
          <VoiceAvatar avatar={avatar} level={level} size={184} />
        </button>
        <div className={styles.stageActions}>
          <button type="button" className={styles.ghostBtn} onClick={shout}>
            📣 외쳐보기
          </button>
          <button type="button" className={styles.ghostBtn} onClick={() => apply(randomAvatar())}>
            🎲 랜덤
          </button>
        </div>
      </div>

      <section className={styles.presets} aria-label="바로 쓰는 캐릭터">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" className={styles.preset} onClick={() => apply(p.avatar)}>
            <VoiceAvatar avatar={p.avatar} size={58} />
            <span>{p.name}</span>
          </button>
        ))}
      </section>

      <nav className={styles.tabs} role="tablist">
        {PART_GROUPS.map((g, i) => (
          <button
            key={g.label}
            type="button"
            role="tab"
            aria-selected={i === group}
            className={`${styles.tab} ${i === group ? styles.tabOn : ""}`}
            onClick={() => setGroup(i)}
          >
            {g.label}
          </button>
        ))}
      </nav>

      {parts.map((part) => (
        <section key={part} className={styles.part}>
          <h2>{PART_LABELS[part]}</h2>
          <div className={styles.options}>
            {AVATAR_OPTIONS[part].map((value) => {
              const on = avatar[part] === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  className={`${styles.option} ${on ? styles.optionOn : ""}`}
                  onClick={() => choose(part, value as Avatar[typeof part])}
                >
                  <VoiceAvatar avatar={{ ...avatar, [part]: value }} size={52} />
                  <span>{OPTION_LABELS[part][value] ?? value}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <div className={styles.dock}>
        {message && <p className={styles.message}>{message}</p>}
        {who.ready && !who.userId && (
          <p className={styles.note}>
            지금은 이 폰에만 저장돼요.{" "}
            <Link href="/login">로그인</Link>하면 투표·랭킹에도 이 캐릭터로 나와요.
          </p>
        )}
        <button type="button" className={styles.save} onClick={save} disabled={saving || !dirty || !who.ready}>
          {saving ? "저장 중…" : dirty ? "이 캐릭터로 저장" : "저장됨 ✓"}
        </button>
      </div>
    </div>
  );
}
