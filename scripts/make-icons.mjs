// Ritar appikonerna (hemskärm och manifest) från en SVG med Playwright.
// Kör: node scripts/make-icons.mjs
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#101214"/>
  <g stroke="#ffffff" stroke-opacity=".05" stroke-width=".5">
    ${Array.from({ length: 9 }, (_, i) => `<line x1="${(i + 1) * 10}" y1="0" x2="${(i + 1) * 10}" y2="100"/><line x1="0" y1="${(i + 1) * 10}" x2="100" y2="${(i + 1) * 10}"/>`).join("")}
  </g>
  <rect x="31" y="22" width="38" height="56" rx="4" fill="#20252a" stroke="#ece8df" stroke-width="2"/>
  <g fill="none" stroke="#d4ff3f" stroke-width="4" stroke-linecap="round">
    <path d="M24 26V17H33"/><path d="M76 26V17H67"/><path d="M24 74V83H33"/><path d="M76 74V83H67"/>
  </g>
  <line x1="28" y1="50" x2="72" y2="50" stroke="#d4ff3f" stroke-width="2"/>
</svg>`;

await writeFile(join(root, "public/icon.svg"), svg(512).trim());
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(size)}</body></html>`);
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  await page.screenshot({ path: join(root, "public", name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log("skrev", name);
}
await browser.close();
