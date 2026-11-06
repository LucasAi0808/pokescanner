/**
 * Card detection without external libraries. Works on a grayscale field
 * (0–255) at analysis resolution (~1000 px long edge).
 *
 * Idea: for every row we find the first strong edge from the left and from the
 * right, and for every column from the top and from the bottom. The points are
 * fitted to four lines (RANSAC + least squares). The intersections give the
 * four corners of the card. Handles slight rotation and a little perspective.
 */

export interface Gray {
  width: number;
  height: number;
  data: Float32Array;
}

export interface Line {
  /** For vertical lines: x = a*y + b. For horizontal lines: y = a*x + b. */
  a: number;
  b: number;
  inliers: number;
  samples: number;
  residual: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface CardQuad {
  left: Line;
  right: Line;
  top: Line;
  bottom: Line;
  corners: { tl: Point; tr: Point; br: Point; bl: Point };
  /** Card width/height in pixels (average of opposite sides). */
  width: number;
  height: number;
  /** Rotation in degrees (positive = clockwise). */
  angle: number;
}

export function toGray(width: number, height: number, rgba: Uint8ClampedArray): Gray {
  const data = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = 0.299 * rgba[p]! + 0.587 * rgba[p + 1]! + 0.114 * rgba[p + 2]!;
  }
  return { width, height, data };
}

const EDGE_T = 28; // minimum brightness difference over 4 px to count as an edge
const at = (g: Gray, x: number, y: number) => g.data[y * g.width + x]!;

/** First strong edge along a row/column, from one direction. */
function firstEdge(
  g: Gray,
  fixed: number,
  horizontal: boolean,
  fromStart: boolean,
  limit: number,
): number | null {
  const len = horizontal ? g.width : g.height;
  const sample = (i: number) => (horizontal ? at(g, i, fixed) : at(g, fixed, i));
  const span = Math.floor(len * limit);
  for (let k = 3; k < span; k++) {
    const i = fromStart ? k : len - 1 - k;
    const d = Math.abs(sample(i + 2 * (fromStart ? 1 : -1)) - sample(i - 2 * (fromStart ? 1 : -1)));
    if (d > EDGE_T) {
      // Require the contrast to persist a little (filters out single noise dots).
      const d2 = Math.abs(sample(i + 4 * (fromStart ? 1 : -1)) - sample(i - 2 * (fromStart ? 1 : -1)));
      if (d2 > EDGE_T * 0.8) {
        // Refine to the gradient centroid in a small window (subpixel).
        const sgn = fromStart ? 1 : -1;
        let w = 0, s = 0;
        for (let j = 0; j <= 6; j++) {
          const p = i + sgn * j;
          if (p < 1 || p > len - 2) continue;
          const gr = Math.abs(sample(p + 1) - sample(p - 1));
          w += gr;
          s += gr * p;
        }
        return w > 0 ? s / w : i;
      }
    }
  }
  return null;
}

/** Robust line fit v = a*u + b. */
export function fitLine(points: { u: number; v: number }[], tol = 2.5): Line | null {
  if (points.length < 8) return null;
  let best: { a: number; b: number; n: number } | null = null;
  // Deterministic "RANSAC": try pairs over spread-out indices instead of random ones.
  const n = points.length;
  const step = Math.max(1, Math.floor(n / 25));
  for (let i = 0; i < n; i += step) {
    for (let j = i + Math.floor(n / 3); j < n; j += step) {
      const p = points[i]!;
      const q = points[j]!;
      if (q.u === p.u) continue;
      const a = (q.v - p.v) / (q.u - p.u);
      const b = p.v - a * p.u;
      let cnt = 0;
      for (const r of points) if (Math.abs(a * r.u + b - r.v) <= tol) cnt++;
      if (!best || cnt > best.n) best = { a, b, n: cnt };
    }
  }
  if (!best) return null;
  const inl = points.filter((r) => Math.abs(best!.a * r.u + best!.b - r.v) <= tol);
  // Least squares on the inliers.
  const m = inl.length;
  let su = 0, sv = 0, suu = 0, suv = 0;
  for (const r of inl) {
    su += r.u; sv += r.v; suu += r.u * r.u; suv += r.u * r.v;
  }
  const den = m * suu - su * su;
  const a = den === 0 ? 0 : (m * suv - su * sv) / den;
  const b = (sv - a * su) / m;
  let res = 0;
  for (const r of inl) res += (a * r.u + b - r.v) ** 2;
  return { a, b, inliers: m, samples: n, residual: Math.sqrt(res / m) };
}

function edgeLine(g: Gray, side: "left" | "right" | "top" | "bottom"): Line | null {
  const horizontal = side === "left" || side === "right"; // we scan along rows
  const fromStart = side === "left" || side === "top";
  const across = horizontal ? g.height : g.width;
  const pts: { u: number; v: number }[] = [];
  const step = Math.max(1, Math.floor(across / 200));
  for (let k = Math.floor(across * 0.05); k < across * 0.95; k += step) {
    const e = firstEdge(g, k, horizontal, fromStart, 0.45);
    if (e != null) pts.push({ u: k, v: e });
  }
  const line = fitLine(pts);
  if (!line) return null;
  // The line must be supported by a significant share of the rows.
  if (line.inliers < Math.max(12, pts.length * 0.3)) return null;
  return line;
}

function intersect(vert: Line, hor: Line): Point {
  // x = a1*y + b1, y = a2*x + b2
  const y = (hor.a * vert.b + hor.b) / (1 - hor.a * vert.a);
  return { x: vert.a * y + vert.b, y };
}

const dist = (p: Point, q: Point) => Math.hypot(p.x - q.x, p.y - q.y);

export function detectCard(g: Gray): CardQuad | null {
  const left = edgeLine(g, "left");
  const right = edgeLine(g, "right");
  const top = edgeLine(g, "top");
  const bottom = edgeLine(g, "bottom");
  if (!left || !right || !top || !bottom) return null;
  const tl = intersect(left, top);
  const tr = intersect(right, top);
  const br = intersect(right, bottom);
  const bl = intersect(left, bottom);
  const width = (dist(tl, tr) + dist(bl, br)) / 2;
  const height = (dist(tl, bl) + dist(tr, br)) / 2;
  if (width < g.width * 0.15 || height < g.height * 0.15) return null;
  const angle = (Math.atan(top.a) * 180) / Math.PI;
  return { left, right, top, bottom, corners: { tl, tr, br, bl }, width, height, angle };
}

/** Standard cards are 63 × 88 mm. */
export const CARD_ASPECT = 63 / 88;
