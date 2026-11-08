"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { Coco } from "@/components/brand/coco";
import { postJson } from "@/components/relay/client";
import { Ladder, useLevel } from "@/components/relay/parts";
import { clientId } from "@/lib/client-id";
import { can, GENRES, isBranch, MAX_LINE_CHARS, scenesPerWeek, TYPE_LABEL, VOICE_LABEL, type RoleType } from "@/lib/relay";
import { track } from "@/lib/track";
import s from "@/components/relay/relay.module.css";

type Mine = { id: string; title: string; status: string; hall: string; genre: string; premiere_at: string | null; real_actors: number; listens: number };
type Pending = { id: string; title: string; genre: string; director_name: string | null; logline: string };
type Prompt = { id: string; text: string; name: string };
type Studio = { level: number; admin: boolean; loggedIn: boolean; mine: Mine[]; pending: Pending[]; prompts: Prompt[] };
type RoleDraft = { name: string; type: RoleType; voice: string };
type LineDraft = { role: number; text: string; dir: string };

const TYPES: RoleType[] = ["anime", "actor", "announcer", "speech", "everyday"];
const STATUS: Record<string, [string, string]> = {
  pending: ["⏳ 승인 대기", "⏳ In review"],
  queued: ["🎟 상영 대기", "🎟 Queued"],
  live: ["🔴 상영 중", "🔴 Live"],
  premiered: ["🍿 개봉", "🍿 Premiered"],
  void: ["— 무산", "— Void"],
};

const emptyLines = (): LineDraft[] => Array.from({ length: 10 }, (_, i) => ({ role: i % 2, text: "", dir: "" }));

/**
 * 감독 스튜디오 — LV7. 제목·장르·배역(2~4)·대사 10줄을 쓰면 줄마다 배역 목소리로 TTS 를 입혀
 * 상영 대기열에 올린다. 첫 장면은 운영자 확인을 거친다. 아직 감독이 아니면 잠긴 화면 + 사다리.
 */
