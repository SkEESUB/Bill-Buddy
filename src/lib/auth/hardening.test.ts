import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const LIB = join(process.cwd(), "src/lib");
const functionFiles = readdirSync(LIB).filter((f) => f.endsWith(".functions.ts"));

describe("authenticated server functions", () => {
  it("finds the server-function modules", () => {
    expect(functionFiles.length).toBeGreaterThan(5);
  });

  it.each(functionFiles)("%s gates on the active-account middleware", (file: string) => {
    const src = readFileSync(join(LIB, file), "utf8");
    // A bare requireSupabaseAuth proves the token only; it does not stop a
    // suspended or closed account from mutating data.
    expect(src).not.toMatch(/middleware\(\[\s*requireSupabaseAuth/);
    if (/\.middleware\(\[/.test(src)) {
      expect(src).toMatch(/requireActiveAccount/);
    }
  });
});

describe("payment webhook persistence", () => {
  // Columns that actually exist on public.payment_events. Writing anything else
  // makes every delivery fail with PGRST204 and silently blocks settlement.
  const COLUMNS = new Set([
    "id",
    "provider",
    "provider_event_id",
    "event_type",
    "payment_order_id",
    "provider_payment_id",
    "payload",
    "processed",
    "processed_at",
    "process_error",
    "created_at",
  ]);

  it("only writes real payment_events columns", () => {
    const src = readFileSync(
      join(process.cwd(), "src/routes/api/public/payments/webhook.ts"),
      "utf8",
    );
    const blocks = src.split(`from("payment_events")`).slice(1);
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      const body = block.slice(0, block.indexOf("} as never"));
      for (const [, key] of body.matchAll(/^\s{8,}([a-z_]+):/gm)) {
        expect(COLUMNS.has(key ?? ""), `unknown payment_events column: ${key}`).toBe(true);
      }
    }
  });

  it("rejects a delivery without a verified signature before any write", () => {
    const src = readFileSync(
      join(process.cwd(), "src/routes/api/public/payments/webhook.ts"),
      "utf8",
    );
    const verifyAt = src.indexOf("verifyWebhookSignature(raw");
    const writeAt = src.indexOf(`from("payment_events")`);
    expect(verifyAt).toBeGreaterThan(-1);
    expect(verifyAt).toBeLessThan(writeAt);
  });
});

describe("account status gate", () => {
  it("allows an active account", async () => {
    const { assertAccountActive } = await import("./active-account");
    expect(assertAccountActive("ACTIVE")).toBe("ACTIVE");
    expect(assertAccountActive(null)).toBe("ACTIVE");
  });

  it.each(["SUSPENDED", "CLOSED", "PENDING_DELETION", "weird"])(
    "fails closed for %s",
    async (status) => {
      const { assertAccountActive } = await import("./active-account");
      expect(() => assertAccountActive(status)).toThrow(/ACCOUNT_/);
    },
  );
});
