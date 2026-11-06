import type { ImageSlot } from "../grading/types";
import { measureCentering, type Centering } from "./centering";
import { CARD_ASPECT, detectCard, toGray, type CardQuad, type Gray } from "./geometry";

export type IssueLevel = "warn" | "info";

export interface QualityIssue {
  code: "missing_card" | "corner_cut" | "aspect" | "glare" | "blur" | "dark" | "bright" | "low_res" | "tilt";
  level: IssueLevel;
  message: string;
  advice: string;
}

export interface QualityReport {
  issues: QualityIssue[];
  card: CardQuad | null;
  centering: Centering;
  /** Analysbildens storlek (koordinater i `card` gäller den). */
  width: number;
  height: number;
}

export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

const REGION = [
  ["övre vänstra", "övre", "övre högra"],
  ["vänstra", "mitten", "högra"],
  ["nedre vänstra", "nedre", "nedre högra"],
] as const;

function regionName(fx: number, fy: number): string {
  const c = Math.min(2, Math.max(0, Math.floor(fx * 3)));
  const r = Math.min(2, Math.max(0, Math.floor(fy * 3)));
  const name = REGION[r]![c]!;
  return name === "mitten" ? "mitten" : `${name} delen`;
}

/** Axeljusterad omskrivande rektangel för kortet (eller hela bilden). */
function bounds(q: CardQuad | null, w: number, h: number) {
  if (!q) return { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
  const xs = [q.corners.tl.x, q.corners.tr.x, q.corners.br.x, q.corners.bl.x];
  const ys = [q.corners.tl.y, q.corners.tr.y, q.corners.br.y, q.corners.bl.y];
  return {
    x0: Math.max(0, Math.floor(Math.min(...xs))),
    y0: Math.max(0, Math.floor(Math.min(...ys))),
    x1: Math.min(w - 1, Math.ceil(Math.max(...xs))),
    y1: Math.min(h - 1, Math.ceil(Math.max(...ys))),
  };
}

/** Största sammanhängande utbrända ytan (blänk). Körs på ett grovt rutnät. */
export function findGlare(img: RGBAImage, area: ReturnType<typeof bounds>) {
  const cell = 4;
  const gw = Math.floor((area.x1 - area.x0) / cell);
  const gh = Math.floor((area.y1 - area.y0) / cell);
  if (gw < 4 || gh < 4) return null;
  const mask = new Uint8Array(gw * gh);
  let total = 0;
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let bright = 0;
      for (let dy = 0; dy < cell; dy++) {
        for (let dx = 0; dx < cell; dx++) {
          const x = area.x0 + gx * cell + dx;
          const y = area.y0 + gy * cell + dy;
          const p = (y * img.width + x) * 4;
          const lo = Math.min(img.data[p]!, img.data[p + 1]!, img.data[p + 2]!);
          if (lo >= 248) bright++;
        }
      }
      if (bright >= (cell * cell) / 2) {
        mask[gy * gw + gx] = 1;
        total++;
      }
    }
  }
  // Sammanhängande komponenter (4-grannar), iterativ flood fill.
  const seen = new Uint8Array(gw * gh);
  let best = { size: 0, cx: 0, cy: 0 };
  const stack: number[] = [];
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || seen[i]) continue;
    let size = 0, sx = 0, sy = 0;
    stack.push(i);
    seen[i] = 1;
    while (stack.length) {
      const k = stack.pop()!;
      const x = k % gw;
      const y = (k - x) / gw;
      size++; sx += x; sy += y;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
        const nk = ny * gw + nx;
        if (mask[nk] && !seen[nk]) {
          seen[nk] = 1;
          stack.push(nk);
        }
      }
    }
    if (size > best.size) best = { size, cx: sx / size, cy: sy / size };
  }
  const cells = gw * gh;
  return {
    largestFraction: best.size / cells,
    totalFraction: total / cells,
    center: { fx: best.cx / gw, fy: best.cy / gh },
  };
}

/** Varians av Laplace-filtret, ett vanligt skärpemått. */
export function sharpness(g: Gray, area: ReturnType<typeof bounds>): number {
  const pad = 0.1;
  const x0 = Math.floor(area.x0 + (area.x1 - area.x0) * pad);
  const x1 = Math.floor(area.x1 - (area.x1 - area.x0) * pad);
  const y0 = Math.floor(area.y0 + (area.y1 - area.y0) * pad);
  const y1 = Math.floor(area.y1 - (area.y1 - area.y0) * pad);
  let n = 0, s = 0, s2 = 0;
  for (let y = Math.max(1, y0); y < Math.min(g.height - 1, y1); y += 1) {
    for (let x = Math.max(1, x0); x < Math.min(g.width - 1, x1); x += 1) {
      const i = y * g.width + x;
      const l = 4 * g.data[i]! - g.data[i - 1]! - g.data[i + 1]! - g.data[i - g.width]! - g.data[i + g.width]!;
      s += l; s2 += l * l; n++;
    }
  }
  if (!n) return 0;
  const m = s / n;
  return s2 / n - m * m;
}

