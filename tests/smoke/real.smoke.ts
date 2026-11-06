/**
 * Smoke test against the REAL Anthropic API using the same code as the app.
 * Costs one request (roughly $0.10–0.30 with Opus 5.5).
 *
 *   PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."; npm run smoke:real
 *   bash:        ANTHROPIC_API_KEY=sk-ant-... npm run smoke:real
 *
 * Optional: PS_MODEL=claude-sonnet-5-5 for the cheaper model.
 * The key is only read from the environment variable and never printed.
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { analyzeWithAnthropic } from "../../src/grading/anthropic";
import { actualCost, DEFAULT_MODEL } from "../../src/grading/provider";

const key = process.env.ANTHROPIC_API_KEY;
const model = process.env.PS_MODEL ?? DEFAULT_MODEL;

describe.skipIf(!key)("real API", () => {
  it(
    "grades the demo card and replies in the right format",
    async () => {
      const img = async (slot: "front" | "back") => ({
        slot,
        mediaType: "image/jpeg" as const,
        base64: (await readFile(`public/demo/${slot}.jpg`)).toString("base64"),
        width: 1500,
        height: 2000,
      });
      const res = await analyzeWithAnthropic(
        { images: [await img("front"), await img("back")], apiKey: key, model },
        new AbortController().signal,
      );
      const r = res.result;
      console.log("\n--- Reply from", res.servedBy, "---");
      console.log("Status:", r.status, r.gradeRange ? `${r.gradeRange.low}–${r.gradeRange.high}` : r.abstainReason);
      console.log("Summary:", r.summary);
      for (const f of r.findings) console.log(` [${f.kind}] ${f.image}: ${f.title} (${f.location})`, f.box ? "box ok" : "no box");
      console.log("Card:", r.card);
      if (res.usage) {
        const c = actualCost(res.usage, model);
        console.log(`Tokens: ${res.usage.inputTokens} in, ${res.usage.outputTokens} out ≈ $${c?.usd.toFixed(3)}`);
      }
      expect(["graded", "abstained"]).toContain(r.status);
      expect(r.summary.length).toBeGreaterThan(10);
    },
    5 * 60_000,
  );
});

it.skipIf(!!key)("skipped without ANTHROPIC_API_KEY", () => {
  console.log("Set ANTHROPIC_API_KEY to run the smoke test against the real API.");
});
