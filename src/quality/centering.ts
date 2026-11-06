import { fitLine, type CardQuad, type Gray } from "./geometry";

/**
 * Local centering measurement. From the outer edge of the card we search
 * inwards for the transition between the border and the inner part of the card
 * (artwork frame, or the frame on the back) and fit a line per side. A value is
 * only returned when the measurement is reliable, otherwise null. Better no
 * number than a made-up one.
 */

export interface AxisCentering {
  /** e.g. [55, 45] = 55% of the combined border is on the left/top side */
  ratio: [number, number];
  /** border widths in analysis pixels */
  borders: [number, number];
}

export interface Centering {
  leftRight: AxisCentering | null;
  topBottom: AxisCentering | null;
  /** Why a value is missing, if it is. */
  note: string | null;
}

const at = (g: Gray, x: number, y: number) =>
  g.data[Math.round(y) * g.width + Math.round(x)] ?? 0;

const MAX_ANGLE = 4; // degrees
const MAX_SKEW = 0.02; // difference in slope between opposite sides

type Side = "left" | "right" | "top" | "bottom";

const INNER_T = 22;

/**
 * Find the distance from the outer edge to the inner edge along a scan line.
 * We take the FIRST clear edge inside the border, not the strongest one:
 * further in there are often stronger edges (artwork frame, text) that are not
 * the inner edge of the border.
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
  // Skip the first pixels where the outer edge has its own gradient.
  for (let d = 5; d < maxDepth; d++) {
    if (strength(d) <= INNER_T) continue;
    // Climb to the peak of the edge (subpixel via centroid around the peak).
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
  // Normal pointing inwards.
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
  // Middle 60% of the side, away from the rounded corners.
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
  if (Math.abs(line.a) > 0.03 || line.residual > 1.2) return null; // the inner edge must be parallel
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
  if (!q) return { leftRight: null, topBottom: null, note: "The card edges were not found." };
  if (Math.abs(q.angle) > MAX_ANGLE)
    return { leftRight: null, topBottom: null, note: "The card is too tilted to measure." };
  if (Math.abs(q.left.a - q.right.a) > MAX_SKEW || Math.abs(q.top.a - q.bottom.a) > MAX_SKEW)
    return {
      leftRight: null,
      topBottom: null,
      note: "The photo was taken at an angle (perspective), so the borders cannot be compared.",
    };
  const lr = axis(measureSide(g, q, "left"), measureSide(g, q, "right"));
  const tb = axis(measureSide(g, q, "top"), measureSide(g, q, "bottom"));
  return {
    leftRight: lr,
    topBottom: tb,
    note: lr && tb ? null : "The inner edge of the border was not clear enough everywhere.",
  };
}

export function formatAxis(a: AxisCentering | null): string | null {
  return a ? `${a.ratio[0]}/${a.ratio[1]}` : null;
}
