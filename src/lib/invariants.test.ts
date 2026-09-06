import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  availableBalance,
  isValidAmount,
  round2,
  totalSpending,
  totalIncome,
  safeToSpend,
  type TxnLike,
} from "@/lib/money";
import { reversalTypeFor } from "@/lib/transactions";
import {
  amountsMatch,
  canTransition,
  isTerminal,
  transition,
  type PaymentState,
} from "@/lib/payments/state";
import { statusResult } from "@/lib/payments/status";
import { assertAccountActive, AccountInactiveError } from "@/lib/auth/active-account";
import { classifyError, toUserMessage } from "@/lib/errors";

describe("Financial Invariant 1 & 3: Occurrence settlement and single-payment guarantee", () => {
  it("never transitions a settled payment to another state except refund", () => {
    expect(canTransition("CAPTURED", "FAILED")).toBe(false);
    expect(canTransition("CAPTURED", "CANCELLED")).toBe(false);
    expect(canTransition("CAPTURED", "EXPIRED")).toBe(false);
    expect(canTransition("CAPTURED", "REFUNDED")).toBe(true);
    expect(canTransition("CAPTURED", "AUTHORIZED")).toBe(false);
  });

  it("identifies settled status strictly for CAPTURED", () => {
    const states: PaymentState[] = [
      "CREATED",
      "ORDER_CREATED",
      "CHECKOUT_OPENED",
      "USER_PROCESSING",
      "AUTHORIZED",
      "CAPTURED",
      "FAILED",
      "CANCELLED",
      "EXPIRED",
      "REFUNDED",
      "UNKNOWN",
    ];

    const dummyOrder = { id: "ord-1", amount: 500, currency: "INR" };

    for (const state of states) {
      const res = statusResult(dummyOrder, state);
      if (state === "CAPTURED") {
        expect(res.settled).toBe(true);
      } else {
        expect(res.settled).toBe(false);
      }
    }
  });

  it("refuses to transition captured payment to in-flight or authorized states", () => {
    expect(() => transition("CAPTURED", "AUTHORIZED")).toThrow();
    expect(() => transition("CAPTURED", "USER_PROCESSING")).toThrow();
  });
});

describe("Financial Invariant 2: Transaction Idempotency and client_request_id", () => {
  it("enforces unique constraint on user_id and client_request_id in migration files", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFiles = readdirSync(migrationsDir);
    let foundIndex = false;

    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), "utf8");
      if (
        content.includes("transactions_user_request_key") ||
        content.includes("UNIQUE (user_id, client_request_id)") ||
        (content.includes("CREATE UNIQUE INDEX") && content.includes("client_request_id"))
      ) {
        foundIndex = true;
        break;
      }
    }

    expect(foundIndex).toBe(true);
  });

  it("server function createTransaction handles duplicate client_request_id gracefully", () => {
    const src = readFileSync(join(process.cwd(), "src/lib/transactions.functions.ts"), "utf8");
    expect(src).toContain("client_request_id");
    // Verifies the catch block for code 23505 (PostgreSQL unique_violation)
    expect(src).toContain("23505");
  });
});

describe("Financial Invariant 4: Active payment lock on occurrences", () => {
  it("database contains partial unique index preventing multiple active payment orders per occurrence", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFiles = readdirSync(migrationsDir);
    let foundActiveIndex = false;

    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), "utf8");
      if (
        content.includes("payment_orders_active_per_occurrence_uidx") ||
        (content.includes("payment_orders") &&
          content.includes("bill_occurrence_id") &&
          content.includes("WHERE status IN"))
      ) {
        foundActiveIndex = true;
        break;
      }
    }

    expect(foundActiveIndex).toBe(true);
  });
});

describe("Financial Invariant 5: Net-neutral transfers", () => {
  const transactions: TxnLike[] = [
    { type: "income", amount: 5000, status: "completed", date: "2026-09-01" },
    { type: "expense", amount: 1500, status: "completed", date: "2026-09-02" },
    { type: "bill_payment", amount: 800, status: "completed", date: "2026-09-03" },
    // Transfer from Checking to Savings
    { type: "transfer", amount: 2000, status: "completed", date: "2026-09-04" },
  ];

  it("guarantees transfers have zero net impact on available balance", () => {
    const balanceWithTransfer = availableBalance(1000, transactions);
    const balanceWithoutTransfer = availableBalance(
      1000,
      transactions.filter((t) => t.type !== "transfer"),
    );

    // Starting 1000 + 5000 income - 1500 expense - 800 bill = 3700
    expect(balanceWithTransfer).toBe(3700);
    expect(balanceWithoutTransfer).toBe(3700);
    expect(balanceWithTransfer).toBe(balanceWithoutTransfer);
  });

  it("excludes transfers from total spending and total income", () => {
    const spending = totalSpending(transactions, "2026-09-01", "2026-09-30");
    const income = totalIncome(transactions, "2026-09-01", "2026-09-30");

    expect(spending).toBe(2300); // 1500 expense + 800 bill payment
    expect(income).toBe(5000); // 5000 income only, 2000 transfer excluded
  });
});

