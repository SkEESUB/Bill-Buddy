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
  | "db_constraint"
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

  // ── Database constraint violation ─────────────────────────
  if (
    lower.includes("violates check constraint") ||
    lower.includes("check constraint") ||
    lower.includes("23514")
  ) {
    const safeMsg = safeSanitizeMessage(raw);
    return {
      kind: "db_constraint",
      message: safeMsg.length < 160 ? safeMsg : "Invalid data violates a database rule.",
      action: "Please verify the details and try again.",
      technical: safeMsg,
      retryable: false,
    };
  }

  // ── Database & save operational errors ───────────────────────
  if (
    lower.includes("failed to create") ||
    lower.includes("failed to update") ||
    lower.includes("failed to delete") ||
    lower.includes("staging guard") ||
    lower.includes("config_error") ||
    lower.includes("schedule failed")
  ) {
    const safeMsg = safeSanitizeMessage(raw);
    return {
      kind: "server_error",
      message: safeMsg.length < 160 ? safeMsg : "Unable to save record.",
      action: "Please try again.",
      technical: safeMsg,
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
  const safeFallback = safeSanitizeMessage(raw);
  const isHelpful =
    safeFallback.length > 0 && safeFallback.length < 120 && !safeFallback.includes("{");
  return {
    kind: "unknown",
    message: isHelpful ? safeFallback : "Something went wrong.",
    action: "Please try again.",
    technical: safeFallback,
    retryable: true,
  };
}

/** Sanitize an error string to eliminate JWTs, secrets, API keys and email addresses */
export function safeSanitizeMessage(raw: string): string {
  if (!raw) return "";
  let sanitized = String(raw);
  // Redact JWT tokens (header.payload.signature)
  sanitized = sanitized.replace(
    /ey[A-Za-z0-9_-]{10,}\.ey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    "[REDACTED_JWT]",
  );
  // Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");
  // Redact Supabase keys
  sanitized = sanitized.replace(/sb_(publishable|secret)_[A-Za-z0-9_-]+/g, "[REDACTED_KEY]");
  // Redact email addresses
  sanitized = sanitized.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    "[REDACTED_EMAIL]",
  );
  return sanitized;
}

/** Safe structured error logging that prevents secret and PII leakage */
export function safeLogError(contextName: string, error: unknown): void {
  const classified = classifyError(error);
  console.error(`[BillBuddy Error][${contextName}]`, {
    kind: classified.kind,
    message: safeSanitizeMessage(classified.message),
    technical: safeSanitizeMessage(classified.technical ?? ""),
  });
}

export function toUserMessage(error: unknown): string {
  const c = classifyError(error);
  return c.action ? `${c.message} ${c.action}` : c.message;
}
