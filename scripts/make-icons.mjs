// Draws the app icons (home screen and manifest) from an SVG with Playwright.
// Run: npm run icons
import { chromium } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Same motif as src/ui/Logo.tsx: a card with red scan corners and a sparkle, on red.
const svg = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f0352c"/><stop offset="1" stop-color="#b3160f"/>
    </linearGradient>
  </defs>
  <rect width="100" height="100" fill="url(#bg)"/>
  <circle cx="84" cy="14" r="14" fill="#fff" fill-opacity=".15"/>
  <rect x="34" y="22" width="32" height="46" rx="5" fill="#fff" stroke="#1d2340" stroke-width="3.5" transform="rotate(-8 50 45)"/>
  <rect x="38.5" y="27.5" width="23" height="16" rx="2" fill="#ffe1dc" transform="rotate(-8 50 45)"/>
  <g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 32V20h12"/><path d="M80 32V20H68"/><path d="M20 68v12h12"/><path d="M80 68v12H68"/>
  </g>
  <path d="M66 52l2.6 6.2 6.4 2-6.4 2.6L66 69l-2.6-6.2-6.4-2.6 6.4-2Z" fill="#ffcb05" stroke="#1d2340" stroke-width="2" stroke-linejoin="round"/>
</svg>`;

await writeFile(join(root, "public/icon.svg"), svg(512).trim());
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [180, 192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(size)}</body></html>`);
  const name = size === 180 ? "apple-touch-icon.png" : `icon-${size}.png`;
  await page.screenshot({ path: join(root, "public", name), clip: { x: 0, y: 0, width: size, height: size } });
  console.log("wrote", name);
}
await browser.close();