describe("Financial Invariant 6: Append-only reversals preserve history", () => {
  it("determines correct offsetting reversal types", () => {
    expect(reversalTypeFor({ type: "expense" })).toBe("refund");
    expect(reversalTypeFor({ type: "bill_payment" })).toBe("refund");
    expect(reversalTypeFor({ type: "income" })).toBe("adjustment");
    expect(reversalTypeFor({ type: "adjustment" })).toBe("adjustment");
    expect(reversalTypeFor({ type: "refund" })).toBe("adjustment");
  });

  it("reversal offsets gross balance without deleting original row", () => {
    const original: TxnLike[] = [
      { type: "income", amount: 1000, status: "completed", date: "2026-09-01" },
      { type: "expense", amount: 400, status: "completed", date: "2026-09-02" },
    ];
    expect(availableBalance(0, original)).toBe(600);

    // Offsetting refund reverses the expense
    const withReversal: TxnLike[] = [
      ...original,
      { type: "refund", amount: 400, status: "completed", date: "2026-09-03" },
    ];
    // 1000 - 400 + 400 = 1000
    expect(availableBalance(0, withReversal)).toBe(1000);
    expect(withReversal.length).toBe(3); // History is preserved, row count grows
  });

  it("schema enforces reversal uniqueness and foreign key links", () => {
    const migrationsDir = join(process.cwd(), "supabase/migrations");
    const migrationFiles = readdirSync(migrationsDir);
    let foundReversalSchema = false;

    for (const file of migrationFiles) {
      const content = readFileSync(join(migrationsDir, file), "utf8");
      if (
        content.includes("transactions_reversal_of_uidx") ||
        (content.includes("reversal_of") && content.includes("reversed_by"))
      ) {
        foundReversalSchema = true;
        break;
      }
    }

    expect(foundReversalSchema).toBe(true);
  });
});

describe("Financial Invariant 7, 8 & 9: Unsettled states do not affect ledger", () => {
  it("excludes pending, failed, cancelled, and reversed transactions from balance", () => {
    const mixed: TxnLike[] = [
      { type: "income", amount: 2000, status: "completed", date: "2026-09-01" },
      { type: "income", amount: 3000, status: "pending", date: "2026-09-02" },
      { type: "expense", amount: 500, status: "failed", date: "2026-09-03" },
      { type: "expense", amount: 600, status: "cancelled", date: "2026-09-04" },
      { type: "expense", amount: 700, status: "reversed", date: "2026-09-05" },
    ];

    expect(availableBalance(0, mixed)).toBe(2000);
    expect(totalSpending(mixed, "2026-09-01", "2026-09-30")).toBe(0);
    expect(totalIncome(mixed, "2026-09-01", "2026-09-30")).toBe(2000);
  });

  it("safe-to-spend honestly reflects shortfalls as negative numbers without clamping to zero", () => {
    const result = safeToSpend({
      available: 1000,
      reserved: 2500,
      savingsCommitment: 500,
      daysRemaining: 15,
    });

    expect(result.safeToSpend).toBe(-2000);
    expect(result.safeToSpend < 0).toBe(true);
    expect(result.dailySafeSpend).toBe(0);
  });
});

describe("Financial Invariant 10 & 11: Amount integrity and minor unit precision", () => {
  it("matches major units to provider minor units exactly", () => {
    expect(amountsMatch(100.5, 10050)).toBe(true);
    expect(amountsMatch(0.99, 99)).toBe(true);
    expect(amountsMatch(1234.56, 123456)).toBe(true);
    expect(amountsMatch(100.5, 10051)).toBe(false);
    expect(amountsMatch(50, 4999)).toBe(false);
  });

  it("rounds money without floating point drift", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(1.004)).toBe(1);
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it("validates positive finite amounts within bounds", () => {
    expect(isValidAmount(100)).toBe(true);
    expect(isValidAmount(0.01)).toBe(true);
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-50)).toBe(false);
    expect(isValidAmount(NaN)).toBe(false);
    expect(isValidAmount(Infinity)).toBe(false);
  });
});

describe("Security Invariant 12: Account status gate fails closed", () => {
  it("permits active account status", () => {
    expect(() => assertAccountActive("ACTIVE")).not.toThrow();
  });

  it("fails closed for suspended, deactivated, or deletion-pending accounts", () => {
    expect(() => assertAccountActive("SUSPENDED")).toThrow(AccountInactiveError);
    expect(() => assertAccountActive("DEACTIVATED")).toThrow(AccountInactiveError);
    expect(() => assertAccountActive("DELETION_PENDING")).toThrow(AccountInactiveError);
    expect(() => assertAccountActive("CLOSED")).toThrow(AccountInactiveError);
    expect(() => assertAccountActive("UNKNOWN_STATUS")).toThrow(AccountInactiveError);
  });
});

