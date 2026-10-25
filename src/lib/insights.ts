/**
 * Deterministic financial intelligence.
 *
 * Cash flow, category analysis, period comparison, recurring commitments,
 * obligations, safe-to-spend and straight-line projection. Pure functions
 * only — every number is derived from real ledger/bill rows passed in, and
 * all primitive maths comes from `src/lib/money.ts`.
 */
import {
  addDays,
  daysBetween,
  daysRemainingInMonth,
  monthBounds,
  monthlyEquivalent,
  percentChange,
  previousMonthBounds,
  projectBalance,
  round2,
  safeToSpend,
  spendingByCategory,
  totalIncome,
  totalSpending,
  upcomingObligations,
  type ObligationLike,
  type RepeatType,
  type TxnLike,
} from "./money";

/* --------------------------------- ranges -------------------------------- */

export const INSIGHT_RANGES = [
  "this_month",
  "last_month",
  "3months",
  "6months",
  "this_year",
  "custom",
] as const;
export type InsightRangeKey = (typeof INSIGHT_RANGES)[number];

export const INSIGHT_RANGE_LABELS: Record<InsightRangeKey, string> = {
  this_month: "This month",
  last_month: "Last month",
  "3months": "Last 3 months",
  "6months": "Last 6 months",
  this_year: "This year",
  custom: "Custom",
};

export type Range = { from: string; to: string };

/** Inclusive bounds for a range key, relative to `today`. */
export function resolveInsightRange(
  key: InsightRangeKey,
  today: string,
  custom?: { from?: string | null; to?: string | null },
): Range {
  switch (key) {
    case "last_month": {
      const b = previousMonthBounds(today);
      return { from: b.start, to: b.end };
    }
    case "3months":
      return { from: addDays(today, -89), to: today };
    case "6months":
      return { from: addDays(today, -179), to: today };
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "custom": {
      const month = monthBounds(today);
      return { from: custom?.from || month.start, to: custom?.to || today };
    }
    case "this_month":
    default: {
      const b = monthBounds(today);
      return { from: b.start, to: today > b.end ? b.end : today };
    }
  }
}

/** The equally long window immediately before `range`, for comparisons. */
export function previousRange(range: Range): Range {
  const span = daysBetween(range.from, range.to);
  const to = addDays(range.from, -1);
  return { from: addDays(to, -span), to };
}

/* -------------------------------- cash flow ------------------------------- */

export type CashFlow = {
  income: number;
  expenses: number;
  billPayments: number;
  transfers: number;
  refunds: number;
  adjustments: number;
  net: number;
  count: number;
};

/**
 * Completed inflows minus completed outflows for a window.
 * Transfers are reported but stay net-neutral; pending, failed, cancelled and
 * reversed rows never move the totals.
 */
export function cashFlow(transactions: TxnLike[], from: string, to: string): CashFlow {
  let income = 0;
  let expenses = 0;
  let billPayments = 0;
  let transfers = 0;
  let refunds = 0;
  let adjustments = 0;
  let count = 0;

  for (const txn of transactions) {
    if ((txn.status ?? "completed") !== "completed") continue;
    if (txn.date < from || txn.date > to) continue;
    count += 1;
    const amount = Math.abs(txn.amount);
    switch (txn.type) {
      case "income":
        income += amount;
        break;
      case "expense":
        expenses += amount;
        break;
      case "bill_payment":
        billPayments += amount;
        break;
      case "refund":
        refunds += amount;
        break;
      case "transfer":
        transfers += amount;
        break;
      case "adjustment":
        adjustments += txn.amount;
        break;
    }
  }

  const net = income + refunds + adjustments - expenses - billPayments;
  return {
    income: round2(income),
    expenses: round2(expenses),
    billPayments: round2(billPayments),
    transfers: round2(transfers),
    refunds: round2(refunds),
    adjustments: round2(adjustments),
    net: round2(net),
    count,
  };
}

/* ----------------------------- category analysis --------------------------- */

export type CategoryInsight = {
  category: string;
  amount: number;
  share: number;
  previousAmount: number;
  change: number;
  changePercent: number | null;
};

/**
 * Completed spending per category with its share of the period and the
 * change against the comparison window. Transfers are never spending.
 */
export function categoryInsights(
  transactions: TxnLike[],
  range: Range,
  comparison?: Range,
): CategoryInsight[] {
  const current = spendingByCategory(transactions, range.from, range.to);
  const total = current.reduce((sum, row) => sum + row.amount, 0);
  const previous = new Map(
    comparison
      ? spendingByCategory(transactions, comparison.from, comparison.to).map((r) => [
          r.category,
          r.amount,
        ])
      : [],
  );
  return current.map((row) => {
    const previousAmount = previous.get(row.category) ?? 0;
    return {
      category: row.category,
      amount: row.amount,
      share: total > 0 ? round2((row.amount / total) * 100) : 0,
      previousAmount: round2(previousAmount),
      change: round2(row.amount - previousAmount),
      changePercent: percentChange(previousAmount, row.amount),
    };
  });
}

