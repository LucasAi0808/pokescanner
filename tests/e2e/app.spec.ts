import { expect, test } from "@playwright/test";
import { FAKE_KEY, dumpStorage, fillConsent, liveOutput, message, mockAnthropic, uploadPair } from "./helpers";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("demoläget fungerar utan nyckel och utan nätverksanrop", async ({ page }) => {
  const api = await mockAnthropic(page, () => ({ status: 500 }));
  await page.getByRole("button", { name: "Prova demo utan nyckel" }).click();
  await expect(page.getByTestId("slot-front").locator("img").first()).toBeVisible();
  await expect(page.getByTestId("slot-back").locator("img").first()).toBeVisible();

  // Lokal centreringsmätning på demokortets framsida (ramar 70/47 => ~60/40).
  await expect(page.getByTestId("slot-front")).toContainText(/V\/H (59|60|61)\/(41|40|39)/);

  await page.getByRole("button", { name: /^Analysera/ }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0); // inget samtyckesark i demoläget
  await expect(page.getByTestId("grade")).toHaveText(/7–8/);
  await expect(page.getByTestId("demo-banner")).toBeVisible();

  // Tryck på fyndet på baksidan: visaren byter bild och zoomar in.
  await page.getByTestId("finding-f1").click();
  await expect(page.getByRole("tab", { name: /Baksida/ })).toHaveAttribute("aria-selected", "true");
  await expect
    .poll(async () => Number(await page.getByTestId("viewer-stage").getAttribute("data-scale")))
    .toBeGreaterThan(1.5);

  expect(api.posts).toHaveLength(0);
});

