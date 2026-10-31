"use client";

import { useEffect } from "react";

/** 알림 화면을 열었으면 전부 읽음 — 화면에는 이번엔 그대로 강조해 두고, 다음에 열 때 꺼진다. */
export function MarkRead() {
  useEffect(() => {
    void fetch("/api/notifications", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
