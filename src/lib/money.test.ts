import { describe, expect, it } from "vitest";
import {
  addMonthsClamped,
  availableBalance,
  budgetProgress,
  daysBetween,
  daysRemainingInMonth,
  deriveOccurrenceStatus,
  monthlyEquivalent,
  nextOccurrenceDate,
  occurrenceDatesThrough,
  percentChange,
  projectBalance,
  round2,
  safeToSpend,
  spendingByCategory,
  totalIncome,
  totalSpending,
  upcomingObligations,
  type TxnLike,
} from "./money";

describe("date maths", () => {
  it("clamps month-end rollovers", () => {
    expect(addMonthsClamped("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsClamped("2024-01-31", 1)).toBe("2024-02-29");
    expect(addMonthsClamped("2026-01-31", 3)).toBe("2026-04-30");
    expect(addMonthsClamped("2026-12-15", 1)).toBe("2027-01-15");
  });

  it("counts whole days in both directions", () => {
    expect(daysBetween("2026-03-01", "2026-03-04")).toBe(3);
    expect(daysBetween("2026-03-04", "2026-03-01")).toBe(-3);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });

  it("counts days remaining in a month inclusively", () => {
    expect(daysRemainingInMonth("2026-03-31")).toBe(1);
    expect(daysRemainingInMonth("2026-02-01")).toBe(28);
  });
});

describe("recurrence", () => {
  it("computes the next date per repeat type", () => {
    expect(nextOccurrenceDate("2026-03-10", { repeat_type: "weekly" })).toBe("2026-03-17");
    expect(nextOccurrenceDate("2026-03-10", { repeat_type: "monthly" })).toBe("2026-04-10");
    expect(nextOccurrenceDate("2026-03-10", { repeat_type: "quarterly" })).toBe("2026-06-10");
    expect(nextOccurrenceDate("2026-03-10", { repeat_type: "yearly" })).toBe("2027-03-10");
    expect(nextOccurrenceDate("2026-03-10", { repeat_type: "custom", repeat_interval: 10 })).toBe(
      "2026-03-20",
    );
    expect(nextOccurrenceDate("2026-03-10", { repeat_type: "none" })).toBeNull();
  });

  it("stops at the series end date", () => {
    expect(
      nextOccurrenceDate("2026-03-10", {
        repeat_type: "monthly",
        repeat_end_date: "2026-03-31",
      }),
    ).toBeNull();
  });

  it("generates the full schedule through a horizon", () => {
    const dates = occurrenceDatesThrough("2026-01-31", "2026-05-01", {
      repeat_type: "monthly",
    });
    expect(dates).toEqual(["2026-01-31", "2026-02-28", "2026-03-28", "2026-04-28"]);
  });

  it("returns a single date for non-recurring bills", () => {
    expect(occurrenceDatesThrough("2026-01-05", "2027-01-05", { repeat_type: "none" })).toEqual([
      "2026-01-05",
    ]);
  });

  it("never loops unbounded", () => {
    const dates = occurrenceDatesThrough("2020-01-01", "2999-01-01", {
      repeat_type: "custom",
      repeat_interval: 1,
    });
    expect(dates.length).toBe(120);
  });
});

describe("occurrence status", () => {
  const today = "2026-03-10";
  it("derives clock-based statuses", () => {
    expect(deriveOccurrenceStatus("upcoming", "2026-03-09", today)).toBe("overdue");
    expect(deriveOccurrenceStatus("upcoming", "2026-03-10", today)).toBe("due_today");
    expect(deriveOccurrenceStatus("upcoming", "2026-03-12", today)).toBe("due_soon");
    expect(deriveOccurrenceStatus("upcoming", "2026-03-30", today)).toBe("upcoming");
  });

  it("never overrides settled or in-flight states", () => {
    expect(deriveOccurrenceStatus("paid", "2026-01-01", today)).toBe("paid");
    expect(deriveOccurrenceStatus("skipped", "2026-01-01", today)).toBe("skipped");
    expect(deriveOccurrenceStatus("payment_pending", "2026-01-01", today)).toBe("payment_pending");
  });
});

describe("balances", () => {
  const txns: TxnLike[] = [
    { type: "income", amount: 50000, date: "2026-03-01" },
    { type: "expense", amount: 1200.5, date: "2026-03-02", category: "Food" },
    { type: "bill_payment", amount: 2000, date: "2026-03-03", category: "Utilities" },
    { type: "transfer", amount: 10000, date: "2026-03-04" },
    { type: "refund", amount: 200.5, date: "2026-03-05" },
    { type: "expense", amount: 999, date: "2026-03-06", status: "pending" },
  ];

  it("ignores transfers and unsettled rows", () => {
    expect(availableBalance(1000, txns)).toBe(48000);
  });

  it("separates spending from income", () => {
    expect(totalSpending(txns)).toBe(3200.5);
    expect(totalIncome(txns)).toBe(50200.5);
  });

  it("filters by period", () => {
    expect(totalSpending(txns, "2026-03-03", "2026-03-31")).toBe(2000);
  });

  it("groups spending by category, largest first", () => {
    expect(spendingByCategory(txns)).toEqual([
      { category: "Utilities", amount: 2000 },
      { category: "Food", amount: 1200.5 },
    ]);
  });
});

describe("obligations and safe-to-spend", () => {
  const occurrences = [
    { scheduled_date: "2026-03-01", expected_amount: 500, status: "overdue" as const },
    { scheduled_date: "2026-03-12", expected_amount: 1500, status: "upcoming" as const },
    { scheduled_date: "2026-03-20", expected_amount: 800, status: "paid" as const },
    { scheduled_date: "2026-04-12", expected_amount: 1500, status: "upcoming" as const },
  ];

  it("counts unpaid obligations including overdue ones", () => {
    expect(upcomingObligations(occurrences, "2026-03-10", "2026-03-31")).toBe(2000);
  });

  it("prefers the actual amount when one was recorded", () => {
    expect(
      upcomingObligations(
        [
          {
            scheduled_date: "2026-03-12",
            expected_amount: 1500,
            actual_amount: 1620,
            status: "upcoming",
          },
        ],
        "2026-03-10",
      ),
    ).toBe(1620);
  });

  it("reports a shortfall rather than clamping", () => {
    const result = safeToSpend({
      available: 1000,
      reserved: 2500,
      savingsCommitment: 0,
      daysRemaining: 10,
    });
    expect(result.safeToSpend).toBe(-1500);
    expect(result.dailySafeSpend).toBe(0);
  });

  it("spreads a surplus across the remaining days", () => {
    const result = safeToSpend({
      available: 10000,
      reserved: 2000,
      savingsCommitment: 3000,
      daysRemaining: 10,
    });
    expect(result.safeToSpend).toBe(5000);
    expect(result.dailySafeSpend).toBe(500);
  });
});

describe("budgets", () => {
  it("classifies budget health", () => {
    expect(budgetProgress(1000, 100).status).toBe("healthy");
    expect(budgetProgress(1000, 600).status).toBe("warning");
    expect(budgetProgress(1000, 850).status).toBe("near_limit");
    expect(budgetProgress(1000, 1200).status).toBe("over_budget");
  });

  it("reports remaining and percentage", () => {
    const p = budgetProgress(2000, 1500);
    expect(p.remaining).toBe(500);
    expect(p.percentageUsed).toBe(75);
  });

  it("handles a zero budget without dividing by zero", () => {
    expect(budgetProgress(0, 500).percentageUsed).toBe(0);
  });
});

describe("insights", () => {
  it("normalises recurring cost to a monthly figure", () => {
    expect(monthlyEquivalent(1200, { repeat_type: "yearly" })).toBe(100);
    expect(monthlyEquivalent(300, { repeat_type: "quarterly" })).toBe(100);
    expect(monthlyEquivalent(100, { repeat_type: "monthly" })).toBe(100);
    expect(monthlyEquivalent(100, { repeat_type: "none" })).toBe(0);
  });

  it("returns null percent change without a baseline", () => {
    expect(percentChange(0, 500)).toBeNull();
    expect(percentChange(200, 250)).toBe(25);
  });

  it("projects balance in a straight line", () => {
    expect(
      projectBalance({
        available: 10000,
        monthlyIncome: 50000,
        obligations: 8000,
        monthsAhead: 2,
        monthlyRecurringSpend: 30000,
      }),
    ).toBe(42000);
  });

  it("rounds money to two places", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });
});
