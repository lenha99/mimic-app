import { expect, test, type Page } from "@playwright/test";

/**
 * 핵심 흐름: 홈 → 연습실 → 녹음 → 결과 → 들려주기.
 *
 * 운영을 상대로 돌리므로 **읽기만** 한다.
 *  - 통계: localStorage mimic.internal=on (track.ts 가 아예 안 보냄) + track 요청도 막음
 *  - 쓰기: 우리 API·Supabase·Modal 로 가는 GET 아닌 요청은 전부 가짜 응답.
 *    들려주기(POST /api/weekly/entries)도 가짜 id 를 돌려준다 — 버튼이 요청을 보내고
 *    화면이 "완료"로 넘어가는지까지만 본다. 서버 저장 로직은 여기서 검사하지 않는다.
 */
async function readOnly(page: Page) {
  const writes: string[] = [];
  await page.addInitScript(() => {
    try {
      localStorage.setItem("mimic.internal", "on");
    } catch {}
  });
  await page.route(/meme-scoring-track\.modal\.run/, (r) => r.fulfill({ status: 204 }));
  await page.route(/\/api\/|supabase\.co|modal\.run/, (r) => {
    const req = r.request();
    if (req.method() === "GET" || req.method() === "HEAD" || req.method() === "OPTIONS") return r.fallback();
    const url = new URL(req.url());
    writes.push(`${req.method()} ${url.pathname}`);
    if (url.pathname === "/api/weekly/entries" && req.method() === "POST") {
      return r.fulfill({ json: { id: "smoke-test", token: "smoke", rank: 1, total: 1 } });
    }
    return r.fulfill({ status: 200, json: {} });
  });
  return writes;
}

/** 화면이 통째로 죽었는지 — Next 에러 화면 / 빈 화면 */
async function alive(page: Page) {
  await expect(page.getByText(/Application error|This page couldn.t load/i)).toHaveCount(0);
  await expect(page.locator("body")).not.toBeEmpty();
}

test("홈이 열린다", async ({ page }) => {
  await readOnly(page);
  const res = await page.goto("/");
  expect(res?.status(), "홈 응답 코드").toBeLessThan(400);
  await alive(page);
  // 하단 탭의 연습실 링크 — 홈 뼈대가 그려졌다는 뜻
  await expect(page.locator('a[href*="/practice"]').first()).toBeVisible();
});

test("연습실: 녹음 → 결과 → 들려주기", async ({ page }) => {
  const writes = await readOnly(page);
  const res = await page.goto("/practice/sc_a_news_open");
  expect(res?.status(), "연습실 응답 코드").toBeLessThan(400);
  await alive(page);

  await page.getByRole("button", { name: /녹음하고 읽기|한 번 더 읽기/ }).click();
  // 3·2·1 뒤 녹음 중 — 가짜 마이크 소리가 들어오는 동안 기다렸다가 끝낸다
  const done = page.getByRole("button", { name: "다 읽었어요 · 결과 보기" });
  await expect(done).toBeEnabled({ timeout: 10_000 });
  await page.waitForTimeout(9_000);
  await done.click();

  // 결과 — 들려주기 버튼이 나와야 한다(분석 실패·녹음 실패면 안 나온다)
  const post = page.getByRole("button", { name: /이 목소리 들려주기/ });
  await expect(post, "녹음 뒤 들려주기 버튼").toBeVisible({ timeout: 30_000 });
  await post.click();

  await expect(page.getByRole("dialog", { name: "들려주기 완료" })).toBeVisible({ timeout: 15_000 });
  expect(writes, "들려주기 요청이 나갔는지").toContain("POST /api/weekly/entries");
});
