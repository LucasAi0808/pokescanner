import type { GradingResult, ProviderImage, Usage } from "./types";

/**
 * Gränssnitt för en bildmodell som kan gradera. Lägg till en lokal modell
 * (t.ex. en vision-modell via Ollama) genom att implementera detta och
 * registrera den i `src/grading/registry.ts`.
 */
export interface GradingProvider {
  id: string;
  /** Visas i UI:t, t.ex. "Anthropic Claude" */
  label: string;
  /** Vem som tar emot bilderna, visas före första analysen. */
  recipient: string;
  /** Kräver leverantören en API-nyckel från användaren? */
  needsKey: boolean;
  /** Kort text om kostnad som visas före första analysen. */
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
  /** Modellen som faktiskt svarade (kan skilja sig vid serverns fallback). */
  servedBy: string;
}

export interface ModelOption {
  id: string;
  label: string;
  /** USD per miljon tokens */
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
    note: "Noggrannast. Standard.",
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    inputPrice: 2,
    outputPrice: 10,
    note: "Ungefär halva kostnaden, något mindre noggrann.",
  },
];

export const DEFAULT_MODEL = ANTHROPIC_MODELS[0]!.id;

/** Ungefärlig växelkurs för kostnadsvisning. Bara en fingervisning. */
export const SEK_PER_USD = 10.5;

/** Visuella tokens per bild enligt Anthropics regel ⌈w/28⌉·⌈h/28⌉. */
export function imageTokens(width: number, height: number): number {
  return Math.ceil(width / 28) * Math.ceil(height / 28);
}

/** Uppskattning före analysen: bilder + prompt + ett typiskt svar inklusive tänkande. */
export function estimateCost(
  images: { width: number; height: number }[],
  model: ModelOption,
): { inputTokens: number; outputTokens: number; usd: number; sek: number } {
  const inputTokens = images.reduce((s, i) => s + imageTokens(i.width, i.height), 0) + 2500;
  const outputTokens = 7000;
  const usd = (inputTokens * model.inputPrice + outputTokens * model.outputPrice) / 1_000_000;
  return { inputTokens, outputTokens, usd, sek: usd * SEK_PER_USD };
}

export function actualCost(usage: Usage, modelId: string): { usd: number; sek: number } | null {
  const m = ANTHROPIC_MODELS.find((x) => modelId.startsWith(x.id));
  if (!m) return null;
  const usd = (usage.inputTokens * m.inputPrice + usage.outputTokens * m.outputPrice) / 1_000_000;
  return { usd, sek: usd * SEK_PER_USD };
}
