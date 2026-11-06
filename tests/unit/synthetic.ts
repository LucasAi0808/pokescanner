import type { RGBAImage } from "../../src/quality/checks";

/** Deterministisk pseudoslump så testerna blir stabila. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

export interface CardSpec {
  width?: number;
  height?: number;
  card?: { x: number; y: number; w: number; h: number };
  /** Ramens bredd i px: vänster, höger, topp, botten */
  borders?: { l: number; r: number; t: number; b: number };
  angleDeg?: number;
  noise?: number;
  background?: number;
  border?: [number, number, number];
  inner?: [number, number, number];
  glare?: { cx: number; cy: number; r: number };
  blur?: boolean;
}

/**
 * Ritar ett "foto" av ett kort: mörk bakgrund, ljus ram, mörkare inre del,
 * plus valfri rotation, brus, blänkfläck och oskärpa.
 */
export function syntheticCard(spec: CardSpec = {}): RGBAImage {
  const W = spec.width ?? 750;
  const H = spec.height ?? 1000;
  const card = spec.card ?? { x: 110, y: 120, w: 530, h: 740 };
  const bd = spec.borders ?? { l: 30, r: 30, t: 30, b: 30 };
  const angle = ((spec.angleDeg ?? 0) * Math.PI) / 180;
  const bg = spec.background ?? 35;
  const border = spec.border ?? [222, 196, 70];
  const inner = spec.inner ?? [70, 110, 160];
  const rand = rng(7);
  const noise = spec.noise ?? 4;
  const data = new Uint8ClampedArray(W * H * 4);
  const cx = card.x + card.w / 2;
  const cy = card.y + card.h / 2;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Rotera tillbaka till kortets koordinater.
      const dx = x - cx;
      const dy = y - cy;
      const u = dx * cos - dy * sin + card.w / 2;
      const v = dx * sin + dy * cos + card.h / 2;
      let c: [number, number, number] = [bg, bg, bg + 5];
      if (u >= 0 && v >= 0 && u < card.w && v < card.h) {
        const inside = u >= bd.l && u < card.w - bd.r && v >= bd.t && v < card.h - bd.b;
        c = inside ? inner : border;
      }
      if (spec.glare) {
        const d = Math.hypot(x - spec.glare.cx, y - spec.glare.cy);
        if (d < spec.glare.r) c = [255, 255, 255];
      }
      const n = (rand() - 0.5) * 2 * noise;
      const p = (y * W + x) * 4;
      data[p] = c[0] + n;
      data[p + 1] = c[1] + n;
      data[p + 2] = c[2] + n;
      data[p + 3] = 255;
    }
  }
  if (spec.blur) boxBlur(data, W, H, 6);
  return { width: W, height: H, data };
}

function boxBlur(data: Uint8ClampedArray, W: number, H: number, r: number) {
  const tmp = new Float32Array(W * H * 4);
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        for (let ch = 0; ch < 3; ch++) {
          let s = 0, n = 0;
          for (let k = -r; k <= r; k++) {
            const xx = pass === 0 ? Math.min(W - 1, Math.max(0, x + k)) : x;
            const yy = pass === 1 ? Math.min(H - 1, Math.max(0, y + k)) : y;
            s += data[(yy * W + xx) * 4 + ch]!;
            n++;
          }
          tmp[(y * W + x) * 4 + ch] = s / n;
        }
    for (let i = 0; i < data.length; i++) if (i % 4 !== 3) data[i] = tmp[i]!;
  }
}
