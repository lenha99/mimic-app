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
