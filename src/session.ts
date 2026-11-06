import { ANTHROPIC_MODELS, DEFAULT_MODEL } from "./grading/provider";

/**
 * API-nyckeln finns bara i den här modulvariabeln, alltså i minnet för den
 * öppna fliken. Den skrivs aldrig till localStorage, IndexedDB, loggar eller
 * resultat, och försvinner när sidan laddas om eller stängs.
 */
let apiKey: string | null = null;
let consentGiven = false;

export const session = {
  getKey: () => apiKey,
  setKey: (k: string) => {
    apiKey = k.trim() || null;
  },
  clearKey: () => {
    apiKey = null;
  },
  hasConsent: () => consentGiven,
  giveConsent: () => {
    consentGiven = true;
  },
};

/** Modellvalet är ingen hemlighet och får sparas lokalt som bekvämlighet. */
const MODEL_KEY = "pokescanner.model";
export function loadModel(): string {
  try {
    const m = localStorage.getItem(MODEL_KEY);
    if (m && ANTHROPIC_MODELS.some((x) => x.id === m)) return m;
  } catch {
    /* privat läge m.m. */
  }
  return DEFAULT_MODEL;
}
export function saveModel(m: string) {
  try {
    localStorage.setItem(MODEL_KEY, m);
  } catch {
    /* ignorera */
  }
}
