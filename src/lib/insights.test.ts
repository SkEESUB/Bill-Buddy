import { describe, expect, it } from "vitest";
import {
  budgetHistory,
  categorySpend,
  currentCycle,
  evaluateBudget,
  type BudgetRecord,
} from "./budgets";
import {
  buildInsights,
  cashFlow,
  categoryInsights,
  comparePeriods,
  emptyStateHints,
  forecast,
  obligationSummary,
  previousRange,
  recurringCommitments,
  resolveInsightRange,
  safeToSpendSummary,
} from "./insights";
import { monthlyEquivalent, type ObligationLike, type TxnLike } from "./money";

const txn = (over: Partial<TxnLike> & { amount: number; date: string }): TxnLike => ({
  type: "expense",
  status: "completed",
  category: "food",
  ...over,
});

const budget = (over: Partial<BudgetRecord> = {}): BudgetRecord => ({
  id: "b1",
  name: "Food",
  category: "food",
  amount: 5000,
  period: "monthly",
  start_date: "2026-01-01",
  end_date: null,
  is_active: true,
  status: "active",
  warn_threshold: 50,
  near_limit_threshold: 80,
  ...over,
});

describe("budget calculation", () => {
  it("reports zero spending cleanly", () => {
    const result = evaluateBudget(budget(), [], "2026-03-10");
    expect(result.progress.spent).toBe(0);
    expect(result.progress.remaining).toBe(5000);
    expect(result.progress.percentageUsed).toBe(0);
    expect(result.progress.status).toBe("healthy");
  });

  it("hits the warning threshold at 50%", () => {
    const result = evaluateBudget(budget(), [txn({ amount: 2500, date: "2026-03-05" })], "2026-03-10");
    expect(result.progress.percentageUsed).toBe(50);
    expect(result.progress.status).toBe("warning");
  });

  it("hits near-limit at 80%", () => {
    const result = evaluateBudget(budget(), [txn({ amount: 4000, date: "2026-03-05" })], "2026-03-10");
    expect(result.progress.percentageUsed).toBe(80);
    expect(result.progress.status).toBe("near_limit");
  });

  it("is over budget at exactly 100%", () => {
    const result = evaluateBudget(budget(), [txn({ amount: 5000, date: "2026-03-05" })], "2026-03-10");
    expect(result.progress.status).toBe("over_budget");
    expect(result.progress.remaining).toBe(0);
  });

  it("reports the overspend amount", () => {
    const result = evaluateBudget(budget(), [txn({ amount: 6000, date: "2026-03-05" })], "2026-03-10");
    expect(result.progress.remaining).toBe(-1000);
    expect(result.progress.percentageUsed).toBe(120);
  });

  it("honours custom thresholds from the record", () => {
    const result = evaluateBudget(
      budget({ warn_threshold: 30, near_limit_threshold: 60 }),
      [txn({ amount: 1750, date: "2026-03-05" })],
      "2026-03-10",
    );
    expect(result.progress.percentageUsed).toBe(35);
    expect(result.progress.status).toBe("warning");
  });

  it("nets refunds out of spending", () => {
    const rows = [
      txn({ amount: 1000, date: "2026-03-02" }),
      txn({ amount: 1000, date: "2026-03-03", type: "refund" }),
    ];
    expect(categorySpend(rows, "food", "2026-03-01", "2026-03-31").net).toBe(0);
  });

  it("reflects a reversal (original stays, offsetting refund subtracts)", () => {
    const rows = [
      txn({ amount: 1200, date: "2026-03-02" }),
      txn({ amount: 1000, date: "2026-03-04" }),
      txn({ amount: 1000, date: "2026-03-04", type: "refund" }),
    ];
    expect(evaluateBudget(budget(), rows, "2026-03-10").progress.spent).toBe(1200);
  });

  it("ignores income, transfers, adjustments and unsettled rows", () => {
    const rows = [
      txn({ amount: 900, date: "2026-03-02", type: "income" }),
      txn({ amount: 900, date: "2026-03-02", type: "transfer" }),
      txn({ amount: 900, date: "2026-03-02", type: "adjustment" }),
      txn({ amount: 900, date: "2026-03-02", status: "pending" }),
      txn({ amount: 900, date: "2026-03-02", status: "failed" }),
      txn({ amount: 900, date: "2026-03-02", status: "cancelled" }),
      txn({ amount: 900, date: "2026-03-02", status: "reversed" }),
    ];
    expect(evaluateBudget(budget(), rows, "2026-03-10").progress.spent).toBe(0);
  });

  it("ignores other categories", () => {
    const rows = [txn({ amount: 800, date: "2026-03-02", category: "transport" })];
    expect(evaluateBudget(budget(), rows, "2026-03-10").progress.spent).toBe(0);
  });

  it("sums multiple decimal transactions on the same day", () => {
    const rows = [
      txn({ amount: 10.55, date: "2026-03-02" }),
      txn({ amount: 20.45, date: "2026-03-02" }),
    ];
    expect(evaluateBudget(budget(), rows, "2026-03-10").progress.spent).toBe(31);
  });

  it("respects month boundaries", () => {
    const rows = [
      txn({ amount: 500, date: "2026-02-28" }),
      txn({ amount: 700, date: "2026-03-01" }),
      txn({ amount: 300, date: "2026-04-01" }),
    ];
    expect(evaluateBudget(budget(), rows, "2026-03-15").progress.spent).toBe(700);
  });

  it("handles leap-year February cycles", () => {
    const cycle = currentCycle(budget({ start_date: "2024-01-31" }), "2024-02-15");
    expect(cycle).toEqual({ start: "2024-01-31", end: "2024-02-28" });
    expect(currentCycle(budget({ start_date: "2024-02-01" }), "2024-02-15").end).toBe("2024-02-29");
  });

  it("handles weekly, quarterly and yearly cycles", () => {
    expect(currentCycle(budget({ period: "weekly", start_date: "2026-03-02" }), "2026-03-10")).toEqual({
      start: "2026-03-09",
      end: "2026-03-15",
    });
    expect(
      currentCycle(budget({ period: "quarterly", start_date: "2026-01-01" }), "2026-05-04"),
    ).toEqual({ start: "2026-04-01", end: "2026-06-30" });
    expect(currentCycle(budget({ period: "yearly", start_date: "2025-06-01" }), "2026-05-04")).toEqual({
      start: "2025-06-01",
      end: "2026-05-31",
    });
  });

  it("treats a custom range as a single cycle", () => {
    const record = budget({ period: "custom", start_date: "2026-03-05", end_date: "2026-03-20" });
    expect(currentCycle(record, "2026-03-10")).toEqual({ start: "2026-03-05", end: "2026-03-20" });
    const rows = [
      txn({ amount: 100, date: "2026-03-04" }),
      txn({ amount: 200, date: "2026-03-06" }),
      txn({ amount: 300, date: "2026-03-21" }),
    ];
    expect(evaluateBudget(record, rows, "2026-03-10").progress.spent).toBe(200);
  });

  it("drops a deleted transaction from spending", () => {
    const rows = [txn({ amount: 400, date: "2026-03-02" }), txn({ amount: 600, date: "2026-03-03" })];
    expect(evaluateBudget(budget(), rows, "2026-03-10").progress.spent).toBe(1000);
    expect(evaluateBudget(budget(), rows.slice(0, 1), "2026-03-10").progress.spent).toBe(400);
  });

  it("builds per-cycle history without NaN", () => {
    const rows = [txn({ amount: 1000, date: "2026-02-10" }), txn({ amount: 500, date: "2026-03-10" })];
    const history = budgetHistory(budget(), rows, "2026-03-15", 3);
    expect(history[0]?.progress.spent).toBe(500);
    expect(history[1]?.progress.spent).toBe(1000);
    for (const entry of history) expect(Number.isFinite(entry.progress.percentageUsed)).toBe(true);
  });

  it("never divides by zero on the last day of a cycle", () => {
    const result = evaluateBudget(budget(), [txn({ amount: 1000, date: "2026-03-01" })], "2026-03-31");
    expect(result.daysRemaining).toBe(1);
    expect(Number.isFinite(result.dailyAllowance)).toBe(true);
  });
});

