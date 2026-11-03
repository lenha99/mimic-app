"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { VoiceAvatar } from "@/components/voice-avatar";
import {
  AVATAR_COLORS,
  AVATAR_OPTIONS,
  DEFAULT_AVATAR,
  HAIR_COLORS,
  OPTION_LABELS,
  OPTION_LABELS_EN,
  PART_LABELS_EN,
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
import { refreshViewer } from "@/components/viewer";
import { createClient } from "@/lib/supabase/client";
import { ScreenTour } from "@/components/onboarding/tours";
import { TourHelp } from "@/components/onboarding/tour";
import { useLang, useT } from "@/components/lang";
import styles from "./studio.module.css";

type Who = { userId: string | null; ready: boolean };

/** 색은 작은 얼굴보다 동그란 색 칩이 빨리 읽힌다. */
const SWATCHES: Partial<Record<AvatarPart, Record<string, string>>> = {
  color: AVATAR_COLORS,
  hairColor: HAIR_COLORS,
};

/** 프리셋 줄은 코코부터 — 목록 순서(PRESETS)는 다른 화면이 번호로 집으니 건드리지 않는다. */
const PRESET_ORDER = [...PRESETS].sort((a, b) => Number(b.name === "코코") - Number(a.name === "코코"));

const SAME = (a: Avatar, b: Avatar) => (Object.keys(a) as AvatarPart[]).every((k) => a[k] === b[k]);

/**
 * 캐릭터 스튜디오.
 *
 * 고르는 동안 캐릭터가 가만히 있으면 "이게 내 목소리로 움직인다"가 안 보인다.
 * 그래서 뭘 바꿀 때마다 통 튀어 오르며 잠깐 외쳐 보인다. 선택지도 글자 대신 그 파츠를
 * 낀 작은 캐릭터로 보여준다 — "뽀글 파마"라는 말보다 뽀글 파마를 한 얼굴이 빠르다.
 */
export function AvatarStudio() {
  const t = useT();
  const lang = useLang();
  const [avatar, setAvatar] = useState<Avatar>(DEFAULT_AVATAR);
  const [saved, setSaved] = useState<Avatar>(DEFAULT_AVATAR);
  const [who, setWho] = useState<Who>({ userId: null, ready: false });
  const [group, setGroup] = useState(0);
  const [level, setLevel] = useState(0);
  const [hop, setHop] = useState(0);
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
    setHop((h) => h + 1);
    let start = -1;
    const loop = (now: number) => {
      if (start < 0) start = now;
      const s = (now - start) / 1000;
      if (s > 1.2) {
        setLevel(0);
        return;
      }
      // "무야~"(짧게) → "호!"(크게)
      const hump = (from: number, len: number, peak: number) =>
        s >= from && s < from + len ? Math.sin(((s - from) / len) * Math.PI) * peak : 0;
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

  const dirty = !SAME(avatar, saved);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    writeLocalAvatar(avatar);
    if (!who.userId) {
      setSaved(avatar);
      setSaving(false);
      void refreshViewer();
      setMessage(t("이 폰에 저장했어요. 녹음하면 이 캐릭터가 외쳐요!", "Saved on this phone. It'll shout when you record!"));
      return;
    }
    const { error } = await createClient().from("profiles").update({ avatar }).eq("id", who.userId);
    setSaving(false);
    if (error) {
      setMessage(t("저장이 안 됐어요. 다시 시도해 주세요.", "Couldn't save. Please try again."));
      return;
    }
    setSaved(avatar);
    void refreshViewer(); // 홈 헤더·히어로가 바로 새 캐릭터로
    setMessage(t("저장 완료! 녹음·투표·랭킹에 이 캐릭터로 나와요.", "Saved! This character shows up in recordings, votes and rankings."));
  };

  const labels = lang === "en" ? OPTION_LABELS_EN : OPTION_LABELS;
  const parts = PART_GROUPS[group].parts;
  const bodyName = labels.body[avatar.body];

  return (
    <div className={styles.studio}>
      <TourHelp id="avatar" corner />
      <ScreenTour id="avatar" />
      <header className={styles.head}>
        <h1>{t("내 캐릭터", "My character")}</h1>
        <p>{t("녹음하면 이 친구가 내 목소리로 외쳐요", "It shouts in your voice when you record")}</p>
      </header>

      <div className={styles.stage}>
        <span className={styles.bubble} aria-hidden>
          {level > 0.05 ? t("무야호~!", "Woohoo~!") : t(`나는 ${bodyName}!`, `I'm ${bodyName}!`)}
        </span>
        <button
          type="button"
          className={styles.preview}
          onClick={shout}
          aria-label={t("캐릭터 외쳐 보기", "Make it shout")}
          data-tour="avatar-preview"
        >
          <span key={hop} className={hop ? styles.hop : undefined}>
            <VoiceAvatar avatar={avatar} level={level} size={200} />
          </span>
        </button>
        <div className={styles.stageActions}>
          <button type="button" className={styles.ghostBtn} onClick={shout}>
            {t("📣 외쳐 보기", "📣 Shout")}
          </button>
          <button type="button" className={`${styles.ghostBtn} ${styles.dice}`} onClick={() => apply(randomAvatar())}>
            {t("🎲 랜덤", "🎲 Random")}
          </button>
          {dirty && (
            <button type="button" className={styles.ghostBtn} onClick={() => apply(saved)} aria-label={t("저장한 걸로 되돌리기", "Undo changes")}>
              ↺
            </button>
          )}
        </div>
      </div>

      <section className={styles.presets} aria-label={t("바로 쓰는 캐릭터", "Ready-made characters")} data-tour="avatar-presets">
        {PRESET_ORDER.map((p) => {
          const on = SAME(p.avatar, avatar);
          return (
            <button
              key={p.name}
              type="button"
              aria-pressed={on}
              className={`${styles.preset} ${on ? styles.presetOn : ""}`}
              onClick={() => apply(p.avatar)}
            >
              <VoiceAvatar avatar={p.avatar} size={58} />
              <span>{t(p.name, p.nameEn)}</span>
            </button>
          );
        })}
      </section>

      <nav className={styles.tabs} role="tablist" data-tour="avatar-tabs">
        {PART_GROUPS.map((g, i) => (
          <button
            key={g.label}
            type="button"
            role="tab"
            aria-selected={i === group}
            className={`${styles.tab} ${i === group ? styles.tabOn : ""}`}
            onClick={() => setGroup(i)}
          >
            <span className={styles.tabIcon} aria-hidden>
              {g.icon}
            </span>
            {t(g.label, g.labelEn)}
          </button>
        ))}
      </nav>

      <div key={group} className={styles.panel}>
        {parts.map((part) => {
          const swatch = SWATCHES[part];
          return (
            <section key={part} className={styles.part}>
              <h2>
                {t(PART_LABELS[part], PART_LABELS_EN[part])}
                <em>{labels[part][avatar[part]]}</em>
              </h2>
              {swatch ? (
                <div className={styles.swatches}>
                  {AVATAR_OPTIONS[part].map((value) => {
                    const on = avatar[part] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={on}
                        aria-label={labels[part][value] ?? value}
                        title={labels[part][value] ?? value}
                        className={`${styles.swatch} ${on ? styles.swatchOn : ""}`}
                        style={{ background: swatch[value] }}
                        onClick={() => choose(part, value as Avatar[typeof part])}
                      />
                    );
                  })}
                </div>
              ) : (
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
                        <VoiceAvatar avatar={{ ...avatar, [part]: value }} size={60} />
                        <span>{labels[part][value] ?? value}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className={styles.dock}>
        {message && <p className={styles.message}>{message}</p>}
        {who.ready && !who.userId && (
          <p className={styles.note}>
            {t(
              <>
                지금은 이 폰에만 저장돼요. <Link href="/login">로그인</Link>하면 투표·랭킹에도 이 캐릭터로 나와요.
              </>,
              <>
                Saved on this phone only. <Link href="/login">Log in</Link> to use it in votes and rankings too.
              </>,
            )}
          </p>
        )}
        <button
          type="button"
          className={styles.save}
          onClick={save}
          disabled={saving || !dirty || !who.ready}
          data-tour="avatar-save"
        >
          {saving ? t("저장 중…", "Saving…") : dirty ? t("이 캐릭터로 저장하기", "Save this character") : t("저장됨 ✓", "Saved ✓")}
        </button>
      </div>
    </div>
  );
}
