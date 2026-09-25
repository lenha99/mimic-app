"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { VoiceAvatar } from "@/components/voice-avatar";
import {
  AVATAR_OPTIONS,
  OPTION_LABELS,
  PART_LABELS,
  type Avatar,
  type AvatarPart,
} from "@/lib/avatar";
import { createClient } from "@/lib/supabase/client";
import styles from "./profile.module.css";

const PARTS = Object.keys(AVATAR_OPTIONS) as AvatarPart[];

/**
 * 내 목소리 캐릭터 고르기.
 *
 * 고르는 동안 캐릭터가 가만히 있으면 "이게 내 목소리로 움직인다"는 게 안 보인다.
 * 그래서 하나 바꿀 때마다 잠깐 외쳐 보인다.
 */
export function AvatarEditor({ userId, initial }: { userId: string; initial: Avatar }) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<Avatar>(initial);
  const [level, setLevel] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const raf = useRef(0);

  const shout = () => {
    cancelAnimationFrame(raf.current);
    let start = -1;
    const loop = (now: number) => {
      if (start < 0) start = now;
      const t = (now - start) / 1000;
      if (t > 1.1) {
        setLevel(0);
        return;
      }
      // "야~호" 두 음절처럼 두 번 벌린다.
      setLevel(Math.max(0, Math.sin(t * Math.PI * 1.9)) * (1 - t * 0.5));
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
  };

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const choose = <K extends AvatarPart>(part: K, value: Avatar[K]) => {
    setAvatar((prev) => ({ ...prev, [part]: value }));
    setMessage(null);
    shout();
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await createClient().from("profiles").update({ avatar }).eq("id", userId);
    setSaving(false);
    if (error) {
      setMessage("저장에 실패했어요. 다시 시도해주세요.");
      return;
    }
    setMessage("저장했어요. 이제 이 캐릭터가 네 목소리로 외쳐요.");
    router.refresh();
  };

  const dirty = PARTS.some((p) => avatar[p] !== initial[p]);

  return (
    <div className={styles.card}>
      <div className="eyebrow">내 목소리 캐릭터</div>
      <button type="button" className={styles.avatarStage} onClick={shout} aria-label="캐릭터 외쳐보기">
        <VoiceAvatar avatar={avatar} level={level} size={140} />
      </button>

      {PARTS.map((part) => (
        <div key={part} className={styles.partRow}>
          <span className={styles.partLabel}>{PART_LABELS[part]}</span>
          <div className={styles.chips}>
            {AVATAR_OPTIONS[part].map((value) => (
              <button
                key={value}
                type="button"
                className={`${styles.chip} ${avatar[part] === value ? styles.chipOn : ""}`}
                aria-pressed={avatar[part] === value}
                onClick={() => choose(part, value as Avatar[typeof part])}
              >
                {OPTION_LABELS[value] ?? value}
              </button>
            ))}
          </div>
        </div>
      ))}

      {message && <p className={styles.hint}>{message}</p>}
      <button onClick={save} disabled={saving || !dirty} className={styles.save}>
        {saving ? "저장 중..." : "캐릭터 저장"}
      </button>
    </div>
  );
}
