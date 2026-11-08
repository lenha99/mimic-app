"use client";

import { useState } from "react";
import { useLang, useT } from "@/components/lang";
import { SFX } from "@/lib/relay";
import { playSfx } from "./audio";
import s from "./relay.module.css";

/**
 * 효과음 아이콘 — 이모지 대신 같은 굵기·같은 모서리로 그린 SVG 8개.
 * 소리마다 색이 하나씩 있어서, 대본 사이 "효과음 줄"에서도 한눈에 구분된다.
 */
const COLOR: Record<string, string> = {
  boom: "#ff7a45",
  heart: "#ff5d8f",
  whoosh: "#7cc8f2",
  ding: "#ffc93c",
  thunder: "#b79cff",
  drum: "#ff9d3c",
  door: "#c9a27a",
  sparkle: "#8fd96b",
};

export const sfxColor = (id: string) => COLOR[id] ?? "#ffc93c";

function Glyph({ id }: { id: string }) {
  switch (id) {
    case "boom":
      return (
        <>
          <path d="M12 2.5l1.9 4.6 4.6-2.2-1.6 4.8 4.9 1.1-4.3 2.7 3 4-5-.6.2 5-3.7-3.4L8.3 22l.2-5-5 .6 3-4-4.3-2.7 4.9-1.1-1.6-4.8 4.6 2.2z" fill="currentColor" fillOpacity=".22" />
          <path d="M12 9.2l.9 2 2-.6-.8 2 1.7 1.2-2 .4.2 2.1-2-1.2-2 1.2.2-2.1-2-.4 1.7-1.2-.8-2 2 .6z" fill="currentColor" stroke="none" />
        </>
      );
    case "heart":
      return (
        <>
          <path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0112 7.3a4.3 4.3 0 017.5 2.5C19.5 15.4 12 20 12 20z" fill="currentColor" fillOpacity=".22" />
          <path d="M3 12.5h4.2l1.6-3 2.4 6 1.8-4.2 1 1.2H21" />
        </>
      );
    case "whoosh":
      return (
        <>
          <path d="M3 8h11a3 3 0 10-3-3" />
          <path d="M3 12h15a3 3 0 11-3 3" />
          <path d="M3 16h7" />
        </>
      );
    case "ding":
      return (
        <>
          <path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z" fill="currentColor" fillOpacity=".22" />
          <path d="M10 21h4" />
          <path d="M12 3v2" />
          <path d="M2.8 9.2l1.6.6M21.2 9.2l-1.6.6" />
        </>
      );
    case "thunder":
      return (
        <>
          <path d="M7 14a3.8 3.8 0 01.4-7.6 4.6 4.6 0 018.9 1.2A3.2 3.2 0 0116.8 14H7z" fill="currentColor" fillOpacity=".22" />
          <path d="M12.5 14l-2.3 3.6h3.3L11.6 22" />
        </>
      );
    case "drum":
      return (
        <>
          <ellipse cx="12" cy="11" rx="8" ry="3" fill="currentColor" fillOpacity=".22" />
          <path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6" />
          <path d="M8 13.8v6M16 13.8v6" />
          <path d="M5 3l5.5 6M19 3l-5.5 6" />
        </>
      );
    case "door":
      return (
        <>
          <path d="M6 21V4a1 1 0 011-1h8a1 1 0 011 1v17" fill="currentColor" fillOpacity=".22" />
          <path d="M3.5 21h14" />
          <path d="M13 12.5v.5" />
          <path d="M19 8l2.5-1.5M19.5 12h2.5M19 16l2.5 1.5" />
        </>
      );
    case "sparkle":
      return (
        <>
          <path d="M10 3l1.8 5.2L17 10l-5.2 1.8L10 17l-1.8-5.2L3 10l5.2-1.8z" fill="currentColor" fillOpacity=".22" />
          <path d="M18 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8zM18.5 3.5l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L16.5 5.5 18 5z" fill="currentColor" stroke="none" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="7" />;
  }
}

export function SfxIcon({ id, size = 22 }: { id: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: sfxColor(id), flex: "none" }}
      aria-hidden="true"
    >
      <Glyph id={id} />
    </svg>
  );
}

/** 대본 줄 사이에 끼는 효과음 표시 — 누르면 그 소리를 들려준다 */
export function SfxCue({ id, onEdit }: { id: string; onEdit?: () => void }) {
  const t = useT();
  const ko = useLang() === "ko";
  const x = SFX.find((v) => v.id === id);
  if (!x) return null;
  return (
    <div className={s.sfxCue} style={{ ["--sfx" as string]: sfxColor(id) }}>
      <button type="button" className={s.sfxCueBtn} onClick={() => void playSfx(id)} aria-label={t(`효과음 ${x.ko} 듣기`, `Play ${x.en}`)}>
        <SfxIcon id={id} size={18} />
        <b>{ko ? x.say : x.sayEn}</b>
        <small>{t("효과음", "SFX")} ▶</small>
      </button>
      {onEdit && (
        <button type="button" className={s.sfxEdit} onClick={onEdit}>
          {t("바꾸기", "Change")}
        </button>
      )}
    </div>
  );
}

/** 감독용 — 줄 뒤에 효과음 넣기. 평소엔 작은 "+ 효과음" 버튼 하나, 누르면 8칸 그리드 */
export function SfxPicker({ value, onPick }: { value: string | null; onPick: (id: string | null) => void }) {
  const t = useT();
  const ko = useLang() === "ko";
  const [open, setOpen] = useState(false);
  if (!open) {
    return value ? (
      <SfxCue id={value} onEdit={() => setOpen(true)} />
    ) : (
      <button type="button" className={s.sfxAdd} onClick={() => setOpen(true)}>
        + {t("효과음 넣기", "Add sound effect")}
      </button>
    );
  }
  return (
    <div className={s.sfxGrid} role="group" aria-label={t("효과음 고르기", "Pick a sound effect")}>
      {SFX.map((x) => (
        <button
          key={x.id}
          type="button"
          className={`${s.sfxTile} ${value === x.id ? s.sfxTileOn : ""}`}
          style={{ ["--sfx" as string]: sfxColor(x.id) }}
          onClick={() => {
            void playSfx(x.id);
            onPick(value === x.id ? null : x.id);
          }}
        >
          <SfxIcon id={x.id} size={26} />
          <span>{ko ? x.ko : x.en}</span>
        </button>
      ))}
      <button type="button" className={s.sfxDone} onClick={() => setOpen(false)}>
        {value ? t("완료", "Done") : t("닫기", "Close")}
      </button>
      {value && (
        <button
          type="button"
          className={s.sfxDone}
          onClick={() => {
            onPick(null);
            setOpen(false);
          }}
        >
          {t("빼기", "Remove")}
        </button>
      )}
    </div>
  );
}
