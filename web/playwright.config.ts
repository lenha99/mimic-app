import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * 스모크 테스트 — 배포된 앱의 핵심 흐름이 살아 있는지 1~2분 안에 본다.
 *
 *   npm run smoke                         # 운영(mimic-web-omega)
 *   SMOKE_URL=https://<미리보기> npm run smoke
 *
 * 가짜 마이크: 크롬이 e2e/voice.wav(TTS 낭독)를 마이크 입력처럼 흘려 준다.
 * 운영에 아무것도 쓰지 않는다 — e2e/smoke.spec.ts 의 readOnly() 참고.
 */
const voice = path.resolve("e2e/voice.wav");
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["Pixel 7"],
    baseURL: process.env.SMOKE_URL ?? "https://mimic-web-omega.vercel.app",
    locale: "ko-KR",
    permissions: ["microphone"],
    // 미리보기 배포가 Vercel 인증으로 막혀 있으면 우회 토큰(Vercel → Deployment Protection)
    extraHTTPHeaders: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        `--use-file-for-fake-audio-capture=${voice}%noloop`,
      ],
    },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
