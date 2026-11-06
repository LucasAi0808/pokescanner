import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { parseOutput } from "../../src/grading/anthropic";
import { DEMO_OUTPUT } from "../../src/grading/demo";
import { GradingError } from "../../src/grading/errors";
import { toGradingError } from "../../src/grading/sdk-errors";
import { estimateCost, imageTokens, ANTHROPIC_MODELS } from "../../src/grading/provider";
import { normalizeModelOutput, type ModelOutput } from "../../src/grading/types";
import { fitLimits } from "../../src/images/prepare";

const IMGS = [
  { slot: "front" as const, width: 1500, height: 2000 },
  { slot: "back" as const, width: 1500, height: 2000 },
];
const text = (t: string) => [{ type: "text", text: t, citations: null }] as unknown as Anthropic.Beta.BetaContentBlock[];
const clone = (): ModelOutput => structuredClone(DEMO_OUTPUT);

describe("svarsformat", () => {
  it("godtar ett giltigt svar", () => {
    expect(parseOutput(text(JSON.stringify(DEMO_OUTPUT))).grade_low).toBe(7);
  });
  it("trasig JSON ger bad_format", () => {
    expect(() => parseOutput(text("{ inte json"))).toThrowError(GradingError);
    try {
      parseOutput(text("{ inte json"));
    } catch (e) {
      expect((e as GradingError).code).toBe("bad_format");
    }
  });
  it("fel schema ger bad_format", () => {
    const bad = { ...DEMO_OUTPUT, findings: [{ image: "front" }] };
    expect(() => parseOutput(text(JSON.stringify(bad)))).toThrowError(/format/);
  });
});

describe("normalisering", () => {
  it("räknar om pixelrutor till 0–1 och behåller fynd", () => {
    const r = normalizeModelOutput(DEMO_OUTPUT, IMGS);
    const dot = r.findings.find((f) => f.title.includes("vit prick"))!;
    expect(dot.image).toBe("back");
    expect(dot.box!.x).toBeCloseTo(168 / 1500, 5);
    expect(dot.box!.w).toBeCloseTo(64 / 1500, 5);
    expect(r.gradeRange).toEqual({ low: 7, high: 8 });
  });

  it("klipper rutor utanför bilden och tar bort fynd på bilder som inte skickats", () => {
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

  it("vänder på omkastat intervall och avrundar till halvsteg inom 1–10", () => {
    const o = clone();
    o.grade_low = 9.3;
    o.grade_high = 6.8;
    expect(normalizeModelOutput(o, IMGS).gradeRange).toEqual({ low: 7, high: 9.5 });
    o.grade_low = -2;
    o.grade_high = 14;
    expect(normalizeModelOutput(o, IMGS).gradeRange).toEqual({ low: 1, high: 10 });
  });

  it("avstått svar har inget intervall även om modellen skickat ett", () => {
    const o = clone();
    o.status = "abstained";
    o.abstain_reason = null;
    const r = normalizeModelOutput(o, IMGS);
    expect(r.status).toBe("abstained");
    expect(r.gradeRange).toBeNull();
    expect(r.abstainReason).toBeTruthy();
  });

  it("'graded' utan intervall blir avstått", () => {
    const o = clone();
    o.grade_low = null;
    o.grade_high = null;
    expect(normalizeModelOutput(o, IMGS).status).toBe("abstained");
  });
});

describe("felmappning", () => {
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
  it("529 räknas som överbelastat", () => {
    const e = Anthropic.APIError.generate(529, { type: "error", error: { type: "overloaded_error" } }, "Overloaded", h);
    expect(toGradingError(e).code).toBe("overloaded");
  });
  it("felmeddelanden innehåller aldrig något som liknar en nyckel", () => {
    const e = toGradingError(new Anthropic.BadRequestError(400, {}, "bad sk-ant-abc123secret", h));
    expect(e.detail).not.toContain("abc123secret");
    expect(e.message).not.toContain("sk-ant-abc");
  });
});

describe("bildstorlek och kostnad", () => {
  it("håller sig under Anthropics gränser (2576 px, 4784 tokens)", () => {
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
  it("kostnadsuppskattningen är rimlig", () => {
    const est = estimateCost(IMGS, ANTHROPIC_MODELS[0]!);
    expect(est.sek).toBeGreaterThan(0.5);
    expect(est.sek).toBeLessThan(10);
  });
});
