"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useLang, useT } from "@/components/lang";
import { postJson } from "@/components/relay/client";
import { Poster } from "@/components/relay/parts";
import { readLocalAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { cleanNickname, readNickname } from "@/lib/nickname";
import { GENRES, genreLabel } from "@/lib/relay";
import { MAX_SCRIPT, MAX_TITLE, splitScript, titleFromScript } from "@/lib/room-script";
import { track } from "@/lib/track";
import s from "@/components/relay/relay.module.css";
import r from "@/components/relay/room.module.css";

type Pick = { key: string; title: string; logline: string; genre: string; roles: number; lines: number };
type Step = "choose" | "script" | "scene" | "settings";

const DRAFT = "mimic.roomDraft";

/**
 * 방 만들기 — 1) 무엇으로(우리 대본 / 준비된 장면) 2) 대본 붙여넣기 또는 장면 고르기 3) 제목·공개 → 방 열기.
 * 아래로 길게 펼치지 않고 한 단계씩. 붙여 넣던 대본은 이 기기에 잠깐 남겨 둔다(실수로 뒤로 가도 안 날아가게).
 */
export default function NewRoom() {
  const t = useT();
  const ko = useLang() === "ko";
  const router = useRouter();
  const [step, setStep] = useState<Step>("choose");
  const [kind, setKind] = useState<"script" | "scene">("script");
  const [script, setScript] = useState(() => {
    try {
      return typeof window === "undefined" ? "" : (sessionStorage.getItem(DRAFT) ?? "");
    } catch {
      return "";
    }
  });
  const [scenes, setScenes] = useState<Pick[]>([]);
  const [genre, setGenre] = useState<string>("all");
  const [pick, setPick] = useState<Pick | null>(null);
  const [title, setTitle] = useState("");
  const [pub, setPub] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(true);
  const [v2, setV2] = useState(true);

  useEffect(() => {
    let alive = true;
    void fetch(`/api/relay/room?client=${clientId()}`, { cache: "no-store" })
      .then((x) => x.json())
      .then((d: { scenes?: Pick[]; ready?: boolean; v2?: boolean }) => {
        if (!alive) return;
        setScenes(d.scenes ?? []);
        setReady(d.ready !== false);
        setV2(d.v2 !== false);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DRAFT, script);
    } catch {}
  }, [script]);

  const parts = useMemo(() => splitScript(script), [script]);
  const genres = useMemo(() => GENRES.filter((g) => scenes.some((sc) => sc.genre === g.id)), [scenes]);
  const shown = genre === "all" ? scenes : scenes.filter((sc) => sc.genre === genre);

  const toSettings = (k: "script" | "scene", p?: Pick) => {
    setKind(k);
    setPick(p ?? null);
    setTitle(k === "script" ? titleFromScript(script) : (p?.title ?? ""));
    setError(null);
    setStep("settings");
  };

  const create = async () => {
    setBusy(true);
    setError(null);
    const res = await postJson<{ code?: string }>("/api/relay/room", {
      kind,
      stockKey: pick?.key,
      script: kind === "script" ? script : undefined,
      title: title.trim() || undefined,
      public: pub,
      name: cleanNickname(readNickname()) ?? undefined,
      avatar: readLocalAvatar() ?? undefined,
    });
    if (!res.ok || !res.data.code) {
      setBusy(false);
      return setError(res.data.error ?? t("방을 만들지 못했어요.", "Couldn't make the room."));
    }
    track("room_create", { meme_id: pick?.key ?? "script", via: `${kind}${pub ? ":public" : ":private"}` });
    try {
      sessionStorage.removeItem(DRAFT);
    } catch {}
    router.push(`/relay/r/${res.data.code}`);
  };

  const back = () => setStep(step === "settings" ? kind : "choose");

  return (
    <main className={`shell ${s.page}`}>
      <div className={s.spread}>
        {step === "choose" ? (
          <Link href="/relay?tab=rooms" className={s.back}>
            ‹ {t("방 목록", "Rooms")}
          </Link>
        ) : (
          <button type="button" className={s.back} style={{ border: 0, background: "none", cursor: "pointer", padding: 0 }} onClick={back}>
            ‹ {t("이전", "Back")}
          </button>
        )}
      </div>

      {!ready && <div className={s.error}>{t("방 기능을 준비하고 있어요. 조금만 기다려 주세요!", "Rooms are coming soon!")}</div>}

      {step === "choose" && (
        <>
          <p className={s.kicker}>NEW ROOM</p>
          <h1 className={s.h1}>{t("무엇으로 할까요?", "What will you read?")}</h1>
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            <button type="button" className={r.choice} disabled={!v2} onClick={() => setStep("script")}>
              <span className={r.choiceIcon}>📄</span>
              <b>{t("우리 대본으로", "Our own script")}</b>
              <span>{t("연극 대본·발표 원고·아나운서 원고·아무 글. 붙여 넣으면 다 같이 읽고 녹음해요.", "A play, a speech, a news script — paste it and read together.")}</span>
              {!v2 && <small>{t("곧 열려요", "Coming soon")}</small>}
            </button>
            <button type="button" className={r.choice} onClick={() => setStep("scene")}>
              <span className={r.choiceIcon}>🎬</span>
              <b>{t("준비된 장면으로", "A ready-made scene")}</b>
              <span>{t("애니·면접·뉴스·영화 장면. 배역을 나눠 맡고 빈 줄은 AI가 읽어요.", "Anime, interviews, news, movies — split the roles, AI reads the rest.")}</span>
            </button>
          </div>
        </>
      )}

      {step === "script" && (
        <>
          <h1 className={s.h1}>{t("대본 붙여 넣기", "Paste your script")}</h1>
          <p className={s.sub}>{t("줄을 바꾼 곳마다 한 단락이 돼요. 배역은 정할 필요 없어요 — 각자 읽고 싶은 단락을 녹음하면 돼요.", "Each line becomes a paragraph. No roles — everyone records whichever paragraph they like.")}</p>
          <textarea
            className={r.scriptBox}
            value={script}
            onChange={(e) => setScript(e.target.value.slice(0, MAX_SCRIPT + 200))}
            placeholder={t("여기에 대본을 붙여 넣으세요.\n\n예)\n안녕하십니까, 아홉 시 뉴스입니다.\n오늘 첫 소식입니다.", "Paste your script here.")}
            rows={12}
          />
          <span className={s.tiny} style={{ textAlign: "right" }}>
            {t(`단락 ${parts.length}개 · ${script.length.toLocaleString()} / ${MAX_SCRIPT.toLocaleString()}자`, `${parts.length} paragraphs · ${script.length}/${MAX_SCRIPT}`)}
          </span>
          {script.length > MAX_SCRIPT && <div className={s.error}>{t("너무 길어요. 4,000자까지 넣을 수 있어요.", "Too long — up to 4,000 characters.")}</div>}
          <div className={s.bottomBar}>
            <button type="button" className={s.cta} disabled={script.trim().length < 5 || script.length > MAX_SCRIPT} onClick={() => toSettings("script")}>
              {t("다음", "Next")}
            </button>
          </div>
        </>
      )}

      {step === "scene" && (
        <>
          <h1 className={s.h1}>{t("장면 고르기", "Pick a scene")}</h1>
          <div className={r.chips}>
            <button type="button" className={`${r.chip} ${genre === "all" ? r.chipOn : ""}`} onClick={() => setGenre("all")}>
              {t("전체", "All")}
            </button>
            {genres.map((g) => (
              <button key={g.id} type="button" className={`${r.chip} ${genre === g.id ? r.chipOn : ""}`} onClick={() => setGenre(g.id)}>
                {ko ? g.ko : g.en}
              </button>
            ))}
          </div>
          <div className={r.grid}>
            {shown.map((sc) => (
              <button key={sc.key} type="button" className={r.pick} onClick={() => toSettings("scene", sc)}>
                <Poster genre={sc.genre} title={sc.title} />
                <small>
                  {genreLabel(sc.genre, ko)} · {t(`${sc.roles}명 · ${sc.lines}줄`, `${sc.roles} roles · ${sc.lines} lines`)}
                </small>
              </button>
            ))}
          </div>
          {!scenes.length && <p className={s.muted}>{t("불러오는 중…", "Loading…")}</p>}
        </>
      )}

      {step === "settings" && (
        <>
          <h1 className={s.h1}>{t("방 설정", "Room settings")}</h1>
          {kind === "scene" && pick && <p className={s.sub}>🎬 {pick.logline}</p>}
          {kind === "script" && <p className={s.sub}>📄 {t(`대본 단락 ${parts.length}개`, `${parts.length} paragraphs`)}</p>}
          <label className={r.field}>
            <span>{t("방 제목", "Room title")}</span>
            <input value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} placeholder={t("예) 연극부 3막 리허설", "e.g. Act 3 rehearsal")} />
          </label>
          <label className={r.toggle}>
            <input type="checkbox" checked={pub} onChange={(e) => setPub(e.target.checked)} disabled={!v2} />
            <span>
              <b>{t("방 목록에 공개", "Show in the room list")}</b>
              <small>
                {pub
                  ? t("누구나 목록에서 찾아 들어올 수 있어요. 목록엔 제목·인원만 보이고 대본·채팅은 들어와야 보여요.", "Anyone can find and join. The list shows only the title and size.")
                  : t("링크를 받은 사람만 들어와요.", "Only people with the link can join.")}
              </small>
            </span>
          </label>
          {error && <div className={s.error}>{error}</div>}
          <div className={s.bottomBar}>
            <button type="button" className={s.cta} disabled={busy || !ready} onClick={() => void create()}>
              {busy ? t("방 여는 중…", "Opening…") : t("방 열기", "Open the room")}
            </button>
            <span className={s.tiny} style={{ textAlign: "center" }}>
              {t("녹음은 방을 나가면 지워지고, 모두 나가면 방도 사라져요", "Takes are deleted when you leave; empty rooms disappear")}
            </span>
          </div>
        </>
      )}
    </main>
  );
}
