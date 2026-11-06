import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { parseOutput } from "../../src/grading/anthropic";
import { DEMO_OUTPUT } from "../../src/grading/demo";
import { GradingError } from "../../src/grading/errors";
import { toGradingError } from "../../src/grading/sdk-errors";
import { estimateCost, imageTokens, ANTHROPIC_MODELS } from "../../src/grading/provider";
import { normalizeModelOutput, type ModelOutput } from "../../src/grading/types";
import { rarityOf } from "../../src/ui/format";
import { fitLimits } from "../../src/images/prepare";

const IMGS = [
  { slot: "front" as const, width: 1500, height: 2000 },
  { slot: "back" as const, width: 1500, height: 2000 },
];
const text = (t: string) => [{ type: "text", text: t, citations: null }] as unknown as Anthropic.Beta.BetaContentBlock[];
const clone = (): ModelOutput => structuredClone(DEMO_OUTPUT);

describe("response format", () => {
  it("accepts a valid reply", () => {
    expect(parseOutput(text(JSON.stringify(DEMO_OUTPUT))).grade_low).toBe(7);
  });
  it("broken JSON gives bad_format", () => {
    expect(() => parseOutput(text("{ not json"))).toThrowError(GradingError);
    try {
      parseOutput(text("{ not json"));
    } catch (e) {
      expect((e as GradingError).code).toBe("bad_format");
    }
  });
  it("wrong schema gives bad_format", () => {
    const bad = { ...DEMO_OUTPUT, findings: [{ image: "front" }] };
    expect(() => parseOutput(text(JSON.stringify(bad)))).toThrowError(/format/);
  });
});

describe("normalization", () => {
  it("converts pixel boxes to 0–1 and keeps findings", () => {
    const r = normalizeModelOutput(DEMO_OUTPUT, IMGS);
    const dot = r.findings.find((f) => f.title.includes("white dot"))!;
    expect(dot.image).toBe("back");
    expect(dot.box!.x).toBeCloseTo(168 / 1500, 5);
    expect(dot.box!.w).toBeCloseTo(64 / 1500, 5);
    expect(r.gradeRange).toEqual({ low: 7, high: 8 });
  });

  it("clamps boxes outside the image and drops findings on images that were not sent", () => {
    const o = clone();
    o.findings[0]!.box = { x: -50, y: 1900, width: 2000, height: 500 };
    o.findings.push({ ...o.findings[1]!, image: "closeup" });
    const r = normalizeModelOutput(o, IMGS);
    const b = r.findings[0]!.box!;
    expect(b.x).toBe(0);
    expect(b.x + b.w).toBeLessThanOrEqual(1);
    expect(b.y + b.h).toBeLessThanOrEqual(1);
    expect(r.findings.some((f) => f.image === "closeup")).toBe(false);
  });

  it("flips a reversed range and rounds to half grades within 1–10", () => {
    const o = clone();
    o.grade_low = 9.3;
    o.grade_high = 6.8;
    expect(normalizeModelOutput(o, IMGS).gradeRange).toEqual({ low: 7, high: 9.5 });
    o.grade_low = -2;
    o.grade_high = 14;
    expect(normalizeModelOutput(o, IMGS).gradeRange).toEqual({ low: 1, high: 10 });
  });

  it("an abstained reply has no range even if the model sent one", () => {
    const o = clone();
    o.status = "abstained";
    o.abstain_reason = null;
    const r = normalizeModelOutput(o, IMGS);
    expect(r.status).toBe("abstained");
    expect(r.gradeRange).toBeNull();
    expect(r.abstainReason).toBeTruthy();
  });

  it("'graded' without a range becomes abstained", () => {
    const o = clone();
    o.grade_low = null;
    o.grade_high = null;
    expect(normalizeModelOutput(o, IMGS).status).toBe("abstained");
  });
});

describe("error mapping", () => {
  const h = new Headers();
  it.each([
    [new Anthropic.AuthenticationError(401, {}, "x", h), "invalid_key"],
    [new Anthropic.RateLimitError(429, {}, "x", h), "rate_limit"],
    [new Anthropic.APIUserAbortError(), "aborted"],
    [new Anthropic.APIConnectionError({ message: "x" }), "network"],
    [new Anthropic.BadRequestError(400, {}, "bad sk-ant-abc123secret", h), "bad_request"],
  ] as const)("%s -> %s", (err, code) => {
    expect(toGradingError(err).code).toBe(code);
  });
  it("529 counts as overloaded", () => {
    const e = Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error" } }, "Overloaded", h);
    expect(toGradingError(e).code).toBe("overloaded");
  });
  it("error messages never contain anything that looks like a key", () => {
    const e = toGradingError(new Anthropic.BadRequestError(400, {}, "bad sk-ant-abc123secret", h));
    expect(e.detail).not.toContain("abc123secret");
    expect(e.message).not.toContain("sk-ant-abc");
  });
});

describe("image size and cost", () => {
  it("stays under Anthropic's limits (2576 px, 4784 tokens)", () => {
    for (const [w, h] of [
      [4032, 3024],
      [3024, 4032],
      [8064, 6048],
      [1000, 1400],
    ] as const) {
      const f = fitLimits(w, h);
      expect(Math.max(f.width, f.height)).toBeLessThanOrEqual(2576);
      expect(imageTokens(f.width, f.height)).toBeLessThanOrEqual(4784);
    }
    expect(fitLimits(1000, 1400)).toEqual({ width: 1000, height: 1400 });
  });
  it("the cost estimate is reasonable", () => {
    const est = estimateCost(IMGS, ANTHROPIC_MODELS[0]!);
    expect(est.usd).toBeGreaterThan(0.05);
    expect(est.usd).toBeLessThan(1);
  });
});

describe("rarity badge", () => {
  it("maps the middle of the range to stars", () => {
    expect(rarityOf({ low: 9, high: 10 })).toMatchObject({ stars: 4, holo: true });
    expect(rarityOf({ low: 7, high: 8 })).toMatchObject({ stars: 3, holo: false });
    expect(rarityOf({ low: 4, high: 6 })).toMatchObject({ stars: 2 });
    expect(rarityOf({ low: 1, high: 3 })).toMatchObject({ stars: 1 });
    expect(rarityOf(null)).toBeNull();
  });
});
