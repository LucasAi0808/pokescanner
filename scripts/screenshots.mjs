// Tar skärmdumpar av hela flödet i iPhone-storlek (WebKit) till docs/screenshots/.
// Kör: node scripts/screenshots.mjs
import { devices, webkit } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs/screenshots");
await mkdir(out, { recursive: true });

const server = await createServer({ root, server: { port: 5175, strictPort: true }, logLevel: "error" });
await server.listen();
const base = "http://localhost:5175";

const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 15"] });
const page = await ctx.newPage();
const shot = async (name, full = false) => {
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(out, `${name}.png`), fullPage: full });
  console.log("skärmdump", name);
};

try {
  await page.goto(base);
  await shot("01-start");

  await page.getByRole("button", { name: "Gradera kort" }).click();
  await shot("02-fotosteg-guide");

  await page.getByRole("button", { name: "‹ Start" }).click();
  await page.getByRole("button", { name: "Prova demo utan nyckel" }).click();
  await page.getByTestId("slot-back").locator("img").first().waitFor();
  await shot("03-fotosteg-demo", true);

  // Samtyckesarket visas i riktigt läge; öppna det med demobilderna i "Gradera kort"-läge.
  await page.getByTestId("file-front").setInputFiles(join(root, "tests/fixtures/glare-front.jpg"));
  await page.getByTestId("issue-front-glare").waitFor();
  await page.getByTestId("slot-front").scrollIntoViewIfNeeded();
  await shot("04-kvalitet-blank");

  await page.getByTestId("file-front").setInputFiles(join(root, "public/demo/front.jpg"));
  await page.getByTestId("slot-front").locator("img").first().waitFor();
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await page.getByText("Analyserar…").waitFor();
  await shot("05-analyserar");

  await page.getByTestId("grade").waitFor();
  await shot("06-resultat");
  await page.getByTestId("finding-f1").click();
  await page.waitForTimeout(700);
  await shot("07-resultat-zoom");
  await shot("08-resultat-hela", true);

  await page.getByRole("button", { name: "‹ Start" }).click();
  await page.getByRole("button", { name: /Gradera kort/ }).click();
  await page.getByTestId("file-front").setInputFiles(join(root, "public/demo/front.jpg"));
  await page.getByTestId("file-back").setInputFiles(join(root, "public/demo/back.jpg"));
  await page.getByTestId("slot-back").locator("img").first().waitFor();
  await page.getByRole("button", { name: /^Analysera/ }).click();
  await page.getByRole("dialog").waitFor();
  await shot("09-samtycke");
  await page.getByRole("dialog").getByRole("button", { name: "Avbryt" }).click();

  await page.getByRole("button", { name: "‹ Start" }).click();
  await page.getByRole("button", { name: /Historik/ }).click();
  await shot("10-historik");
} finally {
  await browser.close();
  await server.close();
}
