import { anthropicProvider } from "./anthropic-provider";
import { demoProvider } from "./demo";
import type { GradingProvider } from "./provider";

/** All providers. Add a local model here. */
export const PROVIDERS: Record<string, GradingProvider> = {
  [anthropicProvider.id]: anthropicProvider,
  [demoProvider.id]: demoProvider,
};

export function getProvider(id: string): GradingProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown provider: ${id}`);
  return p;
}
