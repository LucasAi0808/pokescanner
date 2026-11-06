import type { GradingResult, ProviderImage, Usage } from "./types";

/**
 * Interface for an image model that can grade cards. Add a local model
 * (e.g. a vision model via Ollama) by implementing this and registering it
 * in `src/grading/registry.ts`.
 */
export interface GradingProvider {
  id: string;
  /** Shown in the UI, e.g. "Anthropic Claude" */
  label: string;
  /** Who receives the photos, shown before the first analysis. */
  recipient: string;
  /** Does the provider need an API key from the user? */
  needsKey: boolean;
  /** Short cost note shown before the first analysis. */
  costNote: string;
  analyze(request: AnalyzeRequest, signal: AbortSignal): Promise<AnalyzeResponse>;
}

export interface AnalyzeRequest {
  images: ProviderImage[];
  apiKey?: string;
  model: string;
}

export interface AnalyzeResponse {
  result: GradingResult;
  usage: Usage | null;
  /** The model that actually answered (may differ when the server falls back). */
  servedBy: string;
}

export interface ModelOption {
  id: string;
  label: string;
  /** USD per million tokens */
  inputPrice: number;
  outputPrice: number;
  note: string;
}

export const ANTHROPIC_MODELS: ModelOption[] = [
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    inputPrice: 4,
    outputPrice: 20,
    note: "Most thorough. Default.",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    inputPrice: 2,
    outputPrice: 10,
    note: "About half the cost, slightly less thorough.",
  },
];

export const DEFAULT_MODEL = ANTHROPIC_MODELS[0]!.id;

/** Visual tokens per image according to Anthropic's rule ⌈w/28⌉·⌈h/28⌉. */
export function imageTokens(width: number, height: number): number {
  return Math.ceil(width / 28) * Math.ceil(height / 28);
}

/** Estimate before the analysis: images + prompt + a typical reply including thinking. */
export function estimateCost(
  images: { width: number; height: number }[],
  model: ModelOption,
): { inputTokens: number; outputTokens: number; usd: number } {
  const inputTokens = images.reduce((s, i) => s + imageTokens(i.width, i.height), 0) + 2500;
  const outputTokens = 7000;
  const usd = (inputTokens * model.inputPrice + outputTokens * model.outputPrice) / 1_000_000;
  return { inputTokens, outputTokens, usd };
}

export function actualCost(usage: Usage, modelId: string): { usd: number } | null {
  const m = ANTHROPIC_MODELS.find((x) => modelId.startsWith(x.id));
  if (!m) return null;
  return { usd: (usage.inputTokens * m.inputPrice + usage.outputTokens * m.outputPrice) / 1_000_000 };
}
