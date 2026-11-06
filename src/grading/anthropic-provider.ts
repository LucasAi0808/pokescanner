import type { GradingProvider } from "./provider";

/**
 * Provider metadata without the SDK. The SDK itself (the largest part of the
 * bundle) is only loaded when the user taps Analyze.
 */
export const anthropicProvider: GradingProvider = {
  id: "anthropic",
  label: "Anthropic Claude",
  recipient: "Anthropic (api.anthropic.com)",
  needsKey: true,
  costNote:
    "Anthropic charges your own API account per request according to their price list. PokeScanner itself is free.",
  analyze: async (req, signal) => {
    const { analyzeWithAnthropic } = await import("./anthropic");
    return analyzeWithAnthropic(req, signal);
  },
};