/* ---------------------------- period comparison ---------------------------- */

export type PeriodComparison = {
  current: { spending: number; income: number; net: number };
  previous: { spending: number; income: number; net: number };
  spendingChange: number;
  incomeChange: number;
  spendingPercent: number | null;
  incomePercent: number | null;
  /** False when the comparison window holds no completed activity at all. */
  reliable: boolean;
};

/** Compare two windows using only completed rows. */
export function comparePeriods(
  transactions: TxnLike[],
  range: Range,
  comparison: Range,
): PeriodComparison {
  const spendNow = totalSpending(transactions, range.from, range.to);
  const incomeNow = totalIncome(transactions, range.from, range.to);
  const spendPrev = totalSpending(transactions, comparison.from, comparison.to);
  const incomePrev = totalIncome(transactions, comparison.from, comparison.to);
  const hasPrev = transactions.some(
    (t) =>
      (t.status ?? "completed") === "completed" &&
      t.date >= comparison.from &&
      t.date <= comparison.to,
  );
  return {
    current: { spending: spendNow, income: incomeNow, net: round2(incomeNow - spendNow) },
    previous: { spending: spendPrev, income: incomePrev, net: round2(incomePrev - spendPrev) },
    spendingChange: round2(spendNow - spendPrev),
    incomeChange: round2(incomeNow - incomePrev),
    spendingPercent: percentChange(spendPrev, spendNow),
    incomePercent: percentChange(incomePrev, incomeNow),
    reliable: hasPrev,
  };
}

/* -------------------------- recurring commitments -------------------------- */

export type BillLike = {
  id: string;
  title: string;
  category: string;
  amount: number;
  repeat_type: string;
  repeat_interval?: number | null;
  repeat_end_date?: string | null;
  is_active?: boolean;
};

export type Commitment = {
  id: string;
  title: string;
  category: string;
  monthly: number;
  repeat: string;
};

/**
 * Recurring bills normalised to a monthly-equivalent cost so weekly,
 * quarterly and yearly commitments can be compared and summed.
 */
export function recurringCommitments(
  bills: BillLike[],
  today: string,
): { total: number; items: Commitment[] } {
  const items: Commitment[] = [];
  for (const bill of bills) {
    if (bill.is_active === false) continue;
    if ((bill.repeat_type ?? "none") === "none") continue;
    if (bill.repeat_end_date && bill.repeat_end_date < today) continue;
    const monthly = monthlyEquivalent(Number(bill.amount), {
      repeat_type: bill.repeat_type as RepeatType,
      repeat_interval: bill.repeat_interval ?? 1,
      repeat_end_date: bill.repeat_end_date ?? null,
    });
    if (monthly <= 0) continue;
    items.push({
      id: bill.id,
      title: bill.title,
      category: bill.category,
      monthly,
      repeat: bill.repeat_type,
    });
  }
  items.sort((a, b) => b.monthly - a.monthly);
  return { total: round2(items.reduce((sum, i) => sum + i.monthly, 0)), items };
}

/* --------------------------- upcoming obligations -------------------------- */

export type ObligationBucket = { amount: number; count: number };

export type ObligationSummary = {
  overdue: ObligationBucket;
  dueToday: ObligationBucket;
  next7: ObligationBucket;
  next30: ObligationBucket;
  thisMonth: number;
  all: number;
  highest: number;
};

const OPEN = (o: ObligationLike) =>
  o.status !== "paid" && o.status !== "cancelled" && o.status !== "skipped";

function bucket(rows: ObligationLike[]): ObligationBucket {
  return {
    amount: round2(rows.reduce((s, o) => s + (o.actual_amount ?? o.expected_amount), 0)),
    count: rows.length,
  };
}

/** Overdue / today / 7-day / 30-day obligation buckets from real occurrences. */
export function obligationSummary(occurrences: ObligationLike[], today: string): ObligationSummary {
  const open = occurrences.filter(OPEN);
  const overdue = open.filter((o) => o.scheduled_date < today);
  const dueToday = open.filter((o) => o.scheduled_date === today);
  const in7 = open.filter(
    (o) => o.scheduled_date >= today && o.scheduled_date <= addDays(today, 7),
  );
  const in30 = open.filter(
    (o) => o.scheduled_date >= today && o.scheduled_date <= addDays(today, 30),
  );
  const amounts = open.map((o) => o.actual_amount ?? o.expected_amount);
  return {
    overdue: bucket(overdue),
    dueToday: bucket(dueToday),
    next7: bucket(in7),
    next30: bucket(in30),
    thisMonth: upcomingObligations(occurrences, today, monthBounds(today).end),
    all: upcomingObligations(occurrences, today),
    highest: amounts.length ? round2(Math.max(...amounts)) : 0,
  };
}

