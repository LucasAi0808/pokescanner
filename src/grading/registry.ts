import { anthropicProvider } from "./anthropic-provider";
import { demoProvider } from "./demo";
import type { GradingProvider } from "./provider";

/** Alla leverantörer. Lägg till en lokal modell här. */
export const PROVIDERS: Record<string, GradingProvider> = {
  [anthropicProvider.id]: anthropicProvider,
  [demoProvider.id]: demoProvider,
};

export function getProvider(id: string): GradingProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Okänd leverantör: ${id}`);
  return p;
}
