// Takes iPhone-size screenshots (WebKit) of the whole flow into docs/screenshots/.
// Run: npm run screenshots
import { devices, webkit } from "@playwright/test";
import { mkdir, readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs/screenshots");
await mkdir(out, { recursive: true });
for (const f of await readdir(out)) if (f.endsWith(".png")) await unlink(join(out, f));

const server = await createServer({ root, server: { port: 5175, strictPort: true }, logLevel: "error" });
await server.listen();
const base = "http://localhost:5175";

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 15"] });
const page = await ctx.newPage();
const shot = async (name, full = false) => {
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log("screenshot", name);
};

try {
  await page.goto(base);
  await shot("01-home");

  await page.getByRole("button", { name: "Grade a card" }).click();
  await shot("02-photos-guide");

  await page.getByRole("button", { name: "‹ Home" }).click();
  await page.getByRole("button", { name: /Try the demo/ }).click();
  await page.getByTestId("slot-back").locator("img").first().waitFor();
  await shot("03-photos-demo");

  await page.getByTestId("file-front").setInputFiles(join(root, "tests/fixtures/glare-front.jpg"));
  await page.getByTestId("issue-front-glare").waitFor();
  await page.getByTestId("slot-front").scrollIntoViewIfNeeded();
  await shot("04-glare-warning");

  await page.getByTestId("file-front").setInputFiles(join(root, "public/demo/front.jpg"));
  await page.getByTestId("slot-front").locator("img").first().waitFor();
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await page.getByText("Analyzing…").waitFor();
  await shot("05-analyzing");

  await page.getByTestId("booster-open").waitFor();
  await shot("06-booster-pack");
  await page.getByTestId("booster-open").click();
  await page.getByTestId("booster-continue").waitFor();
  await page.waitForTimeout(500);
  await shot("07-booster-reveal");
  await page.getByTestId("booster-continue").click();

  await page.getByTestId("grade").waitFor();
  await shot("08-result");
  await page.getByTestId("finding-f1").click();
  await page.waitForTimeout(700);
  await shot("09-result-zoom");
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot("10-result-full", true);

  await page.getByRole("button", { name: "‹ Home" }).click();
  await page.getByRole("button", { name: "Grade a card" }).click();
  await page.getByTestId("file-front").setInputFiles(join(root, "public/demo/front.jpg"));
  await page.getByTestId("file-back").setInputFiles(join(root, "public/demo/back.jpg"));
  await page.getByTestId("slot-back").locator("img").first().waitFor();
  await page.getByRole("button", { name: /^Analyze/ }).click();
  await page.getByRole("dialog").waitFor();
  await shot("11-consent");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "‹ Home" }).click();
  await page.getByRole("button", { name: /My cards/ }).click();
  await shot("12-my-cards");
} finally {
  await browser.close();
  await server.close();
}
