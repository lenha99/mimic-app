"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useLang, useT } from "@/components/lang";
import { usePass } from "@/components/pass/use-pass";
import { VoiceAvatar } from "@/components/voice-avatar";
import { normalizeAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { genreLabel, HALL_LABEL, nextTitle, premiereLabel, roleColor, rolePick, timeLeft, titleOf, TITLES, TYPE_LABEL, type RelayRole, type SceneView, type Title } from "@/lib/relay";
import { track } from "@/lib/track";
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
            ? t(`LV${next.from} ${next.ko}까지 ${need}XP — ${next.perkKo}`, `${need}XP to ${next.en} — ${next.perkEn}`)
            : t("최고 직함이에요. 장면을 열고 배우를 캐스팅하세요", "Top rank — open scenes and cast actors")}
        </small>
      </span>
      <span aria-hidden="true">›</span>
    </Link>
  );
}

/**
 * 계급 사다리 — 계급은 쌓인다(감독은 배우·애드리브·작가 일도 전부 한다).
 * 칸마다: 새로 생기는 일 · 그걸 어디서 하는지 · 열렸으면 바로 가는 버튼, 잠겼으면 남은 XP.
 */
export function Ladder({ writeHref }: { writeHref?: string | null }) {
  const t = useT();
  const ko = useLang() === "ko";
  const { level } = useLevel();
  const pass = usePass();
  const xp = pass?.xp ?? 0;
  const cur = titleOf(level);
  const go: Partial<Record<Title, { href: string; ko: string; en: string }>> = {
    writer: writeHref ? { href: writeHref, ko: "갈림길 대사 쓰러 가기", en: "Write a branch line" } : undefined,
    director: { href: "/relay/studio", ko: "감독 스튜디오 열기", en: "Open the studio" },
  };
  return (
    <div className={s.ladderBox}>
      <p className={s.ladderNote}>
        {t("계급은 쌓여요 — 레벨이 오르면 아래 계급이 하던 건 그대로 하고, 할 수 있는 게 하나씩 늘어요.", "Ranks stack — each level keeps everything below and adds one more power.")}
      </p>
      <ol className={s.ladder}>
        {TITLES.map((x) => {
          const locked = level < x.from;
          const need = Math.max(0, (LEVEL_XP[x.from - 1] ?? 0) - xp);
          const action = go[x.id];
          return (
            <li key={x.id} className={`${s.rung} ${x.id === cur.id ? s.rungOn : ""} ${locked ? s.rungLocked : ""}`}>
              <span className={s.rungIcon} aria-hidden="true">
                {x.icon}
              </span>
              <span className={s.rungBody}>
                <span className={s.rungHead}>
                  <b>{ko ? x.ko : x.en}</b>
                  <span className={s.rungLv}>LV{x.from}</span>
                  {x.id === cur.id && <span className={s.rungNow}>{t("지금 나", "You")}</span>}
                </span>
                <span className={s.rungPerk}>
                  {x.from > 1 ? "+ " : ""}
                  {ko ? x.perkKo : x.perkEn}
                </span>
                <span className={s.rungWhere}>📍 {ko ? x.whereKo : x.whereEn}</span>
                {locked ? (
                  <span className={s.rungLock}>🔒 {pass ? t(`${need}XP 더 모으면 열려요 · 출연 한 번 +30XP`, `${need}XP to go · +30XP per appearance`) : t(`LV${x.from}부터`, `From LV${x.from}`)}</span>
                ) : (
                  action && (
                    <Link href={action.href} className={s.rungGo}>
                      {ko ? action.ko : action.en} ›
                    </Link>
                  )
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** 장르별 포스터 — 큰 그림 하나 + 배경색. 상영관 카드와 장면 머리에 같이 쓴다 */
const GENRE_ART: Record<string, { art: string; from: string; to: string }> = {
  fantasy: { art: "🐉", from: "#5b3aa8", to: "#1f1640" },
  battle: { art: "🔥", from: "#b2361f", to: "#2a1210" },
  anime: { art: "🌸", from: "#c4508a", to: "#2b1426" },
  movie: { art: "🎬", from: "#3c4a6b", to: "#151a26" },
  horror: { art: "👻", from: "#2f4a3a", to: "#0f1813" },
  romance: { art: "💘", from: "#c44d6a", to: "#2b1219" },
  interview: { art: "💼", from: "#2d6a8a", to: "#0f1f2a" },
  announcer: { art: "🎤", from: "#2a5fa8", to: "#101b30" },
  news: { art: "📺", from: "#3a5f8f", to: "#121b28" },
  speech: { art: "🎙️", from: "#7a5a2a", to: "#221a10" },
  cross: { art: "🌀", from: "#6a3aa8", to: "#1a1430" },
  chaos: { art: "🤪", from: "#a8702a", to: "#2a1c0e" },
};
export const genreArt = (g: string) => GENRE_ART[g] ?? GENRE_ART.movie;

export function Poster({ genre, title, sub, tag, right }: { genre: string; title: string; sub?: string; tag?: ReactNode; right?: ReactNode }) {
  const g = genreArt(genre);
  return (
    <span className={s.poster} style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}>
      <span className={s.posterArt} aria-hidden="true">
        {g.art}
      </span>
      <span className={s.posterTop}>
        {tag}
        {right}
      </span>
      <span className={s.posterTitle}>{title}</span>
      {sub && <span className={s.posterSub}>{sub}</span>}
    </span>
  );
}

/**
 * 배역 고르기 — 배역마다 한 칸: 누구인지(설명) · 대사 몇 줄 · 지금 상태 · 버튼.
 * 비어 있으면 「이 배역 하기」가 그 배역의 첫 줄 녹음으로 바로 데려간다.
 */
export function RoleCards({ scene, compact = false, onCast }: { scene: SceneView; compact?: boolean; onCast?: (role: RelayRole) => void }) {
  const t = useT();
  const ko = useLang() === "ko";
  return (
    <ul className={s.roles}>
      {scene.roles.map((r) => {
        const pick = rolePick(scene, r.id);
        const o = scene.owners.find((x) => x.role === r.id);
        const take = o ? scene.takes.find((x) => x.owner === o.owner && x.kind === "line") : undefined;
        const lines = scene.lines.filter((l) => !l.candidate && l.role === r.id).length;
        const cast = scene.casts.find((c) => c.role === r.id);
        return (
          <li key={r.id} className={`${s.role} ${pick.state === "mine" ? s.roleMine : ""}`} style={{ ["--role" as string]: roleColor(scene.roles, r.id) }}>
            <span className={s.roleFace}>{o ? <AvatarDot avatar={take?.avatar} seed={o.owner} size={34} /> : <b>{r.name.slice(0, 1)}</b>}</span>
            <span className={s.roleInfo}>
              <b>
                {r.name} <small>{ko ? TYPE_LABEL[r.type].ko : TYPE_LABEL[r.type].en}</small>
              </b>
              {!compact && <span className={s.roleDesc}>{r.desc}</span>}
              <span className={s.roleState}>
                {pick.state === "mine"
                  ? pick.left > 0
                    ? t(`내 배역 · ${pick.left}줄 남음`, `My role · ${pick.left} left`)
                    : t("내 배역 · 다 녹음했어요 ✓", "My role · all done ✓")
                  : pick.state === "taken"
                    ? t(`${pick.name || "다른 배우"} 출연 중`, `${pick.name || "Someone"} has it`)
                    : cast
                      ? cast.mine
                        ? t("🎬 감독님이 나를 지명!", "🎬 You were cast!")
                        : t(`대사 ${lines}줄 · 감독 지명 있음`, `${lines} lines · cast by director`)
                      : pick.state === "open"
                        ? t(`대사 ${lines}줄 · 비어 있어요`, `${lines} lines · open`)
                        : t("한 장면엔 배역 하나만", "One role per scene")}
              </span>
            </span>
            {onCast && !o ? (
              <button type="button" className={s.roleBtnGhost} onClick={() => onCast(r)}>
                {cast ? t("지명 변경", "Recast") : t("지명", "Cast")}
              </button>
            ) : pick.state === "open" ? (
              <Link href={`/relay/rec?scene=${scene.id}&line=${pick.lineId}`} className={s.roleBtn} onClick={() => track("relay_cta", { via: `role:${r.type}` })}>
                {t("이 배역 하기", "Play this")}
              </Link>
            ) : pick.state === "mine" && pick.lineId ? (
              <Link href={`/relay/rec?scene=${scene.id}&line=${pick.lineId}`} className={s.roleBtn}>
                {t("이어서", "Continue")}
              </Link>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** 상영관 카드 — 포스터(누르면 대본) + 배역 고르기 + 진행 막대 */
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
    <article className={s.hall}>
      <Link href={href} className={s.posterLink}>
        <Poster
          genre={scene.genre}
          title={scene.title}
          sub={scene.logline}
          tag={
            <span className={s.hallTag}>
              <i className={s.live} aria-hidden="true" /> {ko ? hall.ko : hall.en} · {genreLabel(scene.genre, ko)}
            </span>
          }
          right={<span className={s.posterWhen}>{timeLeft(scene.premiereAt, ko, now)}</span>}
        />
        <span className={s.posterMore}>
          📜 {t("대본 보고 미리 듣기", "Read the script & preview")} <span aria-hidden="true">›</span>
        </span>
      </Link>
      <span className={s.pickHead}>
        <b>🎭 {t("배역 고르기", "Pick a role")}</b>
        <span className={s.tiny}>{t(`사람 목소리 ${voiced}/10줄`, `${voiced}/10 voiced`)}</span>
      </span>
      <RoleCards scene={scene} compact />
      <span className={s.meter} aria-label={t(`사람 목소리 ${voiced}/10줄`, `${voiced}/10 lines voiced`)}>
        <i style={{ width: `${(voiced / 10) * 100}%` }} />
      </span>
      <span className={s.hallFoot}>
        <span>{t("빈 줄은 AI 대역이 읽어 줘요", "Empty lines are read by an AI stand-in")}</span>
        <span className={s.when}>{premiereLabel(scene.premiereAt, ko)}</span>
      </span>
    </article>
  );
}

/** 처음 온 사람용 — 뭘 하는 건지 세 칸 + 가이드 입구 */
export function HowItWorks() {
  const t = useT();
  const steps = [
    { n: 1, icon: "🎭", title: t("배역 고르기", "Pick a role"), body: t("용사? 마왕? 면접관? 하고 싶은 역 하나", "Hero? Villain? Interviewer?") },
    { n: 2, icon: "🎙️", title: t("딱 한 줄 녹음", "Record one line"), body: t("앞 사람 대사 듣고 바로 받아치기", "Hear the cue, fire back") },
    { n: 3, icon: "🍿", title: t("사흘째 밤 개봉", "Premiere night"), body: t("여러 목소리로 이어진 장면 + 내 이름 크레딧", "The full scene, your name in the credits") },
  ];
  return (
    <section className={s.how} aria-label={t("이렇게 해요", "How it works")}>
      <ol className={s.howSteps}>
        {steps.map((x) => (
          <li key={x.n} className={s.howStep}>
            <span className={s.howIcon} aria-hidden="true">
              {x.icon}
              <i>{x.n}</i>
            </span>
            <b>{x.title}</b>
            <small>{x.body}</small>
          </li>
        ))}
      </ol>
      <Link href="/relay/guide" className={s.howGuide}>
        📖 {t("처음이라면 — 가이드 1분 읽기", "New here? 1-minute guide")} <span aria-hidden="true">›</span>
      </Link>
    </section>
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
        "하고 싶은 배역을 골라 대사 한 줄만 녹음하면, 앞뒤 배우들 목소리와 이어져요. 아직 아무도 안 한 줄은 AI 대역이 읽어 줘요.",
        "Pick a role and record one line. It joins everyone else's. Empty lines are read by an AI stand-in.",
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

/**
 * 내 작업실 — 작가(LV5)·감독(LV7)이 "어디 가서 뭘 하지?"를 안 묻게, 할 수 있는 일을 버튼으로.
 * 작가: 상영 중 장면마다 6번·10번 쓰기 → 장면 화면이 쓰기 창을 바로 연다(?write=6).
 */
export function MyDesk({ live }: { live: SceneView[] }) {
  const t = useT();
  const { level } = useLevel();
  if (level < 5) return null;
  return (
    <section className={s.desk}>
      <span className={s.deskHead}>
        <b>🛠 {t("내 작업실", "My desk")}</b>
        <span className={s.tiny}>{t(`LV${level} · 배우 일은 그대로 하면서`, `LV${level} · on top of acting`)}</span>
      </span>
      <div className={s.deskBlock}>
        <b>✍️ {t("작가 — 6번·10번 대사 바꿔 쓰기", "Writer — rewrite lines 6 & 10")}</b>
        <span className={s.muted}>
          {t("장면마다 6번(전개)·10번(결말)은 작가가 새 대사를 쓸 수 있어요. 배우들이 내 대사를 녹음할 때마다 1표 — 표가 제일 많은 대사가 개봉판에 들어가요.", "Lines 6 (twist) and 10 (ending) are open to writers. Each actor who records your line is a vote — the top line makes the premiere.")}
        </span>
        {live.length === 0 ? (
          <span className={s.tiny}>{t("지금 상영 중인 장면이 없어요.", "No scenes showing right now.")}</span>
        ) : (
          live.map((sc) => (
            <span key={sc.id} className={s.deskRow}>
              <span className={s.deskTitle}>{sc.title}</span>
              <Link href={`/relay/s/${sc.id}?write=6`} className={s.roleBtnGhost}>
                {t("6번 쓰기", "Line 6")}
              </Link>
              <Link href={`/relay/s/${sc.id}?write=10`} className={s.roleBtnGhost}>
                {t("10번 쓰기", "Line 10")}
              </Link>
            </span>
          ))
        )}
      </div>
      {level >= 7 && (
        <div className={s.deskBlock}>
          <b>🎬 {t("감독 — 내 장면 올리기", "Director — post your own scene")}</b>
          <span className={s.muted}>{t("스튜디오에서 배역과 대사 10줄을 쓰면 AI 대역 목소리가 입혀져 상영관에 올라가요. 상영되면 그 장면 화면에서 녹음마다 OK/NG를 찍고 배우를 지명해요.", "Write roles and 10 lines in the studio; it goes on screen with AI voices. Once live, stamp OK/NG and cast actors on its page.")}</span>
          <Link href="/relay/studio" className={s.roleBtn} style={{ justifySelf: "start" }}>
            {t("감독 스튜디오 열기", "Open the studio")} ›
          </Link>
        </div>
      )}
    </section>
  );
}
