"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/components/lang";
import { useViewer } from "@/components/viewer";
import { VoiceAvatar } from "@/components/voice-avatar";
import { DEFAULT_AVATAR } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { readNickname } from "@/lib/nickname";
import { rankLabel, UNLOCKS, type Look } from "@/lib/pass";
import { track } from "@/lib/track";
import { AvatarFrame, LevelPill, NameFx } from "./look";
import s from "./level-up.module.css";

/**
 * LEVEL UP — 앱을 열 때(세션에 한 번) 내 레벨을 확인하고, 지난번보다 올랐으면 게임처럼 축하한다.
 * 레벨은 남이 ❤ 를 눌러서도 오르니, "자고 일어났더니 레벨업" 이 다시 들어올 이유가 된다.
 * 처음 재는 기기에선 조용히 기록만 한다(첫 방문에 "레벨업!"이 뜨면 거짓말이다).
 */
const KEY = "mimic.pass.level";

export function LevelUpWatcher() {
  const [up, setUp] = useState<{ from: number; look: Look } | null>(null);

  useEffect(() => {
    let alive = true;
    try {
      if (sessionStorage.getItem("mimic.pass.checked")) return;
      sessionStorage.setItem("mimic.pass.checked", "1");
    } catch {
      return;
    }
    void fetch(`/api/pass?client=${encodeURIComponent(clientId())}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { look: Look } | null) => {
        if (!alive || !d) return;
        let before: number | null = null;
        try {
          const raw = localStorage.getItem(KEY);
          before = raw ? Number(raw) : null;
          localStorage.setItem(KEY, String(d.look.level));
        } catch {}
        if (before !== null && d.look.level > before) {
          setUp({ from: before, look: d.look });
          track("pass_levelup", { via: String(d.look.level) });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!up) return null;
  return <LevelUpCard up={up} onClose={() => setUp(null)} />;
}

function LevelUpCard({ up, onClose }: { up: { from: number; look: Look }; onClose: () => void }) {
  const t = useT();
  const viewer = useViewer();
  const got = UNLOCKS.filter((u) => u.level > up.from && u.level <= up.look.level);
  const name = viewer?.nickname || readNickname() || t("나", "Me");

  return (
    <div className={s.backdrop} role="dialog" aria-modal="true" aria-label="LEVEL UP" onClick={() => onClose()}>
      <div className={s.card} onClick={(e) => e.stopPropagation()}>
        <div className={s.rays} aria-hidden="true" />
        <p className={s.kicker}>LEVEL UP</p>
        <p className={s.big}>
          <span>LV.{up.from}</span>
          <i aria-hidden="true">→</i>
          <b>LV.{up.look.level}</b>
        </p>
        <LevelPill level={up.look.level} rank={up.look.rank} />
        <div className={s.face}>
          <AvatarFrame frame={up.look.frame}>
            <VoiceAvatar avatar={viewer?.avatar ?? DEFAULT_AVATAR} size={104} level={0.3} />
          </AvatarFrame>
        </div>
        <p className={s.name}>
          <NameFx fx={up.look.name}>{name}</NameFx>
        </p>
        {got.length > 0 ? (
          <ul className={s.got}>
            {got.map((u) => (
              <li key={u.id}>
                <small>UNLOCKED</small>
                {t(u.ko, u.en)}
              </li>
            ))}
          </ul>
        ) : (
          <p className={s.note}>{t(`${rankLabel(up.look.rank)} 랭크 — 다음 꾸미기까지 조금만 더`, `${rankLabel(up.look.rank)} — next unlock is close`)}</p>
        )}
        {viewer?.nickname ? (
          <>
            <button type="button" className={s.go} onClick={() => void flex(viewer.nickname!, up.look.level, t)}>
              {t("내 목소리 페이지 자랑하기", "Share my voice page")}
            </button>
            <Link href="/pass" className={s.alt} onClick={() => onClose()}>
              {t("패스 보기", "Open Voice Pass")}
            </Link>
          </>
        ) : (
          <Link href="/pass" className={s.go} onClick={() => onClose()}>
            {t("패스 보기", "Open Voice Pass")}
          </Link>
        )}
        <button type="button" className={s.close} onClick={() => onClose()}>
          {t("닫기", "Close")}
        </button>
      </div>
    </div>
  );
}

/** 자랑하기 — 꾸민 모습이 그대로 보이는 내 목소리 페이지 링크를 보낸다 */
async function flex(nickname: string, level: number, t: (ko: string, en: string) => string) {
  const url = `${location.origin}/v/${encodeURIComponent(nickname)}`;
  const text = t(`MIMIC VOICE PASS LV.${level} 달성 — 내 목소리 들어 봐`, `Hit LV.${level} on MIMIC Voice Pass — listen to my voice`);
  track("weekly_share", { via: "levelup" });
  try {
    if (navigator.share) {
      await navigator.share({ title: "MIMIC", text, url });
      return;
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    alert(t("링크를 복사했어요", "Link copied"));
  } catch {}
}
