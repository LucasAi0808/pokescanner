import { expect, test } from "@playwright/test";
import {
  FAKE_KEY,
  analyzeWithKey,
  dumpStorage,
  liveOutput,
  message,
  mockAnthropic,
  skipBooster,
  uploadPair,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("demo mode works without a key and without network requests", async ({ page }) => {
  const api = await mockAnthropic(page, () => ({ status: 500 }));
  await page.getByRole("button", { name: /Try the demo/ }).click();
  await expect(page.getByTestId("slot-front").locator("img").first()).toBeVisible();
  await expect(page.getByTestId("slot-back").locator("img").first()).toBeVisible();

  // Local centering measurement on the demo front (borders 70/47 => ~60/40).
  await expect(page.getByTestId("slot-front")).toContainText(/L\/R (59|60|61)\/(41|40|39)/);

  await page.getByRole("button", { name: /^Analyze/ }).click();
  await expect(page.getByRole("dialog", { name: "Before the analysis" })).toHaveCount(0); // no consent sheet in demo mode

  // The fresh result opens like a booster pack.
  await page.getByTestId("booster-open").click({ force: true }); // the pack wiggles on purpose
  await expect(page.getByTestId("booster").getByTestId("grade")).toHaveText(/7–8/);
  await expect(page.getByTestId("rarity").locator(".star.on")).toHaveCount(3);
  await page.getByTestId("booster-continue").click();

  await expect(page.getByTestId("grade")).toHaveText(/7–8/);
  await expect(page.getByTestId("demo-banner")).toBeVisible();

  // Tapping the finding on the back switches image and zooms in.
  await page.getByTestId("finding-f1").click();
  await expect(page.getByRole("tab", { name: /Back/ })).toHaveAttribute("aria-selected", "true");
  await expect
    .poll(async () => Number(await page.getByTestId("viewer-stage").getAttribute("data-scale")))
    .toBeGreaterThan(1.5);

  expect(api.posts).toHaveLength(0);
});

test("full flow with simulated API: upload, response format, history without new requests, delete", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.text()));
  const api = await mockAnthropic(page, () => ({ body: message(liveOutput()) }));

  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  expect(api.posts).toHaveLength(0); // nothing is sent before Analyze

  await page.getByRole("button", { name: /^Analyze/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Anthropic (api.anthropic.com)");
  await expect(sheet).toContainText("Claude Opus 5.5");
  await expect(sheet).toContainText(/about \$\d+\.\d\d/);
  await analyzeWithKey(page);
  await skipBooster(page);

  await expect(page.getByTestId("grade")).toHaveText(/7–8/);
  await expect(page.getByTestId("demo-banner")).toHaveCount(0);
  await expect(page.getByTestId("card-name")).toHaveValue("Test card");

  // Shape of the request.
  expect(api.posts).toHaveLength(1);
  const { headers, body } = api.posts[0]!;
  // SDK 1.x sends the key as a Bearer token (API version 2026-10-21).
  expect(headers["authorization"]).toBe(`Bearer ${FAKE_KEY}`);
  expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  expect(body.model).toBe("claude-opus-5-5");
  expect(body.output_config.format.type).toBe("json_schema");
  expect(body.fallbacks).toBe("default");
  expect(body.system).toContain("Everything the user sees must be in English");
  const imgs = body.messages[0].content.filter((c: any) => c.type === "image");
  expect(imgs).toHaveLength(2);
  expect(imgs[0].source.media_type).toBe("image/jpeg");
  const texts = body.messages[0].content.filter((c: any) => c.type === "text").map((c: any) => c.text);
  expect(texts[0]).toContain('Image id "front"');
  expect(texts[0]).toMatch(/\d+×\d+ px/);

  // Fix the card details and add an actual grade.
  await page.getByTestId("card-name").fill("Pikachu (fixed)");
  await page.getByTestId("save-card").click();
  await expect(page.getByTestId("save-card")).toHaveText(/Saved/);
  await page.getByTestId("actual-add").click();
  await page.getByTestId("actual-grade").fill("8");
  await page.getByTestId("actual-save").click();
  await expect(page.getByTestId("actual")).toContainText("Within the estimate");

  // The key must never end up in storage or logs.
  const stored = await dumpStorage(page);
  expect(stored).toContain("Pikachu (fixed)");
  expect(stored).not.toContain(FAKE_KEY);
  expect(stored).not.toContain("sk-ant");
  expect(logs.join("\n")).not.toContain(FAKE_KEY);

  // Reload: the history is still there, opening it makes no requests and shows no booster.
  await page.reload();
  await page.getByRole("button", { name: /My cards/ }).click();
  await expect(page.getByTestId("history-row")).toHaveCount(1);
  await expect(page.getByTestId("history-row")).toContainText("Pikachu (fixed)");
  await page.getByTestId("history-row").click();
  await expect(page.getByTestId("booster")).toHaveCount(0);
  await expect(page.getByTestId("grade")).toHaveText(/7–8/);
  await expect(page.getByTestId("actual")).toContainText("PSA");
  expect(api.posts).toHaveLength(1);

  // The key was gone after the reload (memory only).
  expect(await dumpStorage(page)).not.toContain(FAKE_KEY);

  page.once("dialog", (d) => d.accept());
  await page.getByTestId("delete").click();
  await expect(page.getByText("No cards graded yet.")).toBeVisible();
});

