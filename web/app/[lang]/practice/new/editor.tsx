"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  checkDraft,
  deleteMine,
  getMine,
  hasNonHangul,
  MAX_CHARS,
  MAX_DIRECTION,
  MAX_SYLLABLES,
  MAX_TITLE,
  PACE_PRESETS,
  saveMine,
  toDraft,
  type Draft,
  type PaceKey,
} from "@/lib/my-scripts";
import { pauseMarks, syllables, type PitchBand, type Track } from "@/lib/practice";
import { deleteItemTakes } from "@/lib/take-store";
import { useLang, useT } from "@/components/lang";
import styles from "./editor.module.css";

/**
 * 내 대본 넣기·고치기.
 *
 * 지망생이 실제로 들고 오는 건 학원 교재·오디션 지정 대본이다. 붙여넣고 바로 읽을 수
 * 있어야 해서 필수는 제목과 대본 둘뿐이고, 쉼(/)·강조(*말*)는 버튼으로 넣는다.
 * 속도·억양 기준은 세 단계 중에서 고른다 — 음절/초 숫자를 직접 적으라고 하면 아무도 안 적는다.
 */

const EMPTY: Draft = { title: "", track: "voice", pace: "mid", pitch: "mid", direction: "", text: "" };

export function ScriptEditor() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editId) return;
    const cur = getMine(editId);
    // 고치기로 들어오면 저장된 값으로 채운다. 기기 저장소라 붙은 뒤에만 읽힌다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cur) setDraft(toDraft(cur));
    else setMissing(true);
  }, [editId]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setError(null);
  };

  /** 커서 자리에 쉼 표시를 넣거나, 고른 글자를 강조로 감싼다. */
  const mark = (kind: "pause" | "strong") => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b, value } = el;
    const picked = value.slice(a, b);
    const insert = kind === "pause" ? " / " : `*${picked || t("강조할 말", "stress")}*`;
    const next = value.slice(0, a) + insert + value.slice(b);
    set("text", next);
    requestAnimationFrame(() => {
      el.focus();
      const at = kind === "strong" && !picked ? a + 1 : a + insert.length;
      el.setSelectionRange(at, kind === "strong" && !picked ? at + 5 : at);
    });
  };

  const syl = syllables(draft.text);
  const pace = PACE_PRESETS[draft.pace].pace;
  const seconds = syl ? Math.round(syl / ((pace[0] + pace[1]) / 2)) : 0;
  const over = syl > MAX_SYLLABLES || draft.text.length > MAX_CHARS;

  const save = () => {
    const problem = checkDraft(draft, lang);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const id = saveMine(draft, editId ?? undefined, lang);
      router.replace(`/practice/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("저장이 안 됐어요. 다시 시도해 주세요", "Couldn't save. Please try again"));
    }
  };

  const remove = async () => {
    if (!editId) return;
    if (!window.confirm(t("이 대본과 이 대본으로 녹음한 테이크를 모두 지울까요?", "Delete this script and all takes recorded with it?"))) return;
    deleteMine(editId);
    await deleteItemTakes(editId);
    router.replace("/practice?tab=mine");
  };

  if (missing) {
    return (
      <main className={`shell ${styles.page}`}>
        <Link href="/practice?tab=mine" className={styles.back}>
          {t("← 연습실", "← Practice")}
        </Link>
        <h1 className={styles.h1}>{t("이 기기에 없는 대본이에요", "This script isn't on this device")}</h1>
        <p className={styles.lede}>{t("내 대본은 만든 폰(브라우저)에만 저장돼요.", "Your scripts live only on the phone (browser) where you made them.")}</p>
      </main>
    );
  }

  return (
    <main className={`shell ${styles.page}`}>
      <Link href="/practice?tab=mine" className={styles.back}>
        {t("← 연습실", "← Practice")}
      </Link>
      <h1 className={styles.h1}>{editId ? t("내 대본 고치기", "Edit my script") : t("내 대본 넣기", "Add my script")}</h1>
      <p className={styles.lede}>
        {t(
          "오디션·학원 대본을 붙여넣으면 다른 대본처럼 속도·쉼·억양을 똑같이 짚어드려요. 대본은 이 폰에만 저장되고 서버로 가지 않아요.",
          "Paste an audition or class script (Korean) and get the same notes on pace, pauses and intonation. It stays on this phone — never sent to our server.",
        )}
      </p>

      <label className={styles.field}>
        <span>{t("제목", "Title")}</span>
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={MAX_TITLE}
          placeholder={t("예: 3차 오디션 지정 대본", "e.g. Round 3 audition script")}
        />
      </label>

      <fieldset className={styles.field}>
        <legend>{t("종류", "Type")}</legend>
        <Segment<Track>
          value={draft.track}
          onChange={(v) => set("track", v)}
          options={[
            ["voice", t("성우 연기", "Voice acting")],
            ["anchor", t("아나운서·낭독", "Anchor & reading")],
          ]}
        />
      </fieldset>

      <div className={styles.field}>
        <div className={styles.textHead}>
          <span>{t("대본", "Script")}</span>
          <span className={styles.tools}>
            <button type="button" onClick={() => mark("pause")}>
              {t("/ 쉼 넣기", "/ Add pause")}
            </button>
            <button type="button" onClick={() => mark("strong")}>
              <b>{t("강조", "Stress")}</b>
            </button>
          </span>
        </div>
        <textarea
          ref={area}
          value={draft.text}
          onChange={(e) => set("text", e.target.value)}
          rows={10}
          placeholder={t(
            "여기에 붙여넣기\n\n빈 줄로 단락을 나누고, / 는 쉬는 곳, *말* 은 힘줄 곳이에요.",
            "Paste here\n\nBlank line = new paragraph, / = pause, *word* = stress.",
          )}
          aria-describedby="count"
        />
        <p id="count" className={over ? styles.countOver : styles.count}>
          {t(
            `한글 ${syl} / ${MAX_SYLLABLES}자 · 쉼 ${pauseMarks(draft.text)}곳 · 약 ${seconds}초`,
            `${syl} / ${MAX_SYLLABLES} syllables · ${pauseMarks(draft.text)} pauses · ~${seconds}s`,
          )}
        </p>
        {hasNonHangul(draft.text) && (
          <p className={styles.note}>
            {t(
              "숫자·영어가 있어요. 읽는 대로 한글로 풀어 쓰면(예: 3시 → 세 시) 속도를 더 정확히 잴 수 있어요.",
              "Numbers or Latin letters found. Spell them out in Hangul as spoken (e.g. 3시 → 세 시) for accurate pace.",
            )}
          </p>
        )}
      </div>

      <fieldset className={styles.field}>
        <legend>{t("목표 속도", "Target pace")}</legend>
        <Segment<PaceKey>
          value={draft.pace}
          onChange={(v) => set("pace", v)}
          options={(Object.keys(PACE_PRESETS) as PaceKey[]).map((k) => [k, t(PACE_PRESETS[k].label, PACE_PRESETS[k].labelEn)])}
        />
      </fieldset>

      <fieldset className={styles.field}>
        <legend>{t("억양 폭", "Pitch range")}</legend>
        <Segment<PitchBand>
          value={draft.pitch}
          onChange={(v) => set("pitch", v)}
          options={[
            ["low", t("절제", "Restrained")],
            ["mid", t("보통", "Natural")],
            ["high", t("크게", "Expressive")],
          ]}
        />
      </fieldset>

      <label className={styles.field}>
        <span>
          {t("디렉션", "Direction")} <small>{t("선택", "optional")}</small>
        </span>
        <input
          value={draft.direction}
          onChange={(e) => set("direction", e.target.value)}
          maxLength={MAX_DIRECTION}
          placeholder={t("예: 담담하게 시작해서 마지막 문장만 무너진다", "e.g. Start calm, break down only on the last line")}
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.dock}>
        <button type="button" className={styles.save} onClick={save}>
          {editId ? t("고친 대로 저장하기", "Save changes") : t("저장하고 바로 읽어 보기", "Save & start reading")}
        </button>
      </div>

      {editId && (
        <button type="button" className={styles.remove} onClick={remove}>
          {t("이 대본 지우기", "Delete this script")}
        </button>
      )}
    </main>
  );
}

function Segment<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: [T, string][];
}) {
  return (
    <div className={styles.segment} role="radiogroup">
      {options.map(([k, label]) => (
        <button
          key={k}
          type="button"
          role="radio"
          aria-checked={value === k}
          className={value === k ? styles.segOn : styles.seg}
          onClick={() => onChange(k)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
