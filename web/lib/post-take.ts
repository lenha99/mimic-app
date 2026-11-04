import { readLocalAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { cleanNickname, readNickname } from "@/lib/nickname";
import type { Analysis } from "@/lib/voice-analysis";
import { polishVoice } from "@/lib/voice-polish";
import type { Week } from "@/lib/weekly";

/**
 * 테이크 하나를 갤러리에 바로 올린다 — 버튼 한 번.
 *
 * 11/4: 올리기 패널을 연 사람이 그대로 닫고 나갔다. 패널(공개 안내·닉네임·보정·인스타 동의)이
 * 망설일 시간을 줬다. 이제 누르면 바로 올라가고, 마음이 바뀌면 5초 안에 되돌린다(undoPost).
 * 닉네임은 기기에 저장된 게 있으면 쓰고, 없으면 서버가 "익명의 목소리"로 둔다.
 * 보정은 끄지 않았으면 언제나 켠다(mimic.polish).
 */
export type PostResult =
  | { ok: true; id: string; token: string | null; rank: number; total: number; replaced: boolean }
  | { ok: false; needLogin: boolean; error: string | null };

export async function postTake(opts: {
  blob: Blob;
  analysis: Analysis | null | undefined;
  week: Week;
  token?: string | null;
}): Promise<PostResult> {
  const { blob, analysis, week } = opts;
  try {
    const duration = analysis?.duration ?? (await blobDuration(blob));
    const file = (polishOn() ? await polishVoice(blob).catch(() => null) : null) ?? blob;
    const ext = file.type.includes("wav") ? "wav" : file.type.includes("mp4") ? "m4a" : "webm";
    const body = new FormData();
    body.append("file", file, `take.${ext}`);
    body.append("week", week.id);
    body.append("client", clientId());
    const nick = cleanNickname(readNickname());
    if (nick) body.append("name", nick);
    if (opts.token) body.append("token", opts.token);
    body.append("duration", String(Math.round(duration * 10) / 10));
    body.append("bars", JSON.stringify(downsample(analysis?.bars ?? [], 40)));
    const avatar = readLocalAvatar();
    if (avatar) body.append("avatar", JSON.stringify(avatar));
    const res = await fetch("/api/weekly/entries", { method: "POST", body });
    const d = (await res.json().catch(() => ({}))) as {
      id?: string;
      token?: string | null;
      rank?: number;
      total?: number;
      replaced?: boolean;
      error?: string;
    };
    if (res.status === 401) return { ok: false, needLogin: true, error: d.error ?? null };
    if (!res.ok || !d.id) return { ok: false, needLogin: false, error: d.error ?? null };
    writeMyLatest({ id: d.id, name: nick ?? "", avatar: readLocalAvatar(), at: Date.now() });
    return {
      ok: true,
      id: d.id,
      token: d.token ?? opts.token ?? null,
      rank: d.rank ?? 0,
      total: d.total ?? 1,
      replaced: Boolean(d.replaced),
    };
  } catch {
    return { ok: false, needLogin: false, error: null };
  }
}

/**
 * 방금 올린 내 목소리 — 서버 캐시가 새로 그려지기 전에도 홈 스토리 맨 앞에 바로 보이게(낙관적 표시).
 * 서버 목록에 들어오면 중복이라 빠진다. 하루가 지나면 버린다.
 */
const LATEST = "mimic.myLatest";
export type MyLatest = { id: string; name: string; avatar: unknown; at: number };

export function readMyLatest(): MyLatest | null {
  try {
    const v = JSON.parse(localStorage.getItem(LATEST) ?? "null") as MyLatest | null;
    return v && typeof v.id === "string" && Date.now() - v.at < 86_400_000 ? v : null;
  } catch {
    return null;
  }
}

function writeMyLatest(v: MyLatest | null): void {
  try {
    if (v) localStorage.setItem(LATEST, JSON.stringify(v));
    else localStorage.removeItem(LATEST);
  } catch {}
}

/** 방금 올린 걸 되돌린다 — 서버에서 지운다(게스트는 열쇠로, 로그인은 계정으로). */
export async function undoPost(id: string, token: string | null): Promise<boolean> {
  const q = new URLSearchParams({ id });
  if (token) q.set("token", token);
  try {
    const res = await fetch(`/api/weekly/entries?${q}`, { method: "DELETE" });
    if (res.ok && readMyLatest()?.id === id) writeMyLatest(null);
    return res.ok;
  } catch {
    return false;
  }
}

/** 되돌리기 시간 */
export const UNDO_MS = 5000;

function polishOn(): boolean {
  try {
    return localStorage.getItem("mimic.polish") !== "off";
  } catch {
    return true;
  }
}

function downsample(bars: number[], n: number): number[] {
  if (bars.length <= n) return bars.map((b) => Math.round(b * 100) / 100);
  const out: number[] = [];
  const step = bars.length / n;
  for (let i = 0; i < n; i++) {
    const slice = bars.slice(Math.floor(i * step), Math.floor((i + 1) * step));
    out.push(Math.round(Math.max(...slice) * 100) / 100);
  }
  return out;
}

function blobDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(a.duration) ? a.duration : 15);
    };
    a.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(15);
    };
    a.src = url;
  });
}
