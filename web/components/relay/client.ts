"use client";

import { readLocalAvatar } from "@/lib/avatar";
import { clientId } from "@/lib/client-id";
import { cleanNickname, readNickname } from "@/lib/nickname";
import { summaries } from "@/lib/take-store";
import {
  chosenLine,
  chosenTake,
  prefFromPractice,
  takeUrl,
  ttsUrl,
  type Assignment,
  type CutLine,
  type FinalCut,
  type LineView,
  type RoleType,
  type SceneView,
} from "@/lib/relay";
import type { PlayItem } from "./audio";

export type { Assignment };

export async function fetchScene(id: string): Promise<{ scene: SceneView; level: number } | null> {
  try {
    const r = await fetch(`/api/relay/scene/${id}?client=${clientId()}`, { cache: "no-store" });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

let prefCache: RoleType | null | undefined;
export async function myPref(): Promise<RoleType | null> {
  if (prefCache !== undefined) return prefCache;
  try {
    const m = await summaries();
    prefCache = prefFromPractice([...m.keys()]);
  } catch {
    prefCache = null;
  }
  return prefCache;
}

const SKIP = "mimic.relaySkip";
export function readSkip(): string[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(SKIP) ?? "[]");
    return Array.isArray(v) ? v.slice(-30) : [];
  } catch {
    return [];
  }
}
export function addSkip(key: string) {
  try {
    sessionStorage.setItem(SKIP, JSON.stringify([...readSkip(), key].slice(-30)));
  } catch {}
}

export async function assignNext(sceneId?: string | null): Promise<{ assignment: Assignment | null; scene: SceneView | null; level: number } | null> {
  try {
    const r = await fetch("/api/relay/assign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ client: clientId(), pref: await myPref(), skip: readSkip(), sceneId: sceneId ?? undefined }),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function postTake(lineId: string, blob: Blob, duration: number, kind: "line" | "adlib" = "line"): Promise<{ ok: true; id: string; claimed: boolean; late: boolean } | { ok: false; error: string }> {
  try {
    const body = new FormData();
    const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
    body.append("file", blob, `take.${ext}`);
    body.append("line", lineId);
    body.append("kind", kind);
    body.append("duration", String(Math.round(duration * 100) / 100));
    body.append("client", clientId());
    const nick = cleanNickname(readNickname());
    if (nick) body.append("name", nick);
    const av = readLocalAvatar();
    if (av) body.append("avatar", JSON.stringify(av));
    const r = await fetch("/api/relay/takes", { method: "POST", body });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.id) return { ok: false, error: d.error ?? "출연하지 못했어요. 다시 해 주세요." };
    return { ok: true, id: d.id, claimed: Boolean(d.claimed), late: Boolean(d.late) };
  } catch {
    return { ok: false, error: "인터넷 연결을 확인해 주세요." };
  }
}

export async function undoTake(id: string): Promise<boolean> {
  try {
    const r = await fetch(`/api/relay/takes/${id}?client=${clientId()}`, { method: "DELETE" });
    return r.ok;
  } catch {
    return false;
  }
}

export async function postJson<T = Record<string, unknown>>(url: string, body: Record<string, unknown>, method = "POST"): Promise<{ ok: boolean; status: number; data: T & { error?: string; needLogin?: boolean } }> {
  try {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ client: clientId(), ...body }) });
    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "인터넷 연결을 확인해 주세요." } as T & { error?: string } };
  }
}

// ---- 재생 목록 ----

function itemOfCut(l: CutLine): PlayItem {
  return {
    key: l.lineId,
    url: l.takeId ? takeUrl(l.takeId) : ttsUrl({ lineId: l.lineId, tts: l.tts }),
    text: l.text,
    adlib: l.adlibId ? takeUrl(l.adlibId) : null,
  };
}

/** 개봉작(박제된 정식판) → 재생 목록. twist 를 주면 10번을 반전판으로 */
export function itemsOfFinal(f: FinalCut, twist = false): { items: PlayItem[]; lines: CutLine[] } {
  const lines = f.lines.map((l) => (twist && l.n === 10 && f.twist ? f.twist : l));
  return { items: lines.map((l) => itemOfCut(l)), lines };
}

/** 상영 중 장면 — 지금 상태의 정식판 미리 듣기 */
export function previewLines(s: SceneView): CutLine[] {
  const out: CutLine[] = [];
  for (let n = 1; n <= 10; n++) {
    const { line } = chosenLine(n, s.lines, s.takes);
    if (!line) continue;
    const take = chosenTake(line, s.takes, s.owners);
    const adlib = take ? s.takes.find((t) => t.lineId === line.id && t.kind === "adlib" && t.owner === take.owner) : undefined;
    out.push({
      n,
      role: line.role,
      roleName: s.roles.find((r) => r.id === line.role)?.name ?? line.role,
      text: line.text,
      dir: line.dir,
      lineId: line.id,
      tts: line.tts,
      sec: take?.sec || line.sec,
      takeId: take?.id ?? null,
      owner: take?.owner ?? null,
      name: take?.name ?? null,
      avatar: take?.avatar ?? null,
      adlibId: adlib?.id ?? null,
      authorName: line.candidate ? line.authorName : null,
      candidate: line.candidate,
    });
  }
  return out;
}
export function itemsOfPreview(s: SceneView): { items: PlayItem[]; lines: CutLine[] } {
  const lines = previewLines(s);
  return { items: lines.map((l) => itemOfCut(l)), lines };
}

export function lineItem(l: LineView, takeId?: string | null): PlayItem {
  return { key: l.id, url: takeId ? takeUrl(takeId) : ttsUrl(l), text: l.text };
}
