import Anthropic from "@anthropic-ai/sdk";
import { GradingError } from "./errors";

/** Översätter SDK-fel till svenska, användarvänliga fel. Ordningen är mest specifik först. */
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
  // SDK:ns structured-output-parser kastar AnthropicError vid ogiltig JSON/schemamiss.
  if (err instanceof Anthropic.AnthropicError) return new GradingError("bad_format");
  if (err instanceof DOMException && err.name === "AbortError") return new GradingError("aborted");
  return new GradingError("unknown");
}

/** Felmeddelanden från API:t innehåller aldrig nyckeln, men vi kortar dem ändå och tar bort allt som liknar en nyckel. */
function safeDetail(msg: string): string {
  return msg.replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-…").slice(0, 300);
}
