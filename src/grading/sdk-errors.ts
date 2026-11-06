import Anthropic from "@anthropic-ai/sdk";
import { GradingError } from "./errors";

/** Maps SDK errors to user-friendly errors. Ordered from most to least specific. */
export function toGradingError(err: unknown): GradingError {
  if (err instanceof GradingError) return err;
  if (err instanceof Anthropic.APIUserAbortError) return new GradingError("aborted");
  if (err instanceof Anthropic.AuthenticationError) return new GradingError("invalid_key");
  if (err instanceof Anthropic.PermissionDeniedError) return new GradingError("permission");
  if (err instanceof Anthropic.RateLimitError) return new GradingError("rate_limit");
  if (err instanceof Anthropic.OverloadedError) return new GradingError("overloaded");
  if (err instanceof Anthropic.InternalServerError) return new GradingError("server");
  if (err instanceof Anthropic.APIConnectionTimeoutError) return new GradingError("timeout");
  if (err instanceof Anthropic.APIConnectionError) return new GradingError("network");
  if (err instanceof Anthropic.BadRequestError) return new GradingError("bad_request", safeDetail(err.message));
  if (err instanceof Anthropic.APIError) {
    if (err.status === 529) return new GradingError("overloaded");
    return new GradingError("unknown", `HTTP ${err.status ?? "?"}`);
  }
  // The SDK throws AnthropicError for invalid JSON or schema mismatches.
  if (err instanceof Anthropic.AnthropicError) return new GradingError("bad_format");
  if (err instanceof DOMException && err.name === "AbortError") return new GradingError("aborted");
  return new GradingError("unknown");
}

/** API error messages never contain the key, but we still shorten them and strip anything that looks like one. */
function safeDetail(msg: string): string {
  return msg.replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-…").slice(0, 300);
}
