/**
 * Röktest mot det RIKTIGA Anthropic-API:t med samma kod som appen använder.
 * Kostar ett anrop (ungefär 1–3 kr med Opus 5.5).
 *
 *   PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..."; npm run smoke:real
 *   bash:        ANTHROPIC_API_KEY=sk-ant-... npm run smoke:real
 *
 * Valfritt: PS_MODEL=claude-sonnet-5-5 för den billigare modellen.
 * Nyckeln läses bara från miljövariabeln och skrivs aldrig ut.
 */
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { analyzeWithAnthropic } from "../../src/grading/anthropic";
import { actualCost, DEFAULT_MODEL } from "../../src/grading/provider";

const key = process.env.ANTHROPIC_API_KEY;
const model = process.env.PS_MODEL ?? DEFAULT_MODEL;

describe.skipIf(!key)("riktigt API", () => {
  it(
    "graderar demokortet och svarar i rätt format",
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
      console.log("\n--- Svar från", res.servedBy, "---");
      console.log("Status:", r.status, r.gradeRange ? `${r.gradeRange.low}–${r.gradeRange.high}` : r.abstainReason);
      console.log("Sammanfattning:", r.summary);
      for (const f of r.findings) console.log(` [${f.kind}] ${f.image}: ${f.title} (${f.location})`, f.box ? "ruta ok" : "ingen ruta");
      console.log("Kort:", r.card);
      if (res.usage) {
        const c = actualCost(res.usage, model);
        console.log(`Tokens: ${res.usage.inputTokens} in, ${res.usage.outputTokens} ut ≈ ${c?.sek.toFixed(2)} kr`);
      }
      expect(["graded", "abstained"]).toContain(r.status);
      expect(r.summary.length).toBeGreaterThan(10);
    },
    5 * 60_000,
  );
});

it.skipIf(!!key)("hoppas över utan ANTHROPIC_API_KEY", () => {
  console.log("Sätt ANTHROPIC_API_KEY för att köra röktestet mot riktiga API:t.");
});
