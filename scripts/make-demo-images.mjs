// Renders the demo photos (an original, fictional card) and test fixtures with Playwright.
// Run: npm run demo-images
//
// The geometry must match src/grading/demo.ts:
//   image 1500×2000 px, card at x 163, y 180, 1174×1640 px
//   front borders L 70 / R 47 / T 60 / B 55  -> centering ~60/40, ~52/48
//   back  borders L 60 / R 57 / T 62 / B 58  -> ~51/49, ~52/48
import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const W = 1500;
const H = 2000;
const CARD = { x: 163, y: 180, w: 1174, h: 1640 };

const font = async (f) => (await readFile(join(root, "public/fonts", f))).toString("base64");
const fonts = `
@font-face{font-family:Serif;src:url(data:font/woff2;base64,${await font("fredoka-600.woff2")})}
@font-face{font-family:Sans;src:url(data:font/woff2;base64,${await font("nunito-400.woff2")});font-weight:400}
@font-face{font-family:Sans;src:url(data:font/woff2;base64,${await font("nunito-700.woff2")});font-weight:700}
@font-face{font-family:Mono;src:url(data:font/woff2;base64,${await font("jetbrains-mono.woff2")})}`;

function page(inner, { borders, extra = "", background = "" }) {
  const { l, r, t, b } = borders;
  return `<!doctype html><html><head><style>${fonts}
  html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
  body{background:
    radial-gradient(ellipse at 45% 40%, #3a3f44 0%, #24282c 55%, #15181a 100%);
    position:relative}
  .noise{position:absolute;inset:0;opacity:.35;mix-blend-mode:overlay}
  .card{position:absolute;left:${CARD.x}px;top:${CARD.y}px;width:${CARD.w}px;height:${CARD.h}px;
    border-radius:52px;background:#9aa6ad;box-shadow:0 30px 60px rgba(0,0,0,.55),0 4px 10px rgba(0,0,0,.4);overflow:hidden}
  .body{position:absolute;left:${l}px;top:${t}px;right:${r}px;bottom:${b}px;border-radius:14px;overflow:hidden}
  ${background}
  </style></head><body>
  <svg class="noise" width="${W}" height="${H}"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="4"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>
  <div class="card"><div class="body">${inner}</div>${extra}</div>
  </body></html>`;
}

const FRONT_BORDERS = { l: 70, r: 47, t: 60, b: 55 };
const BACK_BORDERS = { l: 60, r: 57, t: 62, b: 58 };

// Positions below are in card coordinates (image coordinate minus CARD.x/y).
const cx = (x) => x - CARD.x;
const cy = (y) => y - CARD.y;

const front = page(
  `
  <div style="position:absolute;inset:0;background:linear-gradient(160deg,#1f3346,#16202c 60%,#101820)"></div>
  <div style="position:absolute;left:${cx(290) - FRONT_BORDERS.l}px;top:4px;width:920px;display:flex;justify-content:space-between;align-items:baseline;color:#e8eef0">
    <span style="font-family:Serif;font-size:60px;line-height:1">Quartzling</span>
    <span style="font-family:Mono;font-size:34px;color:#cfe3ea">HP 60</span>
  </div>
  <!-- artwork: x 290..1210, y 320..960 in image coordinates -->
  <div style="position:absolute;left:${cx(290) - FRONT_BORDERS.l}px;top:${cy(320) - FRONT_BORDERS.t}px;width:920px;height:640px;
      border-radius:10px;overflow:hidden;border:6px solid #c9d6dc;box-sizing:border-box;
      background:radial-gradient(circle at 50% 60%,#4fb5c9 0%,#2a6e8a 35%,#173a52 70%,#0e2232 100%)">
    <svg width="920" height="640" viewBox="0 0 920 640" style="position:absolute;inset:0">
      <g fill="none" stroke="#bff3ff" stroke-width="5" stroke-linejoin="round">
        <polygon points="460,120 560,300 460,520 360,300" fill="rgba(191,243,255,.25)"/>
        <polygon points="330,250 400,360 330,480 270,360" fill="rgba(191,243,255,.18)"/>
        <polygon points="600,240 670,350 600,470 540,350" fill="rgba(191,243,255,.18)"/>
        <line x1="460" y1="120" x2="460" y2="520"/>
      </g>
      <circle cx="430" cy="290" r="10" fill="#0e2232"/><circle cx="490" cy="290" r="10" fill="#0e2232"/>
    </svg>
    <!-- holo pattern: part of the print -->
    <div style="position:absolute;inset:0;background:repeating-linear-gradient(115deg,rgba(255,255,255,.10) 0 3px,transparent 3px 26px)"></div>
  </div>
  <div style="position:absolute;left:40px;right:40px;top:${cy(1010) - FRONT_BORDERS.t}px;color:#e8eef0;font-family:Sans">
    <div style="display:flex;justify-content:space-between;font-size:52px;font-weight:700"><span>Prism Mask</span><span>30</span></div>
    <p style="font-size:34px;color:#b9c7cd;margin:12px 0 40px">Flip a coin. If heads, add a crystal marker.</p>
    <div style="display:flex;justify-content:space-between;font-size:52px;font-weight:700"><span>Facet Beam</span><span>60</span></div>
    <p style="font-size:34px;color:#b9c7cd;margin:12px 0 0">Fictional demo card for PokeScanner. Not a real trading card.</p>
  </div>
  <div style="position:absolute;left:40px;right:40px;bottom:26px;display:flex;justify-content:space-between;font-family:Mono;font-size:30px;color:#9fb2ba">
    <span>DEMO 001/100</span><span>PokeScanner demo</span>
  </div>
  <!-- lamp reflection (photo effect, not damage): about x 420..980, y 330..750 -->
  <div style="position:absolute;left:${cx(420) - FRONT_BORDERS.l}px;top:${cy(330) - FRONT_BORDERS.t}px;width:560px;height:420px;
    background:linear-gradient(125deg,transparent 30%,rgba(255,255,255,.28) 46%,rgba(255,255,255,.34) 50%,rgba(255,255,255,.22) 56%,transparent 72%);
    filter:blur(6px)"></div>
  `,
  {
    borders: FRONT_BORDERS,
    // edge wear on the right edge: x ~1330, y 1100/1170/1240 (image coordinates)
    extra: [1100, 1172, 1238]
      .map(
        (y, i) =>
          `<div style="position:absolute;left:${CARD.w - 7}px;top:${cy(y)}px;width:${[9, 7, 8][i]}px;height:${[34, 22, 28][i]}px;border-radius:3px;background:#f2f5f6;filter:blur(.7px)"></div>`,
      )
      .join(""),
  },
);