test("fullt flöde med simulerat API: uppladdning, svarsformat, historik utan nya anrop, radering", async ({ page }) => {
  const logs: string[] = [];
  page.on("console", (m) => logs.push(m.text()));
  const api = await mockAnthropic(page, () => ({ body: message(liveOutput()) }));

  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page);
  expect(api.posts).toHaveLength(0); // inget skickas före Analysera

  await page.getByRole("button", { name: /^Analysera/ }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Anthropic (api.anthropic.com)");
  await expect(sheet).toContainText("Claude Opus 5.5");
  await expect(sheet).toContainText(/ungefär .* kr/);
  await fillConsent(page);

  await expect(page.getByTestId("grade")).toHaveText(/7–8/);
  await expect(page.getByTestId("demo-banner")).toHaveCount(0);
  await expect(page.getByTestId("card-name")).toHaveValue("Testkort");

  // Anropets form.
  expect(api.posts).toHaveLength(1);
  const { headers, body } = api.posts[0]!;
  // SDK 1.x skickar nyckeln som Bearer-token (API-version 2026-10-21).
  expect(headers["authorization"]).toBe(`Bearer ${FAKE_KEY}`);
  expect(headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
  expect(body.model).toBe("claude-opus-5-5");
  expect(body.output_config.format.type).toBe("json_schema");
  expect(body.fallbacks).toBe("default");
  const imgs = body.messages[0].content.filter((c: any) => c.type === "image");
  expect(imgs).toHaveLength(2);
  expect(imgs[0].source.media_type).toBe("image/jpeg");
  const texts = body.messages[0].content.filter((c: any) => c.type === "text").map((c: any) => c.text);
  expect(texts[0]).toContain('Bild id "front"');
  expect(texts[0]).toMatch(/\d+×\d+ px/);

  // Rätta kortuppgifter och lägg in faktisk grade.
  await page.getByTestId("card-name").fill("Pikachu (rättat)");
  await page.getByTestId("save-card").click();
  await expect(page.getByTestId("save-card")).toHaveText(/Sparat/);
  await page.getByTestId("actual-add").click();
  await page.getByTestId("actual-grade").fill("8");
  await page.getByTestId("actual-save").click();
  await expect(page.getByTestId("actual")).toContainText("Inom uppskattningen");

  // Nyckeln får aldrig hamna i lagring eller loggar.
  const stored = await dumpStorage(page);
  expect(stored).toContain("Pikachu (rättat)");
  expect(stored).not.toContain(FAKE_KEY);
  expect(stored).not.toContain("sk-ant");
  expect(logs.join("\n")).not.toContain(FAKE_KEY);

  // Ladda om: historiken finns kvar, att öppna den gör inga anrop.
  await page.reload();
  await page.getByRole("button", { name: /Historik/ }).click();
  await expect(page.getByTestId("history-row")).toHaveCount(1);
  await expect(page.getByTestId("history-row")).toContainText("Pikachu (rättat)");
  await page.getByTestId("history-row").click();
  await expect(page.getByTestId("grade")).toHaveText(/7–8/);
  await expect(page.getByTestId("actual")).toContainText("PSA");
  expect(api.posts).toHaveLength(1);

  // Nyckeln försvann vid omladdningen (bara i minnet).
  expect(await dumpStorage(page)).not.toContain(FAKE_KEY);

  page.once("dialog", (d) => d.accept());
  await page.getByTestId("delete").click();
  await expect(page.getByText("Inga bedömningar ännu.")).toBeVisible();
});

test("ogiltig nyckel ger svenskt fel, bilderna ligger kvar och nyckeln glöms", async ({ page }) => {
  const api = await mockAnthropic(page, () => ({
    status: 401,
    body: { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
  }));
  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await fillConsent(page);
  await expect(page.getByRole("alert")).toContainText("API-nyckeln godkändes inte");
  await expect(page.getByTestId("slot-front").locator("img").first()).toBeVisible();
  expect(api.posts).toHaveLength(1); // 401 försöks inte igen

  // Nästa försök kräver ny nyckel.
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).not.toContainText("En nyckel finns redan");
});

test("avbruten analys: inget sparas och bilderna ligger kvar", async ({ page }) => {
  await mockAnthropic(page, () => ({ body: message(liveOutput()), delayMs: 8000 }));
  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await fillConsent(page);
  await expect(page.getByText("Analyserar…")).toBeVisible();
  await page.getByTestId("cancel").click();
  await expect(page.getByRole("alert")).toContainText("Analysen avbröts");
  await expect(page.getByTestId("slot-back").locator("img").first()).toBeVisible();
  await page.getByRole("button", { name: "‹ Start" }).click();
  await expect(page.getByRole("button", { name: "Historik", exact: true })).toBeVisible();
});

test("svar i fel format ger begripligt fel", async ({ page }) => {
  await mockAnthropic(page, () => ({ body: message("{ det här är inte json") }));
  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await fillConsent(page);
  await expect(page.getByRole("alert")).toContainText("format");
});

test("överbelastat API (529) ger begripligt fel efter ett nytt försök", async ({ page }) => {
  const api = await mockAnthropic(page, () => ({
    status: 529,
    headers: { "retry-after-ms": "10" },
    body: { type: "error", error: { type: "overloaded_error", message: "Overloaded" } },
  }));
  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await fillConsent(page);
  await expect(page.getByRole("alert")).toContainText("överbelastat");
  expect(api.posts).toHaveLength(2);
});

test("modellen avböjer (refusal)", async ({ page }) => {
  await mockAnthropic(page, () => ({ body: message("", { stop_reason: "refusal" }) }));
  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await fillConsent(page);
  await expect(page.getByRole("alert")).toContainText("avböjde");
});

test("modellen avstår från grade", async ({ page }) => {
  await mockAnthropic(page, () => ({
    body: message(
      liveOutput({
        status: "abstained",
        abstain_reason: "Blänk döljer större delen av framsidan.",
        grade_low: null,
        grade_high: null,
        image_issues: [{ image: "front", problem: "Kraftigt blänk", advice: "Ta om utan blixt." }],
      }),
    ),
  }));
  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page);
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await fillConsent(page);
  await expect(page.getByTestId("grade")).toHaveText("Ingen grade");
  await expect(page.getByText("Blänk döljer större delen av framsidan.")).toBeVisible();
  await page.getByRole("button", { name: "Ta om bilder" }).click();
  await expect(page.getByTestId("slot-front").locator("img").first()).toBeVisible();
});

test("kvalitetskontrollen varnar för blänk och avskuret hörn", async ({ page }) => {
  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page, "tests/fixtures/glare-front.jpg", "tests/fixtures/cut-corner-back.jpg");
  await expect(page.getByTestId("issue-front-glare")).toBeVisible();
  await expect(
    page.getByTestId("slot-back").locator('[data-testid^="issue-back-"]').filter({ hasText: /hörn|kanter|form/ }),
  ).not.toHaveCount(0);
  await expect(page.getByRole("button", { name: "Analysera ändå" })).toBeEnabled();
});

test("utkastet överlever omladdning (iOS kan ladda om efter kameran)", async ({ page }) => {
  await page.getByRole("button", { name: "Gradera kort" }).click();
  await uploadPair(page);
  // Vänta tills utkastet är skrivet till IndexedDB innan omladdningen.
  await expect.poll(async () => (await dumpStorage(page)).match(/"slot":"(front|back)"/g)?.length ?? 0).toBe(2);
  await page.reload();
  await expect(page.getByText("återställdes")).toBeVisible();
  await expect(page.getByTestId("slot-front").locator("img").first()).toBeVisible();
});
