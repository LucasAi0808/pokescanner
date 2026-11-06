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
  aborted: "The analysis was cancelled. Your photos are still here and nothing was saved.",
  invalid_key:
    "Anthropic did not accept the API key. Check that you pasted the whole key (it starts with sk-ant-) and that it has not been revoked.",
  permission: "The key does not have access to this model or feature. Check the key and your Anthropic account.",
  rate_limit:
    "Too many requests right now (rate limit) or no credit left on the account. Wait a moment or check your balance with Anthropic.",
  overloaded: "Anthropic is temporarily overloaded. Try again in a little while.",
  server: "Something went wrong at Anthropic. Try again in a moment.",
  network: "Could not reach Anthropic. Check your internet connection and try again.",
  timeout: "The analysis took too long and was stopped. Try again.",
  bad_request:
    "Anthropic did not accept the request. It may be the size or format of the photos. Try retaking them.",
  bad_format: "The model replied in a format the app could not read. Nothing was saved. Try again.",
  refusal: "The model declined to analyze the photos. Check that they show a trading card.",
  truncated: "The reply was too long and got cut off. Try again, ideally with fewer extra photos.",
  unknown: "Something unexpected went wrong. Try again.",
};

export class GradingError extends Error {
  readonly code: GradingErrorCode;
  readonly retryable: boolean;
  detail?: string;
  constructor(code: GradingErrorCode, detail?: string) {
    super(MESSAGES[code]);
    this.name = "GradingError";
    this.code = code;
    this.retryable = !["invalid_key", "permission", "aborted", "refusal"].includes(code);
    if (detail) this.detail = detail;
  }
}

/**
 * Turns any error into a GradingError without loading the SDK.
 * SDK-specific errors are already translated in `sdk-errors.ts` before they get here.
 */
export function asGradingError(err: unknown): GradingError {
  if (err instanceof GradingError) return err;
  if (err instanceof DOMException && err.name === "AbortError") return new GradingError("aborted");
  return new GradingError("unknown");
}