/* ------------------------------ safe to spend ------------------------------ */

export type SafeToSpendSummary = {
  available: number;
  reserved: number;
  savingsCommitment: number;
  amount: number;
  /** Positive number describing how far short of obligations the user is. */
  shortfall: number;
  isShortfall: boolean;
  daysRemaining: number;
  perDay: number;
};

/**
 * Safe-to-spend with an explicit shortfall channel: a negative result is
 * reported honestly instead of being clamped to zero.
 */
export function safeToSpendSummary(input: {
  available: number;
  reserved: number;
  savingsCommitment?: number;
  today: string;
  daysRemaining?: number;
}): SafeToSpendSummary {
  const days = input.daysRemaining ?? daysRemainingInMonth(input.today);
  const base = safeToSpend({
    available: input.available,
    reserved: input.reserved,
    savingsCommitment: input.savingsCommitment ?? 0,
    daysRemaining: days,
  });
  const isShortfall = base.safeToSpend < 0;
  return {
    available: base.available,
    reserved: base.reserved,
    savingsCommitment: base.savingsCommitment,
    amount: base.safeToSpend,
    shortfall: isShortfall ? round2(Math.abs(base.safeToSpend)) : 0,
    isShortfall,
    daysRemaining: base.daysRemaining,
    perDay: isShortfall ? 0 : base.dailySafeSpend,
  };
}

/* -------------------------------- forecasting ------------------------------ */

export type ForecastScenario = {
  key: "conservative" | "current" | "optimistic";
  label: string;
  assumption: string;
  monthlyIncome: number;
  monthlySpend: number;
  monthlyNet: number;
  balances: { month: number; balance: number }[];
};

export type Forecast = {
  /** Months of completed history the averages are based on. */
  monthsOfHistory: number;
  sufficient: boolean;
  basis: string;
  averageMonthlyIncome: number;
  averageMonthlySpend: number;
  scenarios: ForecastScenario[];
};

/** Distinct calendar months containing completed activity. */
export function monthsWithActivity(transactions: TxnLike[]): number {
  const months = new Set<string>();
  for (const txn of transactions) {
    if ((txn.status ?? "completed") !== "completed") continue;
    months.add(txn.date.slice(0, 7));
  }
  return months.size;
}

/**
 * Straight-line projection from recorded activity. Not a prediction: each
 * scenario states the deterministic assumption it applies to the averages.
 */
export function forecast(input: {
  transactions: TxnLike[];
  available: number;
  today: string;
  obligations: number;
  monthsAhead?: number;
  lookbackMonths?: number;
}): Forecast {
  const monthsAhead = Math.max(1, input.monthsAhead ?? 6);
  const lookback = Math.max(1, input.lookbackMonths ?? 3);
  const from = `${addMonthsBack(input.today, lookback - 1).slice(0, 7)}-01`;
  const window = { from, to: input.today };

  const history = monthsWithActivity(
    input.transactions.filter((t) => t.date >= from && t.date <= input.today),
  );
  const spend = totalSpending(input.transactions, window.from, window.to);
  const income = totalIncome(input.transactions, window.from, window.to);
  const divisor = Math.max(1, history);
  const averageMonthlySpend = round2(spend / divisor);
  const averageMonthlyIncome = round2(income / divisor);
  const sufficient = history >= 1 && (spend > 0 || income > 0);

  const build = (
    key: ForecastScenario["key"],
    label: string,
    assumption: string,
    incomeFactor: number,
    spendFactor: number,
  ): ForecastScenario => {
    const monthlyIncome = round2(averageMonthlyIncome * incomeFactor);
    const monthlySpend = round2(averageMonthlySpend * spendFactor);
    const balances = [];
    for (let month = 1; month <= monthsAhead; month += 1) {
      balances.push({
        month,
        balance: projectBalance({
          available: input.available,
          monthlyIncome,
          obligations: input.obligations,
          monthsAhead: month,
          monthlyRecurringSpend: monthlySpend,
        }),
      });
    }
    return {
      key,
      label,
      assumption,
      monthlyIncome,
      monthlySpend,
      monthlyNet: round2(monthlyIncome - monthlySpend),
      balances,
    };
  };

  return {
    monthsOfHistory: history,
    sufficient,
    basis: `Based on your average completed activity over the last ${divisor} month${
      divisor === 1 ? "" : "s"
    }, plus your known unpaid obligations.`,
    averageMonthlyIncome,
    averageMonthlySpend,
    scenarios: sufficient
      ? [
          build(
            "conservative",
            "Conservative",
            "Spending runs 10% above your average and income stays flat.",
            1,
            1.1,
          ),
          build("current", "Current trend", "Income and spending stay at your averages.", 1, 1),
          build(
            "optimistic",
            "Optimistic",
            "Spending runs 10% below your average and income stays flat.",
            1,
            0.9,
          ),
        ]
      : [],
  };
}