test("a top grade gets four stars and the holo foil", async ({ page }) => {
  await mockAnthropic(page, () => ({ body: message(liveOutput({ grade_low: 9, grade_high: 10 })) }));
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await analyzeWithKey(page);
  await page.getByTestId("booster-open").click({ force: true }); // the pack wiggles on purpose
  await expect(page.getByTestId("rarity").locator(".star.on")).toHaveCount(4);
  await expect(page.getByTestId("booster").locator(".holo")).toHaveCount(1);
  await expect(page.getByTestId("booster")).toContainText("Mint candidate");
  // The oversized spinning rays must never make the pack screen scroll sideways.
  const scrollLeft = await page.evaluate(() => {
    const b = document.querySelector(".booster") as HTMLElement;
    b.scrollLeft = 300;
    return b.scrollLeft;
  });
  expect(scrollLeft).toBe(0);
});

test("an invalid key gives a clear error, the photos stay and the key is forgotten", async ({ page }) => {
  const api = await mockAnthropic(page, () => ({
    status: 401,
    body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
  }));
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await analyzeWithKey(page);
  await expect(page.getByRole("alert")).toContainText("did not accept the API key");
  await expect(page.getByTestId("slot-front").locator("img").first()).toBeVisible();
  expect(api.posts).toHaveLength(1); // 401 is not retried

  // The next attempt asks for a new key.
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("A key is already in memory");
});

test("cancelled analysis: nothing is saved and the photos stay", async ({ page }) => {
  await mockAnthropic(page, () => ({ body: message(liveOutput()), delayMs: 8000 }));
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await analyzeWithKey(page);
  await expect(page.getByText("Analyzing…")).toBeVisible();
  await page.getByTestId("cancel").click();
  await expect(page.getByRole("alert")).toContainText("cancelled");
  await expect(page.getByTestId("slot-back").locator("img").first()).toBeVisible();
  await page.getByRole("button", { name: "‹ Home" }).click();
  await expect(page.getByRole("button", { name: "My cards", exact: true })).toBeVisible();
});

test("a reply in the wrong format gives a clear error", async ({ page }) => {
  await mockAnthropic(page, () => ({ body: message("{ this is not json") }));
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await analyzeWithKey(page);
  await expect(page.getByRole("alert")).toContainText("format");
});

test("an overloaded API (529) gives a clear error after one retry", async ({ page }) => {
  const api = await mockAnthropic(page, () => ({
    status: 529,
    headers: { "retry-after-ms": "10" },
    body: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
  }));
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await analyzeWithKey(page);
  await expect(page.getByRole("alert")).toContainText("overloaded");
  expect(api.posts).toHaveLength(2);
});

test("the model declines (refusal)", async ({ page }) => {
  await mockAnthropic(page, () => ({ body: message("", { stop_reason: "refusal" }) }));
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await analyzeWithKey(page);
  await expect(page.getByRole("alert")).toContainText("declined");
});

test("the model abstains from a grade", async ({ page }) => {
  await mockAnthropic(page, () => ({
    body: message(
      liveOutput({
        status: "abstained",
        abstain_reason: "Glare hides most of the front.",
        grade_low: null,
        grade_high: null,
        image_issues: [{ image: "front", problem: "Strong glare", advice: "Retake without flash." }],
      }),
    ),
  }));
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await analyzeWithKey(page);
  await skipBooster(page);
  await expect(page.getByTestId("grade")).toHaveText("No grade");
  await expect(page.getByText("Glare hides most of the front.")).toBeVisible();
  await page.getByRole("button", { name: "Retake photos" }).click();
  await expect(page.getByTestId("slot-front").locator("img").first()).toBeVisible();
});

test("the photo check warns about glare and a cut-off corner", async ({ page }) => {
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page, "tests/fixtures/glare-front.jpg", "tests/fixtures/cut-corner-back.jpg");
  await expect(page.getByTestId("issue-front-glare")).toBeVisible();
  await expect(page.getByTestId("issue-front-glare")).toContainText("Glare hides the surface");
  await expect(
    page.getByTestId("slot-back").locator('[data-testid^="issue-back-"]').filter({ hasText: /corner|edges|shape/ }),
  ).not.toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analyze anyway" })).toBeEnabled();
});

test("the draft survives a reload (iOS may reload after the camera)", async ({ page }) => {
  await page.getByRole("button", { name: "Grade a card" }).click();
  await uploadPair(page);
  // Wait until the draft is written to IndexedDB before reloading.
  await expect.poll(async () => (await dumpStorage(page)).match(/"slot":"(front|back)"/g)?.length ?? 0).toBe(2);
  await page.reload();
  await expect(page.getByText("were restored")).toBeVisible();
  await expect(page.getByTestId("slot-front").locator("img").first()).toBeVisible();
});

test("the whole interface is in English", async ({ page }) => {
  const swedish = /[åäöÅÄÖ]|\b(och|bilden|kortet|inte)\b/;
  expect(await page.locator("body").innerText()).not.toMatch(swedish);
  await page.getByRole("button", { name: /Try the demo/ }).click();
  await page.getByTestId("slot-back").locator("img").first().waitFor();
  expect(await page.locator("body").innerText()).not.toMatch(swedish);
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await skipBooster(page);
  await page.getByTestId("grade").waitFor();
  expect(await page.locator("body").innerText()).not.toMatch(swedish);
});
