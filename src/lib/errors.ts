// src/lib/errors.ts
// BillBuddy Domain Error Classifier
// Maps raw errors to user-friendly messages with correct context

export type ErrorKind =
  | "config_error"
  | "invalid_api_key"
  | "missing_table"
  | "missing_account"
  | "account_suspended"
  | "account_deactivated"
  | "session_expired"
  | "auth_missing"
  | "rls_denied"
  | "network"
  | "validation"
  | "not_found"
  | "rate_limit"
  | "server_error"
  | "already_settled"
  | "not_settleable"
  | "unauthorized"
  | "unknown";

export interface ClassifiedError {
  kind: ErrorKind;
  message: string;
  action?: string;
  technical?: string;
  retryable: boolean;
}

export type FinanceErrorKind = ErrorKind;
export type FinanceError = ClassifiedError;

export const UNKNOWN_RESULT_MESSAGE =
  "We couldn't confirm the result. Refresh and check the bill before trying again.";

export function classifyError(error: unknown): ClassifiedError {
  const raw = error instanceof Error ? error.message : String(error ?? "Unknown error");
  const lower = raw.toLowerCase();

  // ── Business logic states ──────────────────────────────────
  if (lower.includes("already marked as paid") || lower.includes("already settled")) {
    return {
      kind: "already_settled",
      message: "This bill has already been settled.",
      technical: raw,
      retryable: false,
    };
  }
  if (lower.includes("cancelled or skipped")) {
    return {
      kind: "not_settleable",
      message: "This instalment was cancelled or skipped, so it can't be paid.",
      technical: raw,
      retryable: false,
    };
  }

  // ── Config / API Key errors ────────────────────────────────
  // NEVER show "session expired" for these
  if (
    lower.includes("config_error") ||
    lower.includes("invalid api key") ||
    lower.includes("no api key") ||
    lower.includes("apikey") ||
    lower.includes("missing supabase environment variable")
  ) {
    return {
      kind: "invalid_api_key",
      message: "App configuration error.",
      action: "Please contact support.",
      technical: raw,
      retryable: false,
    };
  }

  // ── Missing DB table (wrong Supabase project) ─────────────
  if (
    lower.includes("pgrst205") ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    (lower.includes("relation") && lower.includes("does not exist"))
  ) {
    console.error("[BillBuddy Database Error] Schema/table missing:", raw);
    return {
      kind: "missing_table",
      message: "Service temporarily unavailable.",
      action: "Please try again in a few minutes.",
      technical: raw,
      retryable: true,
    };
  }

  // ── Account suspended / deactivated ────────────────────────
  if (lower.includes("account_suspended") || lower.includes("account suspended")) {
    return {
      kind: "account_suspended",
      message: "Your account has been suspended.",
      action: "Contact support for help.",
      technical: raw,
      retryable: false,
    };
  }
  if (lower.includes("account_deactivated") || lower.includes("account_closed")) {
    return {
      kind: "account_deactivated",
      message: "Your account has been deactivated.",
      action: "Contact support for help.",
      technical: raw,
      retryable: false,
    };
  }

  // ── Missing account profile ────────────────────────────────
  if (
    lower.includes("missing_account") ||
    lower.includes("account not found") ||
    lower.includes("account status could not be verified") ||
    lower.includes("db_error: profile lookup")
  ) {
    return {
      kind: "missing_account",
      message: "Setting up your account...",
      action: "Please wait a moment and refresh.",
      technical: raw,
      retryable: true,
    };
  }

  // ── RLS / Permission denied ───────────────────────────────
  // This is NOT a session error
  if (
    lower.includes("permission denied") ||
    lower.includes("42501") ||
    lower.includes("insufficient_privilege") ||
    lower.includes("violates row-level security") ||
    lower.includes("rls")
  ) {
    return {
      kind: "rls_denied",
      message: "You do not have permission to do this.",
      technical: raw,
      retryable: false,
    };
  }

  // ── Missing auth header ────────────────────────────────────
  if (
    lower.includes("auth_missing") ||
    lower.includes("authorization header") ||
    lower.includes("no authorization header provided") ||
    lower.includes("must be signed in")
  ) {
    return {
      kind: "auth_missing",
      message: "Please sign in to continue.",
      action: "Sign in",
      technical: raw,
      retryable: false,
    };
  }

  // ── REAL session expiry ────────────────────────────────────
  // ONLY match actual JWT expiry — NOT generic "unauthorized"
  if (
    lower.includes("jwt expired") ||
    lower.includes("token is expired") ||
    lower.includes("token has expired") ||
    lower.includes("token expired") ||
    lower.includes("refresh_token_not_found") ||
    lower.includes("auth_invalid:")
  ) {
    return {
      kind: "session_expired",
      message: "Your session has expired.",
      action: "Sign in again",
      technical: raw,
      retryable: false,
    };
  }

  // ── Rate limiting ──────────────────────────────────────────
  if (
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("too many requests")
  ) {
    return {
      kind: "rate_limit",
      message: "Too many requests.",
      action: "Wait a moment and try again.",
      technical: raw,
      retryable: true,
    };
  }

  // ── Network errors ─────────────────────────────────────────
  if (
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("networkerror") ||
    lower.includes("econnrefused") ||
    lower.includes("load failed") ||
    lower.includes("timeout")
  ) {
    return {
      kind: "network",
      message: "Network error.",
      action: "Check your connection and try again.",
      technical: raw,
      retryable: true,
    };
  }

  // ── Validation ─────────────────────────────────────────────
  if (
    lower.includes("validation") ||
    lower.includes("invalid input") ||
    lower.includes("must be") ||
    lower.includes("required")
  ) {
    return {
      kind: "validation",
      message: raw.length < 160 ? raw : "Please check the details and try again.",
      technical: raw,
      retryable: false,
    };
  }

  // ── Fallback ───────────────────────────────────────────────
  return {
    kind: "unknown",
    message: "Something went wrong.",
    action: "Please try again.",
    technical: raw,
    retryable: true,
  };
}

export function toUserMessage(error: unknown): string {
  const c = classifyError(error);
  return c.action ? `${c.message} ${c.action}` : c.message;
}
