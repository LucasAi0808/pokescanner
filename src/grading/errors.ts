export type GradingErrorCode =
  | "aborted"
  | "invalid_key"
  | "permission"
  | "rate_limit"
  | "overloaded"
  | "server"
  | "network"
  | "timeout"
  | "bad_request"
  | "bad_format"
  | "refusal"
  | "truncated"
  | "unknown";

const MESSAGES: Record<GradingErrorCode, string> = {
  aborted: "Analysen avbröts. Bilderna ligger kvar och inget sparades.",
  invalid_key:
    "API-nyckeln godkändes inte av Anthropic. Kontrollera att du klistrat in hela nyckeln (den börjar med sk-ant-) och att den inte är spärrad.",
  permission:
    "Nyckeln saknar behörighet för den här modellen eller funktionen. Kontrollera nyckeln och kontot hos Anthropic.",
  rate_limit:
    "För många anrop just nu (rate limit) eller slut på kredit i kontot. Vänta en stund eller kontrollera saldot hos Anthropic.",
  overloaded: "Anthropic är tillfälligt överbelastat. Försök igen om en liten stund.",
  server: "Något gick fel hos Anthropic. Försök igen om en stund.",
  network: "Kunde inte nå Anthropic. Kontrollera internetanslutningen och försök igen.",
  timeout: "Analysen tog för lång tid och avbröts. Försök igen.",
  bad_request:
    "Anropet godtogs inte av Anthropic. Det kan bero på bildernas storlek eller format. Prova att ta om bilderna.",
  bad_format:
    "Modellen svarade i ett format som appen inte kunde läsa. Inget sparades. Försök igen.",
  refusal: "Modellen avböjde att analysera bilderna. Kontrollera att bilderna visar ett samlarkort.",
  truncated: "Svaret blev för långt och klipptes av. Försök igen, gärna med färre extrabilder.",
  unknown: "Ett oväntat fel inträffade. Försök igen.",
};

export class GradingError extends Error {
  readonly code: GradingErrorCode;
  readonly retryable: boolean;
  constructor(code: GradingErrorCode, detail?: string) {
    super(MESSAGES[code]);
    this.name = "GradingError";
    this.code = code;
    this.retryable = !["invalid_key", "permission", "aborted", "refusal"].includes(code);
    if (detail) this.detail = detail;
  }
  detail?: string;
}

/**
 * Gör om vilket fel som helst till ett GradingError utan att ladda SDK:n.
 * SDK-specifika fel översätts redan i `sdk-errors.ts` innan de når hit.
 */
export function asGradingError(err: unknown): GradingError {
  if (err instanceof GradingError) return err;
  if (err instanceof DOMException && err.name === "AbortError") return new GradingError("aborted");
  return new GradingError("unknown");
}
