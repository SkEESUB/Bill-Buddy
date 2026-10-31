import { describe, it, expect, vi } from "vitest";
import { classifyError, toUserMessage, safeSanitizeMessage, safeLogError } from "./errors";
import { spendInputSchema } from "./spends.functions";

describe("Staging Save Failure & Error Resilience", () => {
  describe("Secret and PII Sanitization", () => {
    it("redacts JWT tokens from error messages", () => {
      const mockJwt =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
      const raw = `Auth failed with token ${mockJwt} for operation`;
      const sanitized = safeSanitizeMessage(raw);
      expect(sanitized).not.toContain(mockJwt);
      expect(sanitized).toContain("[REDACTED_JWT]");
    });

    it("redacts Bearer tokens from error messages", () => {
      const raw = "Request failed: Bearer secret_bearer_token_1234567890abcdef";
      const sanitized = safeSanitizeMessage(raw);
      expect(sanitized).not.toContain("secret_bearer_token");
      expect(sanitized).toContain("Bearer [REDACTED]");
    });

    it("redacts Supabase publishable and secret keys", () => {
      const raw =
        "Failed connecting with sb_publishable_ABCD1234efgh_99 and sb_secret_SECRET998877";
      const sanitized = safeSanitizeMessage(raw);
      expect(sanitized).not.toContain("sb_publishable_ABCD1234efgh_99");
      expect(sanitized).not.toContain("sb_secret_SECRET998877");
      expect(sanitized).toContain("[REDACTED_KEY]");
    });

    it("redacts user email addresses from error messages", () => {
      const raw = "Error provisioning account for user user.test@example.com in database";
      const sanitized = safeSanitizeMessage(raw);
      expect(sanitized).not.toContain("user.test@example.com");
      expect(sanitized).toContain("[REDACTED_EMAIL]");
    });

    it("safeLogError logs sanitized structure without leaking secrets", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const secretError = new Error(
        "Failed connecting with key sb_secret_TOPSECRET9999 for user test@domain.com",
      );
      safeLogError("testContext", secretError);

      expect(consoleSpy).toHaveBeenCalled();
      const loggedArg = consoleSpy.mock.calls[0]?.[1];
      expect(JSON.stringify(loggedArg)).not.toContain("sb_secret_TOPSECRET9999");
      expect(JSON.stringify(loggedArg)).not.toContain("test@domain.com");
      consoleSpy.mockRestore();
    });
  });

  describe("Error Classification for Bill and Spend Operations", () => {
    it("does not mask database constraint violations as generic unknown errors", () => {
      const constraintErr = new Error(
        'new row for relation "bill_occurrences" violates check constraint "bill_occurrences_status_check" (code: 23514)',
      );
      const classified = classifyError(constraintErr);
      expect(classified.kind).toBe("db_constraint");
      expect(classified.message).toContain("violates check constraint");
      const userMsg = toUserMessage(constraintErr);
      expect(userMsg).not.toBe("Something went wrong. Please try again.");
    });

    it("preserves actionable message for bill creation failures", () => {
      const billErr = new Error("Failed to create bill: Column due_date cannot be null (23502)");
      const classified = classifyError(billErr);
      expect(classified.kind).toBe("server_error");
      expect(classified.message).toContain("Failed to create bill");
      const userMsg = toUserMessage(billErr);
      expect(userMsg).not.toBe("Something went wrong. Please try again.");
      expect(userMsg).toContain("Failed to create bill");
    });

    it("preserves actionable message for spend creation failures", () => {
      const spendErr = new Error("Failed to create spend: Duplicate spend detected (23505)");
      const classified = classifyError(spendErr);
      expect(classified.kind).toBe("server_error");
      expect(classified.message).toContain("Failed to create spend");
      const userMsg = toUserMessage(spendErr);
      expect(userMsg).not.toBe("Something went wrong. Please try again.");
      expect(userMsg).toContain("Failed to create spend");
    });

    it("preserves staging guard failure message for clear environment diagnostics", () => {
      const guardErr = new Error(
        "[BillBuddy Staging Guard] Missing staging Supabase configuration. Production URL fallbacks are strictly prohibited in staging.",
      );
      const classified = classifyError(guardErr);
      expect(classified.kind).toBe("server_error");
      expect(classified.message).toContain("Staging Guard");
      const userMsg = toUserMessage(guardErr);
      expect(userMsg).not.toBe("Something went wrong. Please try again.");
    });
  });

  describe("Form Input Validation Integrity", () => {
    it("validates spend schema rejects non-positive amounts", () => {
      const result = spendInputSchema.safeParse({
        name: "Invalid Spend",
        amount: -50,
        spend_date: "2026-10-31",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("greater than zero");
      }
    });

    it("validates spend schema accepts valid spend inputs", () => {
      const result = spendInputSchema.safeParse({
        name: "Morning Coffee",
        amount: 150.5,
        spend_date: "2026-10-31",
        source: "upi",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.source).toBe("upi");
        expect(result.data.amount).toBe(150.5);
      }
    });
  });
});
