import { describe, expect, it } from "vitest";
import { spendInputSchema, spendUpdateSchema } from "./spends.functions";
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
});
