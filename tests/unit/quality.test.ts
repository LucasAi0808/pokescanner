import { describe, expect, it } from "vitest";
import { analyzeQuality } from "../../src/quality/checks";
import { detectCard, toGray } from "../../src/quality/geometry";
import { syntheticCard } from "./synthetic";

const ORIG = { width: 3024, height: 4032 };

describe("kortdetektion", () => {
  it("hittar ett rakt kort med rätt mått", () => {
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

  it("klarar ett lätt roterat kort", () => {
    const img = syntheticCard({ angleDeg: 3 });
    const q = detectCard(toGray(img.width, img.height, img.data))!;
    expect(q).not.toBeNull();
    expect(Math.abs(q.angle - 3)).toBeLessThan(0.7);
  });
});

describe("centrering", () => {
  it("mäter 60/40 vänster/höger och 50/50 topp/botten", () => {
    const img = syntheticCard({ borders: { l: 36, r: 24, t: 30, b: 30 } });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight?.ratio[0]).toBeGreaterThanOrEqual(59);
    expect(r.centering.leftRight?.ratio[0]).toBeLessThanOrEqual(61);
    expect(r.centering.topBottom?.ratio[0]).toBeGreaterThanOrEqual(49);
    expect(r.centering.topBottom?.ratio[0]).toBeLessThanOrEqual(51);
  });

  it("mäter 55/45 med brus", () => {
    const img = syntheticCard({ borders: { l: 33, r: 27, t: 33, b: 27 }, noise: 10 });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight?.ratio[0]).toBeGreaterThanOrEqual(54);
    expect(r.centering.leftRight?.ratio[0]).toBeLessThanOrEqual(56);
    expect(r.centering.topBottom?.ratio[0]).toBeGreaterThanOrEqual(54);
    expect(r.centering.topBottom?.ratio[0]).toBeLessThanOrEqual(56);
  });

  it("tar ramens innerkant även när en starkare kant (bildruta) finns längre in", () => {
    const img = syntheticCard({ borders: { l: 36, r: 24, t: 30, b: 30 }, inner: [40, 50, 70] });
    // Rita en ljus bildruteram en bit in, med starkare kontrast än ramens innerkant.
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

  it("avstår när ramen och insidan har för låg kontrast", () => {
    const img = syntheticCard({ border: [150, 150, 150], inner: [158, 158, 158] });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight).toBeNull();
    expect(r.centering.note).toBeTruthy();
  });

  it("avstår när kortet ligger för snett", () => {
    const img = syntheticCard({ angleDeg: 7 });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.centering.leftRight).toBeNull();
    expect(r.centering.topBottom).toBeNull();
  });
});

describe("kvalitetskontroll", () => {
  it("ett bra foto ger inga varningar", () => {
    const r = analyzeQuality(syntheticCard(), "front", ORIG);
    expect(r.issues.filter((i) => i.level === "warn")).toEqual([]);
  });

  it("varnar för blänk och anger var", () => {
    const r = analyzeQuality(syntheticCard({ glare: { cx: 520, cy: 260, r: 60 } }), "front", ORIG);
    const g = r.issues.find((i) => i.code === "glare");
    expect(g).toBeDefined();
    expect(g!.message).toContain("övre högra");
  });

  it("varnar när ett hörn är utanför bilden", () => {
    const img = syntheticCard({ card: { x: -40, y: 120, w: 530, h: 740 } });
    const r = analyzeQuality(img, "back", ORIG);
    expect(r.issues.some((i) => i.code === "corner_cut" || i.code === "missing_card" || i.code === "aspect")).toBe(true);
  });

  it("varnar för oskärpa", () => {
    const r = analyzeQuality(syntheticCard({ blur: true, noise: 0 }), "front", ORIG);
    expect(r.issues.some((i) => i.code === "blur")).toBe(true);
  });

  it("varnar för låg upplösning", () => {
    const r = analyzeQuality(syntheticCard(), "front", { width: 600, height: 800 });
    expect(r.issues.some((i) => i.code === "low_res")).toBe(true);
  });

  it("varnar när inget kort syns", () => {
    const img = syntheticCard({ card: { x: 0, y: 0, w: 0, h: 0 } });
    const r = analyzeQuality(img, "front", ORIG);
    expect(r.issues.some((i) => i.code === "missing_card")).toBe(true);
  });
});
