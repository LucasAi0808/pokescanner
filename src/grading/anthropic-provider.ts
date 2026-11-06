import type { GradingProvider } from "./provider";

/**
 * Leverantörens metadata utan SDK:n. Själva SDK:n (den största delen av
 * bygget) laddas först när användaren trycker Analysera.
 */
export const anthropicProvider: GradingProvider = {
  id: "anthropic",
  label: "Anthropic Claude",
  recipient: "Anthropic (api.anthropic.com)",
  needsKey: true,
  costNote:
    "Anthropic tar betalt per anrop från ditt eget API-konto enligt deras prislista. PokeScanner är gratis och tar inget betalt.",
  analyze: async (req, signal) => {
    const { analyzeWithAnthropic } = await import("./anthropic");
    return analyzeWithAnthropic(req, signal);
  },
};
