"use client";

import { useEffect, useState } from "react";

/**
 * 운영자에게만 — 이 출전작을 ⭐ 운영자 픽으로 고정/해제, 인스타 소개 동의 여부.
 * 운영자가 아니면 아무것도 안 그린다(서버도 아무것도 안 알려 준다).
 */
type S = { admin: boolean; ready?: boolean; featured?: boolean; promoOk?: boolean };

export function AdminPick({ entryId }: { entryId: string }) {
  const [s, setS] = useState<S | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/feature?entry=${entryId}`)
      .then((r) => r.json())
      .then((d: S) => alive && setS(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [entryId]);

  if (!s?.admin) return null;
  if (s.ready === false) return <p style={box}>운영자 · DB 에 픽 칸이 아직 없어요 (npx supabase db push)</p>;

  const toggle = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/feature", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entry: entryId, on: !s.featured }),
      });
      const d = (await res.json()) as { featured?: boolean; error?: string };
      if (res.ok) {
        setS({ ...s, featured: d.featured });
        setMsg(d.featured ? "홈·갤러리에 고정했어요 (최대 30초 뒤 반영)" : "픽에서 뺐어요");
      } else setMsg(d.error ?? "실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={box}>
      <button type="button" onClick={() => void toggle()} disabled={busy} style={btn(s.featured)}>
        {s.featured ? "⭐ 운영자 픽 해제" : "⭐ 운영자 픽으로 고정"}
      </button>
      <span style={{ fontSize: 12, color: s.promoOk ? "var(--volt)" : "var(--ash)" }}>
        {s.promoOk ? "📸 인스타 소개 OK (본인이 체크함)" : "📸 인스타 소개 동의 안 함"}
      </span>
      {msg && <span style={{ fontSize: 12, color: "var(--ash)" }}>{msg}</span>}
    </div>
  );
}

const box: React.CSSProperties = {
  margin: "10px auto 0",
  padding: "10px 12px",
  maxWidth: 360,
  display: "grid",
  gap: 6,
  justifyItems: "center",
  borderRadius: 14,
  border: "1px dashed rgba(255, 201, 60,0.45)",
  fontSize: 12,
  color: "var(--ash)",
};

const btn = (on?: boolean): React.CSSProperties => ({
  minHeight: 40,
  padding: "0 16px",
  borderRadius: 99,
  border: on ? "1px solid var(--volt)" : 0,
  background: on ? "none" : "var(--volt)",
  color: on ? "var(--volt)" : "var(--stage)",
  font: "inherit",
  fontSize: 13.5,
  fontWeight: 900,
  cursor: "pointer",
});
