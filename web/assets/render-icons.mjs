// 앱 아이콘 PNG 를 assets/icon.svg 하나에서 만든다. 아이콘을 바꾸면 다시 돌린다:
//   node assets/render-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync(new URL("./icon.svg", import.meta.url));
const out = (p) => new URL(`../${p}`, import.meta.url).pathname.replace(/^\/(\w:)/, "$1");

for (const [file, size] of [
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["app/apple-icon.png", 180],
]) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(out(file));
  console.log(file, size);
}

// 파비콘(.ico) — 16·32 PNG 를 그대로 담는 ICO. 요즘 브라우저는 PNG 든 ICO 를 읽는다.
const pngs = [];
for (const size of [16, 32, 48]) {
  pngs.push({ size, buf: await sharp(svg, { density: 300 }).resize(size, size).png().toBuffer() });
}
const head = Buffer.alloc(6 + 16 * pngs.length);
head.writeUInt16LE(0, 0);
head.writeUInt16LE(1, 2);
head.writeUInt16LE(pngs.length, 4);
let offset = head.length;
pngs.forEach(({ size, buf }, i) => {
  const o = 6 + i * 16;
  head.writeUInt8(size, o);
  head.writeUInt8(size, o + 1);
  head.writeUInt16LE(1, o + 4);
  head.writeUInt16LE(32, o + 6);
  head.writeUInt32LE(buf.length, o + 8);
  head.writeUInt32LE(offset, o + 12);
  offset += buf.length;
});
const { writeFileSync } = await import("node:fs");
writeFileSync(out("app/favicon.ico"), Buffer.concat([head, ...pngs.map((p) => p.buf)]));
console.log("app/favicon.ico", pngs.map((p) => p.size).join("/"));

// 기본 공유 카드 — 페이지가 따로 그림을 안 주면 카톡 미리보기에 이게 뜬다.
await sharp(readFileSync(new URL("./og-default.svg", import.meta.url)), { density: 144 })
  .resize(1200, 630)
  .png()
  .toFile(out("public/og-default.png"));
console.log("public/og-default.png 1200x630");