describe("cash flow", () => {
  const rows = [
    txn({ amount: 50000, date: "2026-03-01", type: "income", category: "salary" }),
    txn({ amount: 2000, date: "2026-03-02" }),
    txn({ amount: 3000, date: "2026-03-03", type: "bill_payment", category: "rent" }),
    txn({ amount: 5000, date: "2026-03-04", type: "transfer", category: "cash" }),
    txn({ amount: 1000, date: "2026-03-05", type: "refund" }),
    txn({ amount: 9999, date: "2026-03-06", status: "pending" }),
    txn({ amount: 8888, date: "2026-03-07", status: "failed" }),
    txn({ amount: 7777, date: "2026-03-08", status: "cancelled" }),
  ];

  it("nets completed inflows against completed outflows", () => {
    const flow = cashFlow(rows, "2026-03-01", "2026-03-31");
    expect(flow.income).toBe(50000);
    expect(flow.expenses).toBe(2000);
    expect(flow.billPayments).toBe(3000);
    expect(flow.refunds).toBe(1000);
    expect(flow.net).toBe(46000);
  });

  it("keeps transfers net-neutral", () => {
    const transferOnly = [txn({ amount: 5000, date: "2026-03-04", type: "transfer" })];
    const flow = cashFlow(transferOnly, "2026-03-01", "2026-03-31");
    expect(flow.transfers).toBe(5000);
    expect(flow.net).toBe(0);
  });

  it("excludes rows outside the window", () => {
    expect(cashFlow(rows, "2026-04-01", "2026-04-30").net).toBe(0);
  });
});

