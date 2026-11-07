"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { usePass } from "@/components/pass/use-pass";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { HALL_LABEL, nextTitle, premiereLabel, timeLeft, titleOf, TITLES, TYPE_LABEL, type SceneView } from "@/lib/relay";
import { LEVEL_XP } from "@/lib/pass";
import { Coco } from "@/components/brand/coco";
import s from "./relay.module.css";

/** 내 레벨 — VOICE PASS 에서. 아직 모르면 1 */
export function useLevel(): { level: number; need: number; loaded: boolean } {
  const pass = usePass();
  return { level: pass?.progress.level ?? 1, need: pass?.progress.need ?? 0, loaded: Boolean(pass) };
}

export function AvatarDot({ avatar, size = 22, seed }: { avatar: Record<string, string> | null | undefined; size?: number; seed?: string }) {
  return (
    <span className={s.dot} style={{ width: size, height: size }}>
      <VoiceAvatar avatar={normalizeAvatar(avatar ?? {}, seed)} size={size + 6} />
    </span>
  );
}

/** 내 직함 띠 — 지금 직함 · 다음 권한까지 남은 XP */
export function RankBar() {
  const t = useT();
  const ko = useLang() === "ko";
  const { level, loaded } = useLevel();
  const pass = usePass();
  const cur = titleOf(level);
  const next = nextTitle(level);
  const xp = pass?.xp ?? 0;
  const need = next ? Math.max(0, LEVEL_XP[next.from - 1] - xp) : 0;
  return (
    <Link href="/relay/guide#ranks" className={s.rankBar} data-tour="relay-rank">
      <span className={s.rankIcon} aria-hidden="true">
        {cur.icon}
      </span>
      <span className={s.rankText}>
        <b>
          {ko ? cur.ko : cur.en} <span className={s.lv}>LV.{loaded ? level : "–"}</span>
        </b>
        <small>
          {next
            ? t(`${next.from}레벨 ${next.ko}까지 ${need}XP — ${next.perkKo}`, `${need}XP to ${next.en} — ${next.perkEn}`)
            : t("최고 직함이에요. 장면을 열고 배우를 캐스팅하세요", "Top rank — open scenes and cast actors")}
        </small>
      </span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}

/** 계급 사다리 — 지금 위치, 잠긴 건 흐리게 */
export function Ladder() {
  const ko = useLang() === "ko";
  const { level } = useLevel();
  const cur = titleOf(level);
  return (
    <ol className={s.ladder}>
      {TITLES.map((x) => {
        const locked = level < x.from;
        return (
          <li key={x.id} className={`${s.rung} ${x.id === cur.id ? s.rungOn : ""} ${locked ? s.rungLocked : ""}`}>
            <span className={s.rungIcon} aria-hidden="true">
              {x.icon}
            </span>
            <span>
              <b>{ko ? x.ko : x.en}</b>
              <small>{ko ? x.perkKo : x.perkEn}</small>
            </span>
            <span className={s.tiny}>{locked ? `🔒 LV${x.from}` : `LV${x.from}+`}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** 상영관 카드 — 배역별 출연 상태 · 진행 막대 · 개봉 시각 */
export function HallCard({ scene, href }: { scene: SceneView; href: string }) {
  const t = useT();
  const ko = useLang() === "ko";
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const base = scene.lines.filter((l) => !l.candidate);
  const voiced = base.filter((l) => scene.takes.some((x) => x.lineId === l.id && x.kind === "line")).length;
  const hall = HALL_LABEL[scene.hall];
  return (
    <Link href={href} className={`${s.hall} ${scene.hall === "real" ? s.hallReal : ""}`}>
      <span className={s.spread}>
        <span className={s.hallTag}>
          <i className={s.live} aria-hidden="true" /> {ko ? hall.ko : hall.en} · {t("상영 중", "NOW SHOWING")}
        </span>
        <span className={s.tiny}>{premiereLabel(scene.premiereAt, ko)}</span>
      </span>
      <h3 className={s.hallTitle}>{scene.title}</h3>
      <p className={s.hallLog}>{scene.logline}</p>
      <span className={s.castRow}>
        {scene.roles.map((r) => {
          const o = scene.owners.find((x) => x.role === r.id);
          const take = o ? scene.takes.find((x) => x.owner === o.owner && x.kind === "line") : undefined;
          return o ? (
            <span key={r.id} className={`${s.castChip} ${o.mine ? s.castMine : ""}`}>
              <AvatarDot avatar={take?.avatar} seed={o.owner} />
              {r.name} <em>{o.mine ? t("나", "me") : o.name}</em>
            </span>
          ) : (
            <span key={r.id} className={`${s.castChip} ${s.castOpen}`}>
              {r.name} <em>· {ko ? TYPE_LABEL[r.type].ko : TYPE_LABEL[r.type].en} {t("모집 중", "open")}</em>
            </span>
          );
        })}
      </span>
      <span className={s.meter} aria-label={t(`사람 목소리 ${voiced}/10줄`, `${voiced}/10 lines voiced`)}>
        <i style={{ width: `${(voiced / 10) * 100}%` }} />
      </span>
      <span className={s.hallFoot}>
        <span>{t(`사람 목소리 ${voiced}/10줄 · 나머지는 TTS`, `${voiced}/10 human lines · rest TTS`)}</span>
        <span className={s.when}>{timeLeft(scene.premiereAt, ko, now)}</span>
      </span>
    </Link>
  );
}

const INTRO_KEY = "mimic.relayIntro";

/** 첫 방문 카드 3장 — 한 번만. 건너뛸 수 있다. */
export function RelayIntro() {
  const t = useT();
  const [step, setStep] = useState(-1);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 불러오기(effect 안에서 바로 바뀌지 않는다)
      if (!localStorage.getItem(INTRO_KEY)) setStep(0);
    } catch {}
  }, []);
  const close = () => {
    try {
      localStorage.setItem(INTRO_KEY, "1");
    } catch {}
    setStep(-1);
  };
  if (step < 0) return null;
  const cards = [
    {
      mood: "sing" as const,
      title: t("한 줄만 녹음하면, 장면이 완성돼요", "Record one line, finish a scene"),
      body: t(
        "앱이 배역과 대사 한 줄을 정해 줘요. 녹음하면 앞뒤 배우들 목소리와 이어져요. 아직 아무도 안 한 줄은 TTS가 읽어 줘요.",
        "We pick your role and line. Your take joins everyone else's. Empty lines are read by TTS.",
      ),
    },
    {
      mood: "wow" as const,
      title: t("사흘째 밤 9시, 무조건 개봉", "Premieres on day 3 at 9 pm"),
      body: t(
        "장면은 열리고 사흘째 21시에 개봉해요. 크레딧에 내 이름이 올라가고, 바로 다음 장면이 열려요. 한 장면에 배역은 한 사람 하나씩!",
        "Each scene premieres on its 3rd night at 9 pm, credits and all. One role per person per scene.",
      ),
    },
    {
      mood: "happy" as const,
      title: t("레벨이 오르면 판을 짜요", "Level up to run the show"),
      body: t("LV3 애드리브 → LV5 작가(대사 쓰기) → LV7 감독(장면 열기·캐스팅·NG/OK). 출연할 때마다 +30 XP예요.", "LV3 ad-libs → LV5 writer → LV7 director. +30 XP per appearance."),
    },
  ];
  const c = cards[step];
  return (
    <div className={s.sheetBack} role="dialog" aria-modal="true" aria-label={t("릴레이 더빙 안내", "Relay Dubbing intro")}>
      <div className={s.sheet}>
        <div className={s.intro}>
          <Coco mood={c.mood} size={96} />
          <b>{c.title}</b>
          <p>{c.body}</p>
          <span className={s.dots}>
            {cards.map((_, i) => (
              <i key={i} data-on={i === step ? "1" : "0"} />
            ))}
          </span>
        </div>
        <div className={s.twoBtn}>
          <button type="button" className={s.ctaGhost} onClick={close}>
            {t("건너뛰기", "Skip")}
          </button>
          <button type="button" className={s.cta} onClick={() => (step < cards.length - 1 ? setStep(step + 1) : close())}>
            {step < cards.length - 1 ? t("다음", "Next") : t("시작하기", "Let's go")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** 상황 신청 — LV1 도 할 수 있는 창작 */
export function PromptCard() {
  const t = useT();
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/relay/prompts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client: clientId(), text }) });
      const d = await r.json().catch(() => ({}));
      if (r.ok) {
        setText("");
        setMsg(t("신청했어요! 감독이 고르면 크레딧에 '원안'으로 올라가요 ✨", "Sent! If a director picks it, you get an 'Original idea' credit ✨"));
      } else setMsg(d.error ?? t("신청하지 못했어요", "Couldn't send"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={s.card} data-tour="relay-prompt">
      <b>{t("💡 이런 장면 보고 싶어요", "💡 I want a scene where…")}</b>
      <span className={s.muted}>{t("한 줄 상황을 신청하면 감독이 장면으로 만들어요. 누구나 할 수 있어요.", "Pitch a one-line premise. Directors turn picks into scenes.")}</span>
      <input
        className={s.input}
        value={text}
        maxLength={40}
        placeholder={t("예) 마왕이 편의점 알바 면접을 본다", "e.g. The Demon King interviews for a part-time job")}
        onChange={(e) => setText(e.target.value)}
      />
      <span className={s.spread}>
        <span className={s.tiny}>{msg}</span>
        <button type="button" className={s.ctaSmall} disabled={busy || text.trim().length < 4} onClick={send}>
          {t("신청", "Send")}
        </button>
      </span>
    </div>
  );
}
