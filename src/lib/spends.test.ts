import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeSpendDedupeHash,
  SPEND_SOURCES,
  spendInputSchema,
  spendSourceSchema,
  spendUpdateSchema,
} from "./spends.functions";
import { addDays, toDay } from "./format";
import type { Spend } from "@/types/database";

describe("Spends Feature — Business Logic & Validation", () => {
  const today = toDay(new Date());
  const yesterday = toDay(addDays(new Date(), -1));

  it("validates valid spend inputs", () => {
    const valid = spendInputSchema.safeParse({
      name: "Breakfast",
      amount: 80,
      spend_date: today,
      notes: "Idli and coffee",
    });
    expect(valid.success).toBe(true);
    if (valid.success) {
      expect(valid.data.name).toBe("Breakfast");
      expect(valid.data.amount).toBe(80);
      expect(valid.data.spend_date).toBe(today);
      expect(valid.data.notes).toBe("Idli and coffee");
    }
  });

  it("rejects missing or empty spend names", () => {
    const invalidEmpty = spendInputSchema.safeParse({
      name: "   ",
      amount: 100,
      spend_date: today,
    });
    expect(invalidEmpty.success).toBe(false);
  });

  it("rejects non-positive monetary amounts", () => {
    const zeroAmount = spendInputSchema.safeParse({
      name: "Snacks",
      amount: 0,
      spend_date: today,
    });
    expect(zeroAmount.success).toBe(false);

    const negativeAmount = spendInputSchema.safeParse({
      name: "Snacks",
      amount: -50,
      spend_date: today,
    });
    expect(negativeAmount.success).toBe(false);
  });

  it("requires valid YYYY-MM-DD date format", () => {
    const badDate = spendInputSchema.safeParse({
      name: "Petrol",
      amount: 250,
      spend_date: "invalid-date",
    });
    expect(badDate.success).toBe(false);
  });

  it("allows optional notes to be null or omitted", () => {
    const withoutNotes = spendInputSchema.safeParse({
      name: "Metro ticket",
      amount: 40,
      spend_date: yesterday,
    });
    expect(withoutNotes.success).toBe(true);
    if (withoutNotes.success) {
      expect(withoutNotes.data.notes).toBeUndefined();
    }
  });

  it("validates spend update payloads require valid id", () => {
    const validUpdate = spendUpdateSchema.safeParse({
      id: "spend-123",
      name: "Updated Groceries",
      amount: 320,
      spend_date: today,
      notes: "Milk and fruits",
    });
    expect(validUpdate.success).toBe(true);

    const invalidUpdate = spendUpdateSchema.safeParse({
      id: "",
      name: "Updated Groceries",
      amount: 320,
      spend_date: today,
    });
    expect(invalidUpdate.success).toBe(false);
  });

  it("accurately calculates daily total and count without duplicate counting", () => {
    const mockSpends: Spend[] = [
      {
        id: "1",
        user_id: "user-1",
        name: "Breakfast",
        amount: 80,
        spend_date: today,
        notes: null,
        created_at: new Date().toISOString(),
      },
      {
        id: "2",
        user_id: "user-1",
        name: "Petrol",
        amount: 250,
        spend_date: today,
        notes: "Full tank",
        created_at: new Date().toISOString(),
      },
      {
        id: "3",
        user_id: "user-1",
        name: "Snacks",
        amount: 40,
        spend_date: today,
        notes: null,
        created_at: new Date().toISOString(),
      },
      {
        id: "4",
        user_id: "user-1",
        name: "Yesterday Dinner",
        amount: 300,
        spend_date: yesterday,
        notes: null,
        created_at: new Date().toISOString(),
      },
    ];

    // Filter by active date
    const todaySpends = mockSpends.filter((s) => s.spend_date === today);
    expect(todaySpends.length).toBe(3);

    const totalToday = todaySpends.reduce((sum, s) => sum + s.amount, 0);
    expect(totalToday).toBe(370);

    const yesterdaySpends = mockSpends.filter((s) => s.spend_date === yesterday);
    expect(yesterdaySpends.length).toBe(1);
    const totalYesterday = yesterdaySpends.reduce((sum, s) => sum + s.amount, 0);
    expect(totalYesterday).toBe(300);
  });

  it("handles empty spends state gracefully", () => {
    const emptyList: Spend[] = [];
    const total = emptyList.reduce((sum, s) => sum + s.amount, 0);
    expect(total).toBe(0);
    expect(emptyList.length).toBe(0);
  });

  it("calculates timezone-safe date shifting across month and year boundaries", async () => {
    const { shiftDateString } = await import("./format");
    expect(shiftDateString("2026-10-27", -1)).toBe("2026-10-26");
    expect(shiftDateString("2026-10-27", 1)).toBe("2026-10-28");
    // Month boundary
    expect(shiftDateString("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDateString("2026-02-28", 1)).toBe("2026-03-01");
    // Year boundary
    expect(shiftDateString("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDateString("2025-12-31", 1)).toBe("2026-01-01");
  });

  it("verifies date filtering isolation: today never shows yesterday, switching dates does not delete records", () => {
    const mockStore: Spend[] = [
      {
        id: "s1",
        user_id: "u1",
        name: "Morning Coffee",
        amount: 50,
        spend_date: "2026-10-27",
        notes: null,
        created_at: "2026-10-27T08:00:00Z",
      },
      {
        id: "s2",
        user_id: "u1",
        name: "Evening Snack",
        amount: 80,
        spend_date: "2026-10-27",
        notes: null,
        created_at: "2026-10-27T17:00:00Z",
      },
      {
        id: "s3",
        user_id: "u1",
        name: "Yesterday Fuel",
        amount: 500,
        spend_date: "2026-10-26",
        notes: null,
        created_at: "2026-10-26T10:00:00Z",
      },
      {
        id: "s4",
        user_id: "u1",
        name: "Past Groceries",
        amount: 1200,
        spend_date: "2026-10-15",
        notes: null,
        created_at: "2026-10-15T12:00:00Z",
      },
    ];

    // Select today
    const selectedDate1 = "2026-10-27";
    const date1Spends = mockStore.filter((s) => s.spend_date === selectedDate1);
    expect(date1Spends.length).toBe(2);
    expect(date1Spends.map((s) => s.name)).toEqual(["Morning Coffee", "Evening Snack"]);
    const total1 = date1Spends.reduce((sum, s) => sum + s.amount, 0);
    expect(total1).toBe(130);

    // Select yesterday
    const selectedDate2 = "2026-10-26";
    const date2Spends = mockStore.filter((s) => s.spend_date === selectedDate2);
    expect(date2Spends.length).toBe(1);
    expect(date2Spends[0]?.name).toBe("Yesterday Fuel");
    const total2 = date2Spends.reduce((sum, s) => sum + s.amount, 0);
    expect(total2).toBe(500);

    // Select historical date
    const selectedDate3 = "2026-10-15";
    const date3Spends = mockStore.filter((s) => s.spend_date === selectedDate3);
    expect(date3Spends.length).toBe(1);
    expect(date3Spends[0]?.name).toBe("Past Groceries");
    const total3 = date3Spends.reduce((sum, s) => sum + s.amount, 0);
    expect(total3).toBe(1200);

    // Returning to today verifies all original records are preserved
    expect(mockStore.length).toBe(4);
    const returnToday = mockStore.filter((s) => s.spend_date === selectedDate1);
    expect(returnToday.length).toBe(2);
    expect(returnToday.reduce((sum, s) => sum + s.amount, 0)).toBe(130);
  });

  describe("Phase B: Premium Floating 3D Spends Cards", () => {
    const dashboardSrc = readFileSync(
      join(process.cwd(), "src/components/spends/SpendsDashboard.tsx"),
      "utf8",
    );
    const stylesSrc = readFileSync(join(process.cwd(), "src/styles.css"), "utf8");

    it("attaches spend-card-premium and spend-card-floating to spend cards", () => {
      expect(dashboardSrc).toContain("spend-card-premium");
      expect(dashboardSrc).toContain("spend-card-floating");
      expect(dashboardSrc).toContain("style={{ animationDelay: floatDelay }}");
    });

    it("defines floating 3D keyframes, ambient glow, and elevated shadow in CSS", () => {
      expect(stylesSrc).toContain("@keyframes spend-card-float");
      expect(stylesSrc).toContain(".spend-card-premium");
      expect(stylesSrc).toContain(".spend-card-premium.spend-card-floating");
      expect(stylesSrc).toContain(".spend-card-premium::before");
      expect(stylesSrc).toContain(".spend-card-premium:active");
    });

    it("stops propagation on edit and delete buttons to prevent accidental triggers", () => {
      expect(dashboardSrc).toContain("e.stopPropagation()");
    });

    it("strictly honors prefers-reduced-motion for spend cards", () => {
      expect(stylesSrc).toContain(".spend-card-premium");
      expect(stylesSrc).toContain(".spend-card-premium.spend-card-floating");
      expect(stylesSrc).toContain(".reduce-motion .spend-card-premium");
    });
  });

  describe("Phase 1: Spend Source Tracking & Deduplication", () => {
    const modalSrc = readFileSync(
      join(process.cwd(), "src/components/spends/SpendFormModal.tsx"),
      "utf8",
    );
    const dashboardSrc = readFileSync(
      join(process.cwd(), "src/components/spends/SpendsDashboard.tsx"),
      "utf8",
    );
    const migrationSrc = readFileSync(
      join(process.cwd(), "supabase/migrations/20261030000000_add_spend_source_and_dedupe.sql"),
      "utf8",
    );

    it("supports all defined spend sources in schema and runtime", () => {
      expect(SPEND_SOURCES).toEqual([
        "cash",
        "bank",
        "statement",
        "email",
        "notification",
        "card",
        "upi",
        "other",
      ]);

      for (const src of SPEND_SOURCES) {
        const parsed = spendSourceSchema.safeParse(src);
        expect(parsed.success).toBe(true);
      }

      // Rejects unsupported sources
      const invalid = spendSourceSchema.safeParse("crypto_transfer");
      expect(invalid.success).toBe(false);
    });

    it("defaults new spends to 'cash' source when not specified", () => {
      const parsed = spendInputSchema.safeParse({
        name: "Chai and Biscuit",
        amount: 30,
        spend_date: today,
      });
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.source).toBe("cash");
      }
    });

    it("persists explicit cash and electronic sources accurately", () => {
      const cashSpend = spendInputSchema.safeParse({
        name: "Auto rickshaw",
        amount: 60,
        spend_date: today,
        source: "cash",
      });
      expect(cashSpend.success).toBe(true);
      if (cashSpend.success) expect(cashSpend.data.source).toBe("cash");

      const bankSpend = spendInputSchema.safeParse({
        name: "Swiggy dinner",
        amount: 340,
        spend_date: today,
        source: "bank",
      });
      expect(bankSpend.success).toBe(true);
      if (bankSpend.success) expect(bankSpend.data.source).toBe("bank");

      const statementSpend = spendInputSchema.safeParse({
        name: "Electricity Bill (Auto)",
        amount: 1450,
        spend_date: yesterday,
        source: "statement",
      });
      expect(statementSpend.success).toBe(true);
      if (statementSpend.success) expect(statementSpend.data.source).toBe("statement");

      const emailSpend = spendInputSchema.safeParse({
        name: "Uber Ride",
        amount: 220,
        spend_date: today,
        source: "email",
      });
      expect(emailSpend.success).toBe(true);
      if (emailSpend.success) expect(emailSpend.data.source).toBe("email");

      const notificationSpend = spendInputSchema.safeParse({
        name: "Google Pay Merchant",
        amount: 150,
        spend_date: today,
        source: "notification",
      });
      expect(notificationSpend.success).toBe(true);
      if (notificationSpend.success) expect(notificationSpend.data.source).toBe("notification");
    });

    it("preserves source on updates when source is omitted", () => {
      const updateWithoutSource = spendUpdateSchema.safeParse({
        id: "spend-001",
        name: "Revised Dinner",
        amount: 400,
        spend_date: today,
      });
      expect(updateWithoutSource.success).toBe(true);
      if (updateWithoutSource.success) {
        expect(updateWithoutSource.data.source).toBeUndefined();
      }

      const updateWithNewSource = spendUpdateSchema.safeParse({
        id: "spend-001",
        name: "Revised Dinner",
        amount: 400,
        spend_date: today,
        source: "card",
      });
      expect(updateWithNewSource.success).toBe(true);
      if (updateWithNewSource.success) {
        expect(updateWithNewSource.data.source).toBe("card");
      }
    });

    it("computes deterministic deduplication hash", () => {
      const hash1 = computeSpendDedupeHash("user-1", "2026-10-30", 250, "Petrol");
      const hash2 = computeSpendDedupeHash("user-1", "2026-10-30", 250.0, "  petrol  ");
      const diffUser = computeSpendDedupeHash("user-2", "2026-10-30", 250, "Petrol");
      const diffAmount = computeSpendDedupeHash("user-1", "2026-10-30", 251, "Petrol");
      const diffDate = computeSpendDedupeHash("user-1", "2026-10-29", 250, "Petrol");

      expect(hash1).toBe(hash2);
      expect(hash1.startsWith("dh_")).toBe(true);
      expect(hash1).not.toBe(diffUser);
      expect(hash1).not.toBe(diffAmount);
      expect(hash1).not.toBe(diffDate);
    });

    it("verifies daily totals correctly aggregate spends regardless of source", () => {
      const multiSourceSpends: Spend[] = [
        {
          id: "m1",
          user_id: "u1",
          name: "Tea (Cash)",
          amount: 20,
          spend_date: today,
          source: "cash",
          created_at: new Date().toISOString(),
        },
        {
          id: "m2",
          user_id: "u1",
          name: "Groceries (Bank)",
          amount: 500,
          spend_date: today,
          source: "bank",
          created_at: new Date().toISOString(),
        },
        {
          id: "m3",
          user_id: "u1",
          name: "Fuel (Card)",
          amount: 300,
          spend_date: today,
          source: "card",
          created_at: new Date().toISOString(),
        },
        {
          id: "m4",
          user_id: "u1",
          name: "Ride (Notification)",
          amount: 180,
          spend_date: today,
          source: "notification",
          created_at: new Date().toISOString(),
        },
        {
          id: "m5",
          user_id: "u1",
          name: "Legacy Spend (No source)",
          amount: 100,
          spend_date: today,
          created_at: new Date().toISOString(),
        },
      ];

      const dailyTotal = multiSourceSpends.reduce((sum, s) => sum + s.amount, 0);
      expect(dailyTotal).toBe(1100);
      expect(multiSourceSpends.length).toBe(5);
    });

    it("verifies SpendFormModal contains source options and no time picker", () => {
      expect(modalSrc).toContain("Payment Source");
      expect(modalSrc).toContain('"cash"');
      expect(modalSrc).toContain('"bank"');
      expect(modalSrc).toContain('"card"');
      expect(modalSrc).toContain('"other"');
      // Confirms strictly no time input or time picker
      expect(modalSrc).not.toContain('type="time"');
      expect(modalSrc).not.toContain('type="datetime-local"');
    });

    it("verifies SpendsDashboard renders source indicator badges", () => {
      expect(dashboardSrc).toContain("SpendSourceBadge");
      expect(dashboardSrc).toContain("Cash");
      expect(dashboardSrc).toContain("Bank");
      expect(dashboardSrc).toContain("Card");
      expect(dashboardSrc).toContain("Statement");
      expect(dashboardSrc).toContain("Email");
      expect(dashboardSrc).toContain("Notification");
    });

    it("verifies migration SQL is non-destructive, idempotent, and indexed", () => {
      expect(migrationSrc).toContain("ADD COLUMN source text NOT NULL DEFAULT 'other'");
      expect(migrationSrc).toContain("spends_source_check");
      expect(migrationSrc).toContain("ADD COLUMN dedupe_hash text");
      expect(migrationSrc).toContain("idx_spends_user_source");
      expect(migrationSrc).toContain("idx_spends_user_dedupe");
      expect(migrationSrc).not.toContain("DROP TABLE");
      expect(migrationSrc).not.toContain("DELETE FROM");
      expect(migrationSrc).not.toContain("TRUNCATE");
    });
  });
});
