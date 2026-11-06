import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { AnalyzeRequest, AnalyzeResponse } from "./provider";
import { GradingError } from "./errors";
import { toGradingError } from "./sdk-errors";
import { SYSTEM_PROMPT, USER_INSTRUCTION, imageIntro } from "./prompt";
import { ModelOutputSchema, normalizeModelOutput, type ModelOutput } from "./types";

/**
 * Anropar Anthropic direkt från webbläsaren med användarens egen nyckel.
 * Nyckeln skickas bara i Authorization-headern till api.anthropic.com. Den finns
 * aldrig i bygget, sparas inte och loggas inte.
 */
export async function analyzeWithAnthropic(
  req: AnalyzeRequest,
  signal: AbortSignal,
  options: { baseURL?: string } = {},
): Promise<AnalyzeResponse> {
  if (!req.apiKey) throw new GradingError("invalid_key");

  const client = new Anthropic({
    apiKey: req.apiKey,
    // Nyckeln matas in av användaren vid körning (bring your own key). Ingen
    // nyckel bakas in i klientkoden, så webbläsaranrop är avsiktligt här.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
    timeout: 5 * 60 * 1000,
    ...(options.baseURL ? { baseURL: options.baseURL } : {}),
  });

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of req.images) {
    content.push({ type: "text", text: imageIntro(img) });
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    });
  }
  content.push({ type: "text", text: USER_INSTRUCTION });

  try {
    // create() i stället för parse(): stop_reason måste kontrolleras innan
    // texten tolkas, annars blir en refusal (tom text) ett formatfel.
    const response = await client.beta.messages.create(
      {
        model: req.model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
        // Structured outputs: JSON-schemat från zod-schemat.
        output_config: { effort: "high", format: betaZodOutputFormat(ModelOutputSchema) },
        // Om modellen avböjer av policyskäl provar servern en ersättningsmodell.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal },
    );

    if (response.stop_reason === "refusal") throw new GradingError("refusal");
    if (response.stop_reason === "max_tokens") throw new GradingError("truncated");
    const parsed = parseOutput(response.content);

    return {
      result: normalizeModelOutput(parsed, req.images),
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
      servedBy: response.model,
    };
  } catch (err) {
    throw toGradingError(err);
  }
}

/** Tolkar modellens text-svar och validerar det mot schemat. */
export function parseOutput(content: Anthropic.Beta.BetaContentBlock[]): ModelOutput {
  const text = content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new GradingError("bad_format");
  }
  const r = ModelOutputSchema.safeParse(json);
  if (!r.success) throw new GradingError("bad_format", r.error.issues.slice(0, 3).map((i) => i.path.join(".")).join(", "));
  return r.data;
}
