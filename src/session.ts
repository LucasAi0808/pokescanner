import { ANTHROPIC_MODELS, DEFAULT_MODEL } from "./grading/provider";

/**
 * The API key only lives in this module variable, i.e. in memory for the open
 * tab. It is never written to localStorage, IndexedDB, logs or results, and it
 * disappears when the page is reloaded or closed.
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

/** The model choice is not a secret and may be stored locally for convenience. */
const MODEL_KEY = "pokescanner.model";
export function loadModel(): string {
  try {
    const m = localStorage.getItem(MODEL_KEY);
    if (m && ANTHROPIC_MODELS.some((x) => x.id === m)) return m;
  } catch {
    /* private mode etc. */
  }
  return DEFAULT_MODEL;
}
export function saveModel(m: string) {
  try {
    localStorage.setItem(MODEL_KEY, m);
  } catch {
    /* ignore */
  }
}
