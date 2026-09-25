import { Fragment, isValidElement, type ReactNode } from "react";

/**
 * 훅 없는 SVG 컴포넌트를 문자열로 — 미리보기 카드(/api/og) 전용.
 *
 * 카드 렌더러(Satori)에 SVG 트리를 그대로 넘기면 중첩 컴포넌트를 직렬화하다 깨지고,
 * 라우트에서 react-dom/server 는 Next 가 막는다. 캐릭터(VoiceAvatar)는 상태 없는
 * 함수 컴포넌트뿐이라 직접 펼쳐도 충분하다. 훅을 쓰는 컴포넌트는 여기 넣으면 안 된다.
 */
const KEEP_CAMEL = new Set(["viewBox", "preserveAspectRatio"]);

function attrName(key: string): string | null {
  if (key === "children" || key === "key" || key === "ref") return null;
  if (key === "className") return "class";
  if (KEEP_CAMEL.has(key) || key.startsWith("aria-") || key.startsWith("data-")) return key;
  return key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
}

function esc(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function svgToString(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return esc(String(node));
  if (Array.isArray(node)) return node.map(svgToString).join("");
  if (!isValidElement(node)) return "";

  const { type } = node;
  const props = (node.props ?? {}) as Record<string, unknown>;
  if (type === Fragment) return svgToString(props.children as ReactNode);
  if (typeof type === "function") {
    return svgToString((type as (p: Record<string, unknown>) => ReactNode)(props));
  }
  if (typeof type !== "string") return "";

  let attrs = type === "svg" ? ' xmlns="http://www.w3.org/2000/svg"' : "";
  for (const [k, v] of Object.entries(props)) {
    const name = attrName(k);
    if (!name || v === undefined || v === null || v === false) continue;
    attrs += ` ${name}="${esc(String(v))}"`;
  }
  return `<${type}${attrs}>${svgToString(props.children as ReactNode)}</${type}>`;
}
