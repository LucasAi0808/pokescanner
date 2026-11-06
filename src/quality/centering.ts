import { fitLine, type CardQuad, type Gray } from "./geometry";

/**
 * Lokal centreringsmätning. Från kortets yttre kant letar vi inåt efter
 * övergången mellan ram och kortets inre del (bildruta eller ram på baksidan)
 * och anpassar en linje per sida. Ett mått returneras bara när mätningen är
 * tillförlitlig, annars null. Hellre inget tal än ett påhittat.
 */

export interface AxisCentering {
  /** t.ex. [55, 45] = 55 % av den sammanlagda ramen på vänster/övre sidan */
  ratio: [number, number];
  /** ramarnas bredd i analyspixlar */
  borders: [number, number];
}

export interface Centering {
  leftRight: AxisCentering | null;
  topBottom: AxisCentering | null;
  /** Varför ett mått saknas, om det saknas. */
  note: string | null;
}

const at = (g: Gray, x: number, y: number) =>
  g.data[Math.round(y) * g.width + Math.round(x)] ?? 0;

const MAX_ANGLE = 4; // grader
const MAX_SKEW = 0.02; // skillnad i lutning mellan motstående sidor

type Side = "left" | "right" | "top" | "bottom";

const INNER_T = 22;

/**
 * Hitta inre kantens avstånd från yttre kanten längs en skanningslinje.
 * Vi tar den FÖRSTA tydliga kanten innanför ramen, inte den starkaste:
 * längre in finns ofta starkare kanter (bildrutans ram, text) som inte är
 * ramens innerkant.
 */
function innerOffset(
  g: Gray,
  outer: { x: number; y: number },
  dir: { x: number; y: number },
  maxDepth: number,
): { depth: number; strength: number } | null {
  const strength = (d: number) =>
    Math.abs(
      at(g, outer.x + dir.x * (d + 2), outer.y + dir.y * (d + 2)) -
        at(g, outer.x + dir.x * (d - 2), outer.y + dir.y * (d - 2)),
    );
  // Hoppa över de första pixlarna där yttre kantens egen gradient finns.
  for (let d = 5; d < maxDepth; d++) {
    if (strength(d) <= INNER_T) continue;
    // Klättra till kantens topp (subpixel via tyngdpunkt runt toppen).
    let peak = d;
    while (peak + 1 < maxDepth && strength(peak + 1) >= strength(peak)) peak++;
    let w = 0, s = 0;
    for (let k = peak - 2; k <= peak + 2; k++) {
      const v = strength(k);
      w += v;
      s += v * k;
    }
    return { depth: w ? s / w : peak, strength: strength(peak) };
  }
  return null;
}

function measureSide(g: Gray, q: CardQuad, side: Side): number | null {
  const { tl, tr, br, bl } = q.corners;
  const [p0, p1] =
    side === "left" ? [tl, bl] : side === "right" ? [tr, br] : side === "top" ? [tl, tr] : [bl, br];
  const len = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  // Normal som pekar inåt.
  const tx = (p1.x - p0.x) / len;
  const ty = (p1.y - p0.y) / len;
  let nx = -ty;
  let ny = tx;
  const cx = (tl.x + br.x) / 2;
  const cy = (tl.y + br.y) / 2;
  const mx = (p0.x + p1.x) / 2;
  const my = (p0.y + p1.y) / 2;
  if (nx * (cx - mx) + ny * (cy - my) < 0) {
    nx = -nx;
    ny = -ny;
  }
  const across = side === "left" || side === "right" ? q.width : q.height;
  const maxDepth = Math.floor(across * 0.2);
  const samples: { u: number; v: number }[] = [];
  let strengthSum = 0;
  // Mittersta 60 % av sidan, bort från rundade hörn.
  for (let t = 0.2; t <= 0.8; t += 0.6 / 60) {
    const outer = { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
    const r = innerOffset(g, outer, { x: nx, y: ny }, maxDepth);
    if (r) {
      samples.push({ u: t * len, v: r.depth });
      strengthSum += r.strength;
    }
  }
  if (samples.length < 30) return null;
  const line = fitLine(samples, 1.5);
  if (!line || line.inliers < samples.length * 0.6) return null;
  if (Math.abs(line.a) > 0.03 || line.residual > 1.2) return null; // inre kanten ska vara parallell
  if (strengthSum / samples.length < 22) return null;
  const width = line.a * (len / 2) + line.b;
  if (width < 2 || width > maxDepth - 2) return null;
  return width;
}

function axis(a: number | null, b: number | null): AxisCentering | null {
  if (a == null || b == null) return null;
  const first = Math.round((a / (a + b)) * 100);
  return { ratio: [first, 100 - first], borders: [a, b] };
}

export function measureCentering(g: Gray, q: CardQuad | null): Centering {
  if (!q) return { leftRight: null, topBottom: null, note: "Kortets kanter hittades inte." };
  if (Math.abs(q.angle) > MAX_ANGLE)
    return { leftRight: null, topBottom: null, note: "Kortet ligger för snett för att mäta." };
  if (Math.abs(q.left.a - q.right.a) > MAX_SKEW || Math.abs(q.top.a - q.bottom.a) > MAX_SKEW)
    return {
      leftRight: null,
      topBottom: null,
      note: "Bilden är tagen snett (perspektiv), så ramarna går inte att jämföra.",
    };
  const lr = axis(measureSide(g, q, "left"), measureSide(g, q, "right"));
  const tb = axis(measureSide(g, q, "top"), measureSide(g, q, "bottom"));
  return {
    leftRight: lr,
    topBottom: tb,
    note: lr && tb ? null : "Ramens innerkant syntes inte tydligt nog överallt.",
  };
}

export function formatAxis(a: AxisCentering | null): string | null {
  return a ? `${a.ratio[0]}/${a.ratio[1]}` : null;
}