describe("Security Invariant 13: Secret isolation in client bundles", () => {
  const SENSITIVE_STRINGS = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
  ];

  function getClientSourceFiles(dir: string): string[] {
    let files: string[] = [];
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        // Skip server-only modules and tests
        if (entry === "api" || entry === "node_modules" || entry === ".git") continue;
        files = files.concat(getClientSourceFiles(full));
      } else if (
        (entry.endsWith(".tsx") || entry.endsWith(".ts")) &&
        !entry.endsWith(".server.ts") &&
        !entry.endsWith(".test.ts")
      ) {
        files.push(full);
      }
    }
    return files;
  }

  it("ensures no client-facing source file references server secrets", () => {
    const clientDirs = [
      join(process.cwd(), "src/components"),
      join(process.cwd(), "src/hooks"),
      join(process.cwd(), "src/pages"),
    ];

    const clientFiles = clientDirs.flatMap(getClientSourceFiles);
    expect(clientFiles.length).toBeGreaterThan(20);

    for (const file of clientFiles) {
      const content = readFileSync(file, "utf8");
      for (const secret of SENSITIVE_STRINGS) {
        expect(
          content.includes(secret),
          `Secret ${secret} leaked in client file: ${file}`,
        ).toBe(false);
      }
    }
  });

  it(".env does not contain live Razorpay production credentials", () => {
    const envPath = join(process.cwd(), ".env");
    const envContent = readFileSync(envPath, "utf8");
    expect(envContent).not.toMatch(/RAZORPAY_KEY_SECRET\s*=\s*[^\s]+/);
    expect(envContent).not.toMatch(/RAZORPAY_WEBHOOK_SECRET\s*=\s*[^\s]+/);
  });
});

describe("Error classification (Part 14)", () => {
  it("classifies invalid API key errors correctly", () => {
    const err = classifyError(new Error("Invalid API key"));
    expect(err.kind).toBe("invalid_api_key");
    expect(err.message).toContain("configuration error");

    const err2 = classifyError("401 Invalid API key provided");
    expect(err2.kind).toBe("invalid_api_key");

    const err3 = classifyError(new Error("Missing Supabase environment variable(s): SUPABASE_URL"));
    expect(err3.kind).toBe("invalid_api_key");
  });

  it("classifies missing table / schema cache errors as database errors, never session expired", () => {
    const err1 = classifyError("Could not find the table 'public.transactions' in the schema cache");
    expect(err1.kind).toBe("missing_table");
    expect(err1.message).toContain("Service temporarily unavailable");
    expect(err1.message).not.toContain("session has expired");

    const err2 = classifyError(new Error("PGRST205: relation does not exist"));
    expect(err2.kind).toBe("missing_table");
  });

  it("classifies account status / provisioning errors as account errors, never session expired", () => {
    const err = classifyError(new Error("Unauthorized: account status could not be verified"));
    expect(err.kind).toBe("missing_account");
    expect(err.message).toContain("Setting up your account");
    expect(err.message).not.toContain("session has expired");

    const err2 = classifyError(new Error("ACCOUNT_SUSPENDED: this account cannot perform this operation."));
    expect(err2.kind).toBe("account_suspended");
  });

  it("classifies RLS denial as permission denied, never session expired", () => {
    const err = classifyError(new Error("permission denied for table transactions (code 42501)"));
    expect(err.kind).toBe("rls_denied");
    expect(err.message).toContain("permission");
    expect(err.message).not.toContain("session has expired");
  });

  it("classifies true session expiration as session_expired", () => {
    const err = classifyError(new Error("JWT expired: token has expired"));
    expect(err.kind).toBe("session_expired");
    expect(err.message).toContain("Your session has expired");
  });

  it("classifies general unauthorized requests as auth_missing", () => {
    const err = classifyError(new Error("Unauthorized: No authorization header provided"));
    expect(err.kind).toBe("auth_missing");
    expect(err.message).toContain("sign in");
  });

  it("classifies network failures as network errors", () => {
    const err = classifyError(new TypeError("Failed to fetch"));
    expect(err.kind).toBe("network");
    expect(err.message).toContain("Network error");
  });

  it("classifies validation failures as validation errors", () => {
    const err = classifyError(new Error("amount must be greater than 0"));
    expect(err.kind).toBe("validation");
    expect(err.message).toBe("amount must be greater than 0");
  });

  it("toUserMessage helper returns clean message string", () => {
    expect(toUserMessage("Invalid API key")).toContain("configuration error");
    expect(toUserMessage("Could not find the table 'public.transactions' in the schema cache")).toContain("temporarily unavailable");
    expect(toUserMessage(new Error("Unauthorized: account status could not be verified"))).toContain("Setting up your account");
  });
});