const back = page(
  `
  <div style="position:absolute;inset:0;background:radial-gradient(circle at 50% 50%,#3b5a5f 0%,#22383d 45%,#142226 100%)"></div>
  <svg viewBox="0 0 1057 1520" width="100%" height="100%" style="position:absolute;inset:0">
    <g fill="none" stroke="#7fb0b3" stroke-width="4" opacity=".55">
      ${[120, 220, 320, 420, 520, 620].map((r) => `<rect x="${528 - r}" y="${760 - r * 1.35}" width="${r * 2}" height="${r * 2.7}" transform="rotate(45 528 760)"/>`).join("")}
    </g>
    <circle cx="528" cy="760" r="120" fill="#142226" stroke="#c9dfe0" stroke-width="8"/>
    <text x="528" y="742" text-anchor="middle" font-family="Mono" font-size="54" fill="#c9dfe0" letter-spacing="6">PS</text>
    <text x="528" y="800" text-anchor="middle" font-family="Mono" font-size="22" fill="#9fc2c4" letter-spacing="4">DEMO</text>
  </svg>`,
  {
    borders: BACK_BORDERS,
    // white dot in the top left corner: center (200, 218) in image coordinates
    extra: `<div style="position:absolute;left:${cx(200) - 7}px;top:${cy(218) - 7}px;width:14px;height:14px;border-radius:50%;background:#fbfcfc;box-shadow:0 0 3px 1px rgba(255,255,255,.6)"></div>
            <div style="position:absolute;left:0;top:0;width:60px;height:60px;border-top-left-radius:52px;box-shadow:inset 3px 3px 0 rgba(255,255,255,.35)"></div>`,
  },
);

// Fixture: strong glare (blown-out spot) on the front.
const glare = front.replace(
  "</body>",
  `<div style="position:absolute;left:880px;top:420px;width:300px;height:220px;border-radius:50%;background:#fff;box-shadow:0 0 40px 30px #fff"></div></body>`,
);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

async function shot(html, out, clip) {
  await p.setContent(html, { waitUntil: "load" });
  await p.evaluate(() => document.fonts.ready);
  await mkdir(dirname(out), { recursive: true });
  await p.screenshot({ path: out, type: "jpeg", quality: 90, clip: clip ?? { x: 0, y: 0, width: W, height: H } });
  console.log("wrote", out);
}

await shot(front, join(root, "public/demo/front.jpg"));
await shot(back, join(root, "public/demo/back.jpg"));
await shot(glare, join(root, "tests/fixtures/glare-front.jpg"));
// Fixture: top left corner outside the frame (cropped photo).
await shot(back, join(root, "tests/fixtures/cut-corner-back.jpg"), { x: 260, y: 300, width: 1200, height: 1600 });
await browser.close();
