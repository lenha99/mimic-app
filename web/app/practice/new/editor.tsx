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
    const insert = kind === "pause" ? " / " : `*${picked || "강조할 말"}*`;
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
    const problem = checkDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    try {
      const id = saveMine(draft, editId ?? undefined);
      router.replace(`/practice/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장하지 못했어요.");
    }
  };

  const remove = async () => {
    if (!editId) return;
    if (!window.confirm("이 대본과 이 대본으로 녹음한 테이크를 모두 지울까요?")) return;
    deleteMine(editId);
    await deleteItemTakes(editId);
    router.replace("/practice?tab=mine");
  };

  if (missing) {
    return (
      <main className={`shell ${styles.page}`}>
        <Link href="/practice?tab=mine" className={styles.back}>
          ← 연습실
        </Link>
        <h1 className={styles.h1}>이 기기에 없는 대본이에요</h1>
        <p className={styles.lede}>내 대본은 만든 폰(브라우저)에만 저장돼요.</p>
      </main>
    );
  }

  return (
    <main className={`shell ${styles.page}`}>
      <Link href="/practice?tab=mine" className={styles.back}>
        ← 연습실
      </Link>
      <h1 className={styles.h1}>{editId ? "내 대본 고치기" : "내 대본 넣기"}</h1>
      <p className={styles.lede}>
        오디션·학원 대본을 붙여넣으면 다른 대본과 똑같이 속도·쉼·억양을 짚어줘요. 대본은 이 폰에만
        저장되고 서버로 안 가요.
      </p>

      <label className={styles.field}>
        <span>제목</span>
        <input
          value={draft.title}
          onChange={(e) => set("title", e.target.value)}
          maxLength={MAX_TITLE}
          placeholder="예: 3차 오디션 지정 대본"
        />
      </label>

      <fieldset className={styles.field}>
        <legend>종류</legend>
        <Segment<Track>
          value={draft.track}
          onChange={(v) => set("track", v)}
          options={[
            ["voice", "성우 연기"],
            ["anchor", "아나운서·낭독"],
          ]}
        />
      </fieldset>

      <div className={styles.field}>
        <div className={styles.textHead}>
          <span>대본</span>
          <span className={styles.tools}>
            <button type="button" onClick={() => mark("pause")}>
              / 쉼 넣기
            </button>
            <button type="button" onClick={() => mark("strong")}>
              <b>강조</b>
            </button>
          </span>
        </div>
        <textarea
          ref={area}
          value={draft.text}
          onChange={(e) => set("text", e.target.value)}
          rows={10}
          placeholder={"여기에 붙여넣기\n\n빈 줄로 단락을 나누고, / 는 쉬는 곳, *말* 은 힘줄 곳이에요."}
          aria-describedby="count"
        />
        <p id="count" className={over ? styles.countOver : styles.count}>
          한글 {syl} / {MAX_SYLLABLES}자 · 쉼 {pauseMarks(draft.text)}곳 · 약 {seconds}초
        </p>
        {hasNonHangul(draft.text) && (
          <p className={styles.note}>
            숫자·영어가 있어요. 읽는 대로 한글로 풀어 쓰면(예: 3시 → 세 시) 속도를 더 정확히 재요.
          </p>
        )}
      </div>

      <fieldset className={styles.field}>
        <legend>목표 속도</legend>
        <Segment<PaceKey>
          value={draft.pace}
          onChange={(v) => set("pace", v)}
          options={(Object.keys(PACE_PRESETS) as PaceKey[]).map((k) => [k, PACE_PRESETS[k].label])}
        />
      </fieldset>

      <fieldset className={styles.field}>
        <legend>억양 폭</legend>
        <Segment<PitchBand>
          value={draft.pitch}
          onChange={(v) => set("pitch", v)}
          options={[
            ["low", "절제"],
            ["mid", "보통"],
            ["high", "크게"],
          ]}
        />
      </fieldset>

      <label className={styles.field}>
        <span>
          디렉션 <small>선택</small>
        </span>
        <input
          value={draft.direction}
          onChange={(e) => set("direction", e.target.value)}
          maxLength={MAX_DIRECTION}
          placeholder="예: 담담하게 시작해서 마지막 문장만 무너진다"
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.dock}>
        <button type="button" className={styles.save} onClick={save}>
          {editId ? "고친 대로 저장" : "저장하고 바로 읽기"}
        </button>
      </div>

      {editId && (
        <button type="button" className={styles.remove} onClick={remove}>
          이 대본 지우기
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
