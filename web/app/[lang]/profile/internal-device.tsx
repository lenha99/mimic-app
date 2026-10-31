"use client";

import { useEffect, useState } from "react";
import { clientId } from "@/lib/client-id";
import styles from "./profile.module.css";

/**
 * 운영자 메뉴 안의 한 줄 — 이 기기를 통계에서 자동으로 뺀다.
 *
 * 운영자로 로그인한 기기에서 프로필을 열기만 하면 등록된다. 폰·PC·카톡 인앱 브라우저는
 * 저장소가 따로라 각각 한 번씩 열어야 한다. 사용자 시점으로 세어 보고 싶을 땐 "다시 세기".
 */
type State = { kind: "busy" } | { kind: "on"; devices: number } | { kind: "off" } | { kind: "error"; msg: string };

export function InternalDevice() {
  const [state, setState] = useState<State>({ kind: "busy" });

  async function send(method: "POST" | "DELETE") {
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/admin/internal-device", {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client: clientId() }),
      });
      const j = (await res.json()) as { internal?: boolean; devices?: number; error?: string };
      if (!res.ok) return setState({ kind: "error", msg: j.error ?? "실패" });
      setState(j.internal ? { kind: "on", devices: j.devices ?? 0 } : { kind: "off" });
    } catch {
      setState({ kind: "error", msg: "연결이 안 돼요" });
    }
  }

  useEffect(() => {
    // 끈 적이 있는 기기는 다시 켜지 않는다.
    async function init() {
      let off = false;
      try {
        off = localStorage.getItem("mimic.internal") === "off";
      } catch {}
      if (off) {
        await Promise.resolve();
        setState({ kind: "off" });
      } else {
        await send("POST");
      }
    }
    void init();
  }, []);

  function toggle() {
    const next = state.kind === "on" ? "off" : "on";
    try {
      localStorage.setItem("mimic.internal", next);
    } catch {}
    void send(next === "on" ? "POST" : "DELETE");
  }

  const sub =
    state.kind === "busy"
      ? "확인하는 중…"
      : state.kind === "on"
        ? `이 기기는 통계·"N명 도전"에서 빠져요 · 등록된 기기 ${state.devices}대`
        : state.kind === "off"
          ? "이 기기도 사용자로 세는 중"
          : state.msg;

  return (
    <button type="button" className={styles.adminRow} onClick={toggle} disabled={state.kind === "busy"}>
      <span>
        <b>{state.kind === "on" ? "✓ 내 기기 통계 제외" : "내 기기 통계 제외"}</b>
        <small>{sub}</small>
      </span>
      <i aria-hidden="true">{state.kind === "on" ? "끄기" : "켜기"}</i>
    </button>
  );
}