export default function RelayStudio() {
  const t = useT();
  const ko = useLang() === "ko";
  const { level: passLevel } = useLevel();
  const [data, setData] = useState<Studio | null>(null);
  const [title, setTitle] = useState("");
  const [logline, setLogline] = useState("");
  const [genre, setGenre] = useState("fantasy");
  const [mode, setMode] = useState<"normal" | "chaos">("normal");
  const [promptId, setPromptId] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleDraft[]>([
    { name: "", type: "anime", voice: "m_young" },
    { name: "", type: "actor", voice: "f_bright" },
  ]);
  const [lines, setLines] = useState<LineDraft[]>(emptyLines);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/relay/scenes?client=${clientId()}`, { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 비동기 불러오기(effect 안에서 바로 바뀌지 않는다)
    void load();
  }, [load]);

  const level = data?.level ?? passLevel;
  const allowed = Boolean(data?.admin) || can.direct(level);

  const setRole = (i: number, patch: Partial<RoleDraft>) => setRoles((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const setLine = (i: number, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const removeRole = (i: number) => {
    setRoles((rs) => rs.filter((_, j) => j !== i));
    setLines((ls) => ls.map((l) => ({ ...l, role: l.role === i ? 0 : l.role > i ? l.role - 1 : l.role })));
  };

  const ready = title.trim().length >= 2 && roles.length >= 2 && roles.every((r) => r.name.trim()) && lines.every((l) => l.text.trim().length >= 2) && roles.every((_, i) => lines.some((l) => l.role === i));

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const r = await postJson<{ id?: string; status?: string }>("/api/relay/scenes", { title, logline, genre, mode, promptId, roles, lines });
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.data.error ?? t("만들지 못했어요", "Failed") });
    track("relay_write", { via: "scene" });
    setMsg({
      ok: true,
      text:
        r.data.status === "queued"
          ? t("상영 대기열에 올렸어요! 상영관이 비면 바로 열려요 🎬", "Queued! It opens when a hall is free 🎬")
          : t("운영자 확인 뒤 상영 대기열에 올라가요. 보통 하루 안에 확인해요.", "Sent for review — usually within a day."),
    });
    setTitle("");
    setLogline("");
    setPromptId(null);
    setLines(emptyLines());
    void load();
  };

  const act = async (id: string, action: string) => {
    const r = await postJson(`/api/relay/scenes/${id}`, { action }, "PATCH");
    if (!r.ok) setMsg({ ok: false, text: r.data.error ?? "error" });
    void load();
  };

  return (
    <main className={`shell ${s.page}`}>
      <Link href="/relay" className={s.back}>
        ‹ {t("릴레이 더빙", "Relay Dubbing")}
      </Link>
      <p className={s.kicker}>DIRECTOR STUDIO</p>
      <h1 className={s.h1}>
        🎬 {t("감독 스튜디오", "Director studio")}
      </h1>

      {!allowed ? (
        <>
          <div className={s.okBox}>
            <Coco mood="think" size={80} />
            <b>{t("LV7 감독부터 장면을 열 수 있어요", "Directors (LV7) open scenes")}</b>
            <span className={s.muted}>
              {t(
                `지금 LV${level}. 감독이 되면 직접 쓴 장면을 상영관에 올리고, 배우를 캐스팅하고, 녹음마다 NG/OK를 찍어요. 한 주에 한 편(LV9는 두 편).`,
                `You're LV${level}. Directors write scenes, cast actors and stamp NG/OK. One scene a week (two at LV9).`,
              )}
            </span>
            <Link href="/relay/rec" className={s.ctaSmall}>
              🎙 {t("출연해서 XP 모으기", "Earn XP by appearing")}
            </Link>
          </div>
          <div className={s.section}>
            <h2>{t("제작 계급", "Ranks")}</h2>
          </div>
          <Ladder />
          <div className={s.section}>
            <h2>{t("감독이 하는 일", "What directors do")}</h2>
          </div>
          <ul className={s.guide}>
            <li>{t("📝 제목·배역(2~4)·대사 10줄로 장면 열기 — 줄마다 배역 목소리 TTS가 자동으로 입혀져요", "📝 Write a 10-line scene — TTS voices every line")}</li>
            <li>{t("🎬 들어온 녹음에 OK(정식판 우선) / NG + 디렉션(\"더 비열하게\" 등)", "🎬 Stamp takes OK, or NG with a direction")}</li>
            <li>{t("📣 빈 배역에 배우 지명 — 장면당 둘까지", "📣 Cast actors to empty roles — two per scene")}</li>
            <li>{t("🌀 막장 모드 — 작가가 앞 두 줄만 보고 쓰는 장면", "🌀 Chaos mode — writers see only the last two lines")}</li>
          </ul>
        </>
      ) : (
        <>
          {!data?.loggedIn && !data?.admin && (
            <div className={s.lock}>
              🔑 {t("장면을 열려면 로그인이 필요해요.", "Log in to open scenes.")} <Link href="/login?next=/relay/studio">{t("로그인", "Log in")}</Link>
            </div>
          )}
          <p className={s.sub}>
            {data?.admin
              ? t("운영자 — 바로 상영 대기열에 올라가요.", "Admin — goes straight to the queue.")
              : t(`한 주에 ${scenesPerWeek(level)}편. 첫 두 편은 운영자 확인을 거쳐요.`, `${scenesPerWeek(level)} per week. Your first two are reviewed.`)}
          </p>

          {data && data.pending.length > 0 && (
            <>
              <div className={s.section}>
                <h2>🛂 {t("승인 대기 (운영자)", "Pending (admin)")}</h2>
              </div>
              <ul className={s.list}>
                {data.pending.map((p) => (
                  <li key={p.id} className={s.card}>
                    <Link href={`/relay/s/${p.id}`}>
                      <b>{p.title}</b>
                    </Link>
                    <span className={s.tiny}>
                      {p.director_name} · {p.logline}
                    </span>
                    <span className={s.twoBtn}>
                      <button type="button" className={s.ctaGhost} onClick={() => act(p.id, "reject")}>
                        {t("반려", "Reject")}
                      </button>
                      <button type="button" className={s.cta} onClick={() => act(p.id, "approve")}>
                        {t("승인", "Approve")}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className={s.section}>
            <h2>{t("새 장면", "New scene")}</h2>
          </div>
          <div className={s.card}>
            <label className={s.field}>
              <span>{t("제목", "Title")}</span>
              <input className={s.input} value={title} maxLength={30} onChange={(e) => setTitle(e.target.value)} placeholder={t("예) 마왕, 편의점 알바 면접을 보다", "e.g. The Demon King's job interview")} />
            </label>
            <label className={s.field}>
              <span>{t("한 줄 소개", "Logline")}</span>
              <input className={s.input} value={logline} maxLength={80} onChange={(e) => setLogline(e.target.value)} />
            </label>
            <label className={s.field}>
              <span>{t("장르", "Genre")}</span>
              <span className={s.chips}>
                {GENRES.map((g) => (
                  <button key={g.id} type="button" className={`${s.chip} ${genre === g.id ? s.chipOn : ""}`} onClick={() => setGenre(g.id)}>
                    {ko ? g.ko : g.en}
                  </button>
                ))}
              </span>
            </label>
            <label className={s.field}>
              <span>{t("모드", "Mode")}</span>
              <span className={s.chips}>
                <button type="button" className={`${s.chip} ${mode === "normal" ? s.chipOn : ""}`} onClick={() => setMode("normal")}>
                  {t("보통", "Normal")}
                </button>
                <button type="button" className={`${s.chip} ${mode === "chaos" ? s.chipOn : ""}`} onClick={() => setMode("chaos")}>
                  🌀 {t("막장 — 작가는 앞 두 줄만 봐요", "Chaos — writers see 2 lines")}
                </button>
              </span>
            </label>
            {data && data.prompts.length > 0 && (
              <label className={s.field}>
                <span>{t("상황 신청에서 고르기 (원안 크레딧)", "Pick a pitch (idea credit)")}</span>
                <select
                  className={s.select}
                  value={promptId ?? ""}
                  onChange={(e) => {
                    const p = data.prompts.find((x) => x.id === e.target.value);
                    setPromptId(p?.id ?? null);
                    if (p && !logline) setLogline(p.text);
                  }}
                >
                  <option value="">{t("고르지 않음", "None")}</option>
                  {data.prompts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.text} — {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className={s.section}>
            <h2>{t("배역", "Roles")} ({roles.length}/4)</h2>
            {roles.length < 4 && (
              <button type="button" className={s.ctaSmall} onClick={() => setRoles((rs) => [...rs, { name: "", type: "everyday", voice: "m_calm" }])}>
                + {t("배역", "Role")}
              </button>
            )}
          </div>
          {roles.map((r, i) => (
            <div key={i} className={s.card}>
              <span className={s.spread}>
                <input className={s.input} value={r.name} maxLength={12} placeholder={t(`배역 ${i + 1} 이름`, `Role ${i + 1}`)} onChange={(e) => setRole(i, { name: e.target.value })} />
                {roles.length > 2 && (
                  <button type="button" className={s.chip} onClick={() => removeRole(i)} aria-label={t("배역 빼기", "Remove")}>
                    ✕
                  </button>
                )}
              </span>
              <span className={s.chips}>
                {TYPES.map((x) => (
                  <button key={x} type="button" className={`${s.chip} ${r.type === x ? s.chipOn : ""}`} onClick={() => setRole(i, { type: x })}>
                    {ko ? TYPE_LABEL[x].ko : TYPE_LABEL[x].en}
                  </button>
                ))}
              </span>
              <select className={s.select} value={r.voice} onChange={(e) => setRole(i, { voice: e.target.value })} aria-label={t("TTS 목소리", "TTS voice")}>
                {Object.entries(VOICE_LABEL).map(([id, label]) => (
                  <option key={id} value={id}>
                    🔊 {label}
                  </option>
                ))}
              </select>
            </div>
          ))}

          <div className={s.section}>
            <h2>{t("대사 10줄", "10 lines")}</h2>
            <span className={s.tiny}>{t("6·10번은 작가들이 바꿔 쓸 수 있는 갈림길", "6 & 10 are branches writers can rewrite")}</span>
          </div>
          <ol className={s.script}>
            {lines.map((l, i) => (
              <li key={i} className={s.studioLine}>
                <span className={s.spread}>
                  <b>
                    {i + 1}
                    {isBranch(i + 1) ? ` · ${t("갈림길", "branch")}` : ""}
                  </b>
                  <span className={s.chips}>
                    {roles.map((r, j) => (
                      <button key={j} type="button" className={`${s.chip} ${l.role === j ? s.chipOn : ""}`} onClick={() => setLine(i, { role: j })}>
                        {r.name || `${t("배역", "Role")} ${j + 1}`}
                      </button>
                    ))}
                  </span>
                </span>
                <input className={s.input} value={l.text} maxLength={MAX_LINE_CHARS} placeholder={t("대사 (숫자는 한글로)", "Line")} onChange={(e) => setLine(i, { text: e.target.value })} />
                <input className={s.input} value={l.dir} maxLength={20} placeholder={t("지문 (선택) — 예: 비웃으며", "Direction (optional)")} onChange={(e) => setLine(i, { dir: e.target.value })} />
              </li>
            ))}
          </ol>

          {msg && <div className={msg.ok ? s.okBox : s.error}>{msg.text}</div>}
          <div className={s.bottomBar}>
            <button type="button" className={s.cta} disabled={!ready || busy} onClick={submit}>
              {busy ? t("목소리 입히는 중… (30초쯤)", "Voicing lines… (~30s)") : t("🎬 장면 올리기", "🎬 Submit scene")}
            </button>
          </div>

          {data && data.mine.length > 0 && (
            <>
              <div className={s.section}>
                <h2>{t("내 장면", "My scenes")}</h2>
              </div>
              <ul className={s.list}>
                {data.mine.map((m) => (
                  <li key={m.id}>
                    <div className={s.item}>
                      <span className={s.itemText}>
                        <Link href={m.status === "premiered" ? `/relay/s/${m.id}/premiere` : `/relay/s/${m.id}`}>
                          <b>{m.title}</b>
                        </Link>
                        <small>
                          {ko ? STATUS[m.status]?.[0] : STATUS[m.status]?.[1]} · {t(`배우 ${m.real_actors} · 시청 ${m.listens}`, `${m.real_actors} actors · ${m.listens} listens`)}
                        </small>
                      </span>
                      {(m.status === "pending" || m.status === "queued") && (
                        <button type="button" className={s.chip} onClick={() => act(m.id, "withdraw")}>
                          {t("거두기", "Withdraw")}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}
