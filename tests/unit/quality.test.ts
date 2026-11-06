import { describe, expect, it } from "vitest";
import { analyzeQuality } from "../../src/quality/checks";
import { detectCard, toGray } from "../../src/quality/geometry";
import { syntheticCard } from "./synthetic";

const ORIG = { width: 3024, height: 4032 };

describe("card detection", () => {
  it("finds a straight card with the right size", () => {
    const img = syntheticCard();
    const q = detectCard(toGray(img.width, img.height, img.data))!;
    expect(q).not.toBeNull();
    expect(q.corners.tl.x).toBeCloseTo(110, -0.5);
    expect(q.corners.tl.y).toBeCloseTo(120, -0.5);
    expect(q.width).toBeGreaterThan(520);
    expect(q.width).toBeLessThan(540);
    expect(q.height).toBeGreaterThan(730);
    expect(q.height).toBeLessThan(750);
  });

  it("handles a slightly rotated card", () => {
    const img = syntheticCard({ angleDeg: 3 });
    const q = detectCard(toGray(img.width, img.height, img.data))!;
    expect(q).not.toBeNull();
    expect(Math.abs(q.angle - 3)).toBeLessThan(0.7);
  });
});

describe("centering", () => {
  it("measures 60/40 left/right and 50/50 top/bottom", () => {
    const img = syntheticCard({ borders: { l: 36, r: 24, t: 30, b: 30 } });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight?.ratio[0]).toBeGreaterThanOrEqual(59);
    expect(r.centering.leftRight?.ratio[0]).toBeLessThanOrEqual(61);
    expect(r.centering.topBottom?.ratio[0]).toBeGreaterThanOrEqual(49);
    expect(r.centering.topBottom?.ratio[0]).toBeLessThanOrEqual(51);
  });

  it("measures 55/45 with noise", () => {
    const img = syntheticCard({ borders: { l: 33, r: 27, t: 33, b: 27 }, noise: 10 });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight?.ratio[0]).toBeGreaterThanOrEqual(54);
    expect(r.centering.leftRight?.ratio[0]).toBeLessThanOrEqual(56);
    expect(r.centering.topBottom?.ratio[0]).toBeGreaterThanOrEqual(54);
    expect(r.centering.topBottom?.ratio[0]).toBeLessThanOrEqual(56);
  });

  it("uses the inner edge of the border even when a stronger edge (artwork frame) is further in", () => {
    const img = syntheticCard({ borders: { l: 36, r: 24, t: 30, b: 30 }, inner: [40, 50, 70] });
    // Draw a bright artwork frame further in, with stronger contrast than the border's inner edge.
    for (let y = 200; y < 600; y++) {
      for (const x of [190, 191, 192, 193, 560, 561, 562, 563]) {
        const p = (y * img.width + x) * 4;
        img.data[p] = img.data[p + 1] = img.data[p + 2] = 250;
      }
    }
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight?.ratio[0]).toBeGreaterThanOrEqual(59);
    expect(r.centering.leftRight?.ratio[0]).toBeLessThanOrEqual(61);
  });

  it("returns no value when border and inside have too little contrast", () => {
    const img = syntheticCard({ border: [150, 150, 150], inner: [158, 158, 158] });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight).toBeNull();
    expect(r.centering.note).toBeTruthy();
  });

  it("returns no value when the card is too tilted", () => {
    const img = syntheticCard({ angleDeg: 7 });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight).toBeNull();
    expect(r.centering.topBottom).toBeNull();
  });
});

describe("photo quality check", () => {
  it("a good photo gives no warnings", () => {
    const r = analyzeQuality(syntheticCard(), "front", ORIG);
    expect(r.issues.filter((i) => i.level === "warn")).toEqual([]);
  });

  it("warns about glare and says where", () => {
    const r = analyzeQuality(syntheticCard({ glare: { cx: 520, cy: 260, r: 60 } }), "front", ORIG);
    const g = r.issues.find((i) => i.code === "glare");
    expect(g).toBeDefined();
    expect(g!.message).toContain("upper right");
  });

  it("warns when a corner is outside the photo", () => {
    const img = syntheticCard({ card: { x: -40, y: 120, w: 530, h: 740 } });
    const r = analyzeQuality(img, "back", ORIG);
    expect(r.issues.some((i) => i.code === "corner_cut" || i.code === "missing_card" || i.code === "aspect")).toBe(true);
  });

  it("warns about blur", () => {
    const r = analyzeQuality(syntheticCard({ blur: true, noise: 0 }), "front", ORIG);
    expect(r.issues.some((i) => i.code === "blur")).toBe(true);
  });

  it("warns about low resolution", () => {
    const r = analyzeQuality(syntheticCard(), "front", { width: 600, height: 800 });
    expect(r.issues.some((i) => i.code === "low_res")).toBe(true);
  });

  it("warns when no card is visible", () => {
    const img = syntheticCard({ card: { x: 0, y: 0, w: 0, h: 0 } });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.issues.some((i) => i.code === "missing_card")).toBe(true);
  });
});