function addMonthsBack(day: string, months: number): string {
  const [y, m] = day.split("-").map(Number);
  const zero = (m ?? 1) - 1 - months;
  const year = (y ?? 1970) + Math.floor(zero / 12);
  const month = (((zero % 12) + 12) % 12) + 1;
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/* -------------------------------- insights -------------------------------- */

export type InsightCard = {
  id: string;
  tone: "neutral" | "positive" | "warning" | "danger";
  text: string;
};

export type InsightInputs = {
  comparison: PeriodComparison;
  categories: CategoryInsight[];
  obligations: ObligationSummary;
  commitmentsTotal: number;
  budgets: { name: string; percentageUsed: number; status: string }[];
  safe: SafeToSpendSummary;
  currency: (value: number) => string;
};

/**
 * Statements the recorded data actually supports. Nothing is generated when
 * the underlying calculation has no basis.
 */
export function buildInsights(input: InsightInputs): InsightCard[] {
  const cards: InsightCard[] = [];
  const money = input.currency;

  if (input.comparison.reliable && input.comparison.spendingChange !== 0) {
    const delta = input.comparison.spendingChange;
    cards.push({
      id: "spend-delta",
      tone: delta > 0 ? "warning" : "positive",
      text:
        delta > 0
          ? `Your spending is ${money(delta)} higher than the previous period.`
          : `Your spending is ${money(Math.abs(delta))} lower than the previous period.`,
    });
  }

  if (input.comparison.reliable && input.comparison.incomePercent !== null) {
    const pct = input.comparison.incomePercent;
    if (pct !== 0) {
      cards.push({
        id: "income-delta",
        tone: pct > 0 ? "positive" : "neutral",
        text: `Income ${pct > 0 ? "increased" : "decreased"} by ${Math.abs(pct)}% versus the previous period.`,
      });
    }
  }

  const top = input.categories[0];
  if (top && top.amount > 0) {
    cards.push({
      id: "top-category",
      tone: "neutral",
      text: `${top.category} is your largest spending category at ${money(top.amount)} (${top.share}% of spending).`,
    });
  }

  if (input.obligations.next7.amount > 0) {
    cards.push({
      id: "due-7",
      tone: input.obligations.overdue.amount > 0 ? "danger" : "warning",
      text: `${money(input.obligations.next7.amount)} of bills are due in the next 7 days (${input.obligations.next7.count} bill${input.obligations.next7.count === 1 ? "" : "s"}).`,
    });
  }

  if (input.obligations.overdue.amount > 0) {
    cards.push({
      id: "overdue",
      tone: "danger",
      text: `${money(input.obligations.overdue.amount)} is overdue across ${input.obligations.overdue.count} bill${input.obligations.overdue.count === 1 ? "" : "s"}.`,
    });
  }

  const riskiest = [...input.budgets].sort((a, b) => b.percentageUsed - a.percentageUsed)[0];
  if (riskiest && riskiest.percentageUsed > 0) {
    cards.push({
      id: "budget",
      tone:
        riskiest.status === "over_budget"
          ? "danger"
          : riskiest.status === "near_limit"
            ? "warning"
            : "neutral",
      text: `You have used ${riskiest.percentageUsed}% of your ${riskiest.name} budget.`,
    });
  }

  if (input.commitmentsTotal > 0) {
    cards.push({
      id: "commitments",
      tone: "neutral",
      text: `Your recurring monthly commitments are approximately ${money(input.commitmentsTotal)}.`,
    });
  }

  if (input.safe.isShortfall) {
    cards.push({
      id: "shortfall",
      tone: "danger",
      text: `You're ${money(input.safe.shortfall)} short of your upcoming obligations.`,
    });
  }

  return cards;
}

/** Guidance shown instead of invented insights when there is nothing to analyse. */
export function emptyStateHints(input: {
  transactionCount: number;
  monthsOfHistory: number;
  recurringBills: number;
  budgetCount: number;
}): string[] {
  const hints: string[] = [];
  if (input.transactionCount < 2 || input.monthsOfHistory < 2) {
    hints.push("Keep adding transactions to unlock spending trends.");
  }
  if (input.recurringBills === 0) {
    hints.push("Add recurring bills to see your monthly commitments.");
  }
  if (input.budgetCount === 0) {
    hints.push("Create a budget to track category spending.");
  }
  return hints;
}