describe("category analysis", () => {
  const rows = [
    txn({ amount: 5200, date: "2026-03-02", category: "food" }),
    txn({ amount: 2100, date: "2026-03-03", category: "transport" }),
    txn({ amount: 1800, date: "2026-03-04", category: "shopping" }),
    txn({ amount: 5000, date: "2026-03-05", category: "cash", type: "transfer" }),
    txn({ amount: 4000, date: "2026-02-10", category: "food" }),
  ];

  it("ranks real spending and computes shares plus change", () => {
    const result = categoryInsights(
      rows,
      { from: "2026-03-01", to: "2026-03-31" },
      { from: "2026-02-01", to: "2026-02-28" },
    );
    expect(result.map((r) => r.category)).toEqual(["food", "transport", "shopping"]);
    expect(result[0]?.amount).toBe(5200);
    expect(result[0]?.change).toBe(1200);
    expect(result[0]?.changePercent).toBe(30);
    expect(result.reduce((s, r) => s + r.share, 0)).toBeCloseTo(100, 1);
  });

  it("returns only categories that exist", () => {
    expect(categoryInsights([], { from: "2026-03-01", to: "2026-03-31" })).toEqual([]);
  });
});

describe("period comparison", () => {
  it("compares real months", () => {
    const rows = [
      txn({ amount: 4000, date: "2026-03-05" }),
      txn({ amount: 1660, date: "2026-02-05" }),
      txn({ amount: 10800, date: "2026-03-01", type: "income", category: "salary" }),
      txn({ amount: 10000, date: "2026-02-01", type: "income", category: "salary" }),
    ];
    const result = comparePeriods(
      rows,
      { from: "2026-03-01", to: "2026-03-31" },
      { from: "2026-02-01", to: "2026-02-28" },
    );
    expect(result.spendingChange).toBe(2340);
    expect(result.incomePercent).toBe(8);
    expect(result.reliable).toBe(true);
  });

  it("flags an unreliable comparison when the base window is empty", () => {
    const result = comparePeriods(
      [txn({ amount: 100, date: "2026-03-05" })],
      { from: "2026-03-01", to: "2026-03-31" },
      { from: "2026-02-01", to: "2026-02-28" },
    );
    expect(result.reliable).toBe(false);
    expect(result.spendingPercent).toBeNull();
  });

  it("derives an equally long previous window", () => {
    expect(previousRange({ from: "2026-03-01", to: "2026-03-31" })).toEqual({
      from: "2026-01-29",
      to: "2026-02-28",
    });
    expect(resolveInsightRange("last_month", "2026-03-10")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
  });
});

describe("recurring commitments", () => {
  it("normalises every recurrence to a monthly equivalent", () => {
    expect(monthlyEquivalent(1000, { repeat_type: "monthly" })).toBe(1000);
    expect(monthlyEquivalent(3000, { repeat_type: "quarterly" })).toBe(1000);
    expect(monthlyEquivalent(12000, { repeat_type: "yearly" })).toBe(1000);

    const result = recurringCommitments(
      [
        { id: "1", title: "Rent", category: "rent", amount: 1000, repeat_type: "monthly" },
        { id: "2", title: "Water", category: "water", amount: 3000, repeat_type: "quarterly" },
        { id: "3", title: "Insurance", category: "insurance", amount: 12000, repeat_type: "yearly" },
        { id: "4", title: "One-off", category: "other", amount: 5000, repeat_type: "none" },
        { id: "5", title: "Ended", category: "other", amount: 900, repeat_type: "monthly", repeat_end_date: "2025-01-01" },
        { id: "6", title: "Paused", category: "other", amount: 900, repeat_type: "monthly", is_active: false },
      ],
      "2026-03-10",
    );
    expect(result.total).toBe(3000);
    expect(result.items).toHaveLength(3);
  });
});

describe("upcoming obligations", () => {
  const occ = (date: string, amount: number, status = "upcoming"): ObligationLike => ({
    scheduled_date: date,
    expected_amount: amount,
    actual_amount: null,
    status: status as ObligationLike["status"],
  });

  it("buckets overdue, today, 7 and 30 days", () => {
    const summary = obligationSummary(
      [
        occ("2026-03-01", 1200),
        occ("2026-03-10", 800),
        occ("2026-03-14", 2500),
        occ("2026-03-28", 4000),
        occ("2026-05-01", 900),
        occ("2026-03-11", 5000, "paid"),
      ],
      "2026-03-10",
    );
    expect(summary.overdue).toEqual({ amount: 1200, count: 1 });
    expect(summary.dueToday).toEqual({ amount: 800, count: 1 });
    expect(summary.next7).toEqual({ amount: 3300, count: 2 });
    expect(summary.next30.amount).toBe(7300);
    expect(summary.highest).toBe(4000);
  });

  it("returns zeros with no occurrences", () => {
    const summary = obligationSummary([], "2026-03-10");
    expect(summary.all).toBe(0);
    expect(summary.highest).toBe(0);
  });
});

describe("safe to spend", () => {
  it("reports a positive safe amount and a daily allowance", () => {
    const safe = safeToSpendSummary({ available: 20000, reserved: 5000, today: "2026-03-16" });
    expect(safe.amount).toBe(15000);
    expect(safe.isShortfall).toBe(false);
    expect(safe.daysRemaining).toBe(16);
    expect(safe.perDay).toBe(937.5);
  });

  it("reports a shortfall instead of clamping to zero", () => {
    const safe = safeToSpendSummary({ available: 5000, reserved: 7300, today: "2026-03-16" });
    expect(safe.amount).toBe(-2300);
    expect(safe.isShortfall).toBe(true);
    expect(safe.shortfall).toBe(2300);
    expect(safe.perDay).toBe(0);
  });

  it("never produces Infinity or NaN at period edges", () => {
    for (const day of ["2026-03-01", "2026-03-31", "2026-02-29"]) {
      const safe = safeToSpendSummary({ available: 1000, reserved: 0, today: day });
      expect(Number.isFinite(safe.perDay)).toBe(true);
      expect(safe.daysRemaining).toBeGreaterThan(0);
    }
    const zeroDays = safeToSpendSummary({
      available: 1000,
      reserved: 0,
      today: "2026-03-31",
      daysRemaining: 0,
    });
    expect(Number.isFinite(zeroDays.perDay)).toBe(true);
  });
});

describe("forecast", () => {
  const march = (amount: number, date: string, type: TxnLike["type"] = "expense") =>
    txn({ amount, date, type });

  it("returns no scenarios with zero history", () => {
    const result = forecast({ transactions: [], available: 1000, today: "2026-03-10", obligations: 0 });
    expect(result.sufficient).toBe(false);
    expect(result.scenarios).toEqual([]);
  });

  it("projects a straight line from one month of history", () => {
    const result = forecast({
      transactions: [march(5000, "2026-03-02"), march(20000, "2026-03-01", "income")],
      available: 20000,
      today: "2026-03-10",
      obligations: 0,
    });
    expect(result.monthsOfHistory).toBe(1);
    expect(result.averageMonthlySpend).toBe(5000);
    const current = result.scenarios.find((s) => s.key === "current");
    expect(current?.monthlyNet).toBe(15000);
    expect(current?.balances[0]?.balance).toBe(35000);
  });

  it("averages over three months of history", () => {
    const result = forecast({
      transactions: [
        march(3000, "2026-01-05"),
        march(6000, "2026-02-05"),
        march(9000, "2026-03-05"),
      ],
      available: 10000,
      today: "2026-03-10",
      obligations: 0,
    });
    expect(result.monthsOfHistory).toBe(3);
    expect(result.averageMonthlySpend).toBe(6000);
  });

  it("handles negative cash flow, obligations and large values without NaN", () => {
    const result = forecast({
      transactions: [march(900_000, "2026-03-02"), march(1000, "2026-03-01", "income")],
      available: -5000,
      today: "2026-03-10",
      obligations: 250_000,
    });
    for (const scenario of result.scenarios) {
      for (const point of scenario.balances) {
        expect(Number.isFinite(point.balance)).toBe(true);
      }
      expect(scenario.assumption.length).toBeGreaterThan(0);
    }
    expect(result.scenarios.find((s) => s.key === "current")?.monthlyNet).toBeLessThan(0);
  });

  it("keeps scenarios ordered conservative → current → optimistic", () => {
    const result = forecast({
      transactions: [march(4000, "2026-03-02"), march(10000, "2026-03-01", "income")],
      available: 0,
      today: "2026-03-10",
      obligations: 0,
    });
    const [conservative, current, optimistic] = result.scenarios;
    expect(conservative?.monthlySpend).toBeGreaterThan(current?.monthlySpend ?? 0);
    expect(optimistic?.monthlySpend).toBeLessThan(current?.monthlySpend ?? 0);
  });
});

describe("insufficient data behaviour", () => {
  it("suggests actions instead of inventing insights", () => {
    const hints = emptyStateHints({
      transactionCount: 1,
      monthsOfHistory: 1,
      recurringBills: 0,
      budgetCount: 0,
    });
    expect(hints).toHaveLength(3);
  });

  it("produces no insight cards when nothing supports one", () => {
    const cards = buildInsights({
      comparison: comparePeriods([], { from: "2026-03-01", to: "2026-03-31" }, { from: "2026-02-01", to: "2026-02-28" }),
      categories: [],
      obligations: obligationSummary([], "2026-03-10"),
      commitmentsTotal: 0,
      budgets: [],
      safe: safeToSpendSummary({ available: 100, reserved: 0, today: "2026-03-10" }),
      currency: (v) => `₹${v}`,
    });
    expect(cards).toEqual([]);
  });

  it("only states facts the data supports", () => {
    const cards = buildInsights({
      comparison: comparePeriods(
        [txn({ amount: 3000, date: "2026-03-02" }), txn({ amount: 1760, date: "2026-02-02" })],
        { from: "2026-03-01", to: "2026-03-31" },
        { from: "2026-02-01", to: "2026-02-28" },
      ),
      categories: categoryInsights([txn({ amount: 3000, date: "2026-03-02" })], {
        from: "2026-03-01",
        to: "2026-03-31",
      }),
      obligations: obligationSummary([], "2026-03-10"),
      commitmentsTotal: 14200,
      budgets: [{ name: "Food", percentageUsed: 82, status: "near_limit" }],
      safe: safeToSpendSummary({ available: 100, reserved: 2400, today: "2026-03-10" }),
      currency: (v) => `₹${v}`,
    });
    const text = cards.map((c) => c.text).join(" | ");
    expect(text).toContain("₹1240 higher");
    expect(text).toContain("82% of your Food budget");
    expect(text).toContain("₹14200");
    expect(text).toContain("₹2300 short");
  });
});