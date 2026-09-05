/**
 * Single place that turns a thrown value into a message we are willing to show
 * a user. Raw database/PostgREST text never reaches the screen.
 */

export type FinanceErrorKind =
  | "already_settled"
  | "not_settleable"
  | "network"
  | "unauthorized"
  | "validation"
  | "unknown_result"
  | "server";

export type FinanceError = { kind: FinanceErrorKind; message: string };

const MESSAGES: Record<FinanceErrorKind, string> = {
  already_settled: "This bill has already been settled.",
  not_settleable: "This instalment was cancelled or skipped, so it can't be paid.",
  network: "Couldn't connect. Check your connection and try again.",
  unauthorized: "Your session has expired. Please sign in again.",
  validation: "Please check the details and try again.",
  unknown_result:
    "We couldn't confirm the result. Refresh and check the bill before trying again.",
  server: "Something went wrong. Your financial data was not changed.",
};

function rawMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}

/** Classify a thrown value into a stable, user-safe error. */
export function classifyError(error: unknown): FinanceError {
  const raw = rawMessage(error);
  const lower = raw.toLowerCase();

  if (lower.includes("already marked as paid") || lower.includes("already settled")) {
    return { kind: "already_settled", message: MESSAGES.already_settled };
  }
  if (lower.includes("cancelled or skipped")) {
    return { kind: "not_settleable", message: MESSAGES.not_settleable };
  }
  if (lower.includes("unauthorized") || lower.includes("jwt") || lower.includes("signed in")) {
    return { kind: "unauthorized", message: MESSAGES.unauthorized };
  }
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("load failed") ||
    lower.includes("timeout") ||
    lower.includes("aborted")
  ) {
    return { kind: "network", message: MESSAGES.network };
  }
  // Zod validation errors arrive as JSON issue arrays or "expected ..." text.
  if (lower.includes("must be") || lower.includes("required") || lower.includes("expected a")) {
    return { kind: "validation", message: raw.length < 160 ? raw : MESSAGES.validation };
  }
  return { kind: "server", message: MESSAGES.server };
}

/** Message for an operation whose outcome we genuinely do not know. */
export const UNKNOWN_RESULT_MESSAGE = MESSAGES.unknown_result;

/** Shorthand when only the string is needed. */
export function toUserMessage(error: unknown): string {
  return classifyError(error).message;
}