function meanLum(g: Gray, area: ReturnType<typeof bounds>): number {
  let s = 0, n = 0;
  for (let y = area.y0; y <= area.y1; y += 2)
    for (let x = area.x0; x <= area.x1; x += 2) {
      s += g.data[y * g.width + x]!;
      n++;
    }
  return n ? s / n : 0;
}

export const BLUR_THRESHOLD = 25;

export function analyzeQuality(
  img: RGBAImage,
  slot: ImageSlot,
  original: { width: number; height: number },
): QualityReport {
  const g = toGray(img.width, img.height, img.data);
  const card = detectCard(g);
  const issues: QualityIssue[] = [];
  const wholeCard = slot === "front" || slot === "back";

  if (Math.min(original.width, original.height) < 900) {
    issues.push({
      code: "low_res",
      level: "warn",
      message: `Låg upplösning (${original.width}×${original.height} px).`,
      advice: "Ta bilden med kameran i stället för en skärmdump, och gå närmare kortet.",
    });
  }

  if (wholeCard) {
    if (!card) {
      issues.push({
        code: "missing_card",
        level: "warn",
        message: "Kortets fyra kanter gick inte att hitta i bilden.",
        advice:
          "Lägg kortet på en jämn, mörk och matt yta, se till att alla fyra hörn syns med lite marginal och att kortet inte täcks av fingrar.",
      });
    } else {
      const m = 0.01;
      const c = card.corners;
      const out = Object.entries(c).filter(
        ([, p]) => p.x < img.width * m || p.y < img.height * m || p.x > img.width * (1 - m) || p.y > img.height * (1 - m),
      );
      if (out.length) {
        const names: Record<string, string> = { tl: "övre vänstra", tr: "övre högra", br: "nedre högra", bl: "nedre vänstra" };
        issues.push({
          code: "corner_cut",
          level: "warn",
          message: `${out.length === 1 ? "Ett hörn" : "Hörn"} verkar ligga utanför eller precis vid bildkanten (${out
            .map(([k]) => names[k])
            .join(", ")}).`,
          advice: "Backa telefonen lite så att hela kortet syns med en marginal runt om.",
        });
      }
      const aspect = card.width / card.height;
      if (!out.length && Math.abs(aspect - CARD_ASPECT) / CARD_ASPECT > 0.1) {
        issues.push({
          code: "aspect",
          level: "warn",
          message: "Kortets form i bilden stämmer inte med ett vanligt kort. Kanske är en del avskuren eller bilden tagen snett.",
          advice: "Håll telefonen parallellt med kortet, rakt ovanifrån, och se till att hela kortet syns.",
        });
      }
      if (Math.abs(card.angle) > 8) {
        issues.push({
          code: "tilt",
          level: "info",
          message: "Kortet ligger snett i bilden.",
          advice: "Det går att analysera, men centreringen mäts bara när kortet ligger nästan rakt.",
        });
      }
    }
  }

  const area = bounds(card, img.width, img.height);
  const glare = findGlare(img, area);
  if (glare && (glare.largestFraction > 0.004 || glare.totalFraction > 0.02)) {
    const pct = Math.max(1, Math.round(glare.largestFraction * 100));
    issues.push({
      code: "glare",
      level: "warn",
      message: `Blänk döljer ytan i ${regionName(glare.center.fx, glare.center.fy)} (ca ${pct} % av kortet).`,
      advice:
        "Ta om bilden utan blixt och vinkla bort ljuskällan. Lägg gärna till en extra bild i snett ljus för att kontrollera ytan.",
    });
  }

  const sharp = sharpness(g, area);
  if (sharp < BLUR_THRESHOLD) {
    issues.push({
      code: "blur",
      level: "warn",
      message: "Bilden verkar suddig.",
      advice: "Håll telefonen stilla, tryck på kortet i kameran för att fokusera och ta om bilden i bättre ljus.",
    });
  }

  const lum = meanLum(g, area);
  if (lum < 45) {
    issues.push({
      code: "dark",
      level: "warn",
      message: "Bilden är mörk.",
      advice: "Ta om bilden i jämnt dagsljus eller med en lampa från sidan, utan blixt.",
    });
  } else if (lum > 225) {
    issues.push({
      code: "bright",
      level: "warn",
      message: "Bilden är överexponerad.",
      advice: "Minska ljuset eller tryck på kortet i kameran och dra ner exponeringen.",
    });
  }

  const centering = wholeCard
    ? measureCentering(g, card)
    : { leftRight: null, topBottom: null, note: null };

  return { issues, card, centering, width: img.width, height: img.height };
}
