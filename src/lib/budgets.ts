/**
 * Deterministic budget rules.
 *
 * Pure functions only. Period cycles, spend attribution and health thresholds
 * live here so the budgets screen, the insights screen, the server functions
 * and the tests can never disagree. All money maths delegates to
 * `src/lib/money.ts` — this module adds no second engine.
 */
import {
  addDays,
  addMonthsClamped,
  budgetProgress,
  daysBetween,
  round2,
  type BudgetProgress,
  type TxnLike,
} from "./money";

export const BUDGET_PERIODS = ["weekly", "monthly", "quarterly", "yearly", "custom"] as const;
export type BudgetPeriod = (typeof BUDGET_PERIODS)[number];

export const BUDGET_STATES = ["active", "paused", "archived"] as const;
export type BudgetState = (typeof BUDGET_STATES)[number];

export const PERIOD_LABELS: Record<BudgetPeriod, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  custom: "Custom range",
};

export const STATE_LABELS: Record<BudgetState, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

/**
 * Business-layer defaults. UI components must read thresholds from the budget
 * record (or from here) instead of hardcoding percentages.
 */
export const DEFAULT_THRESHOLDS = { warning: 50, nearLimit: 80, overBudget: 100 } as const;

export type BudgetRecord = {
  id: string;
  name: string | null;
  category: string;
  amount: number | string;
  period: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  status: string;
  warn_threshold: number | string;
  near_limit_threshold: number | string;
  created_at?: string;
};

export type Cycle = { start: string; end: string };

function normalisePeriod(period: string): BudgetPeriod {
  return (BUDGET_PERIODS as readonly string[]).includes(period)
    ? (period as BudgetPeriod)
    : "monthly";
}

export function budgetState(budget: Pick<BudgetRecord, "status" | "is_active">): BudgetState {
  const status = budget.status as BudgetState;
  if ((BUDGET_STATES as readonly string[]).includes(status)) return status;
  return budget.is_active ? "active" : "paused";
}

/**
 * Walk fixed-length cycles from `start` and return the one containing `today`.
 * Before the first cycle begins, the first cycle is returned.
 */
function walkCycles(
  start: string,
  today: string,
  step: (day: string) => string,
  maxCycles = 4000,
): Cycle {
  if (today < start) return { start, end: addDays(step(start), -1) };
  let cursor = start;
  for (let i = 0; i < maxCycles; i += 1) {
    const next = step(cursor);
    if (next > today) return { start: cursor, end: addDays(next, -1) };
    cursor = next;
  }
  return { start: cursor, end: addDays(step(cursor), -1) };
}

/**
 * The cycle of a budget that `today` falls in, clamped to the budget's own
 * start/end dates. A custom budget has exactly one cycle.
 */
export function currentCycle(budget: BudgetRecord, today: string): Cycle {
  const period = normalisePeriod(budget.period);
  const start = budget.start_date;
  let cycle: Cycle;
  switch (period) {
    case "weekly":
      cycle = walkCycles(start, today, (d) => addDays(d, 7));
      break;
    case "monthly":
      cycle = walkCycles(start, today, (d) => addMonthsClamped(d, 1));
      break;
    case "quarterly":
      cycle = walkCycles(start, today, (d) => addMonthsClamped(d, 3));
      break;
    case "yearly":
      cycle = walkCycles(start, today, (d) => addMonthsClamped(d, 12));
      break;
    case "custom":
    default:
      cycle = { start, end: budget.end_date ?? today };
      break;
  }
  const end = budget.end_date && budget.end_date < cycle.end ? budget.end_date : cycle.end;
  return { start: cycle.start, end: end < cycle.start ? cycle.start : end };
}

/**
 * What a category actually consumed in a window.
 *
 * Counted: completed expenses and bill payments.
 * Not counted: income, transfers, adjustments, and anything not completed
 * (pending, failed, cancelled, reversed).
 * Refunds in the same category (including the offsetting rows written by a
 * reversal) reduce the spend, so a reversed ₹1,000 expense nets to ₹0.
 */
export function categorySpend(
  transactions: TxnLike[],
  category: string,
  from: string,
  to: string,
): { gross: number; refunds: number; net: number } {
  let gross = 0;
  let refunds = 0;
  for (const txn of transactions) {
    if ((txn.status ?? "completed") !== "completed") continue;
    if (txn.date < from || txn.date > to) continue;
    if ((txn.category ?? "uncategorised") !== category) continue;
    if (txn.type === "expense" || txn.type === "bill_payment") gross += Math.abs(txn.amount);
    else if (txn.type === "refund") refunds += Math.abs(txn.amount);
  }
  return {
    gross: round2(gross),
    refunds: round2(refunds),
    net: round2(Math.max(0, gross - refunds)),
  };
}

export type BudgetEvaluation = {
  id: string;
  name: string;
  category: string;
  period: BudgetPeriod;
  state: BudgetState;
  cycle: Cycle;
  thresholds: { warning: number; nearLimit: number };
  gross: number;
  refunds: number;
  progress: BudgetProgress;
  daysRemaining: number;
  dailyAllowance: number;
};

/** Full deterministic evaluation of one budget for the cycle containing `today`. */
export function evaluateBudget(
  budget: BudgetRecord,
  transactions: TxnLike[],
  today: string,
): BudgetEvaluation {
  const cycle = currentCycle(budget, today);
  const spend = categorySpend(transactions, budget.category, cycle.start, cycle.end);
  const thresholds = {
    warning: Number(budget.warn_threshold) || DEFAULT_THRESHOLDS.warning,
    nearLimit: Number(budget.near_limit_threshold) || DEFAULT_THRESHOLDS.nearLimit,
  };
  const progress = budgetProgress(Number(budget.amount), spend.net, thresholds);
  const daysRemaining = Math.max(0, daysBetween(today, cycle.end) + 1);
  const usableDays = Math.max(1, daysRemaining);
  return {
    id: budget.id,
    name: budget.name?.trim() || budget.category,
    category: budget.category,
    period: normalisePeriod(budget.period),
    state: budgetState(budget),
    cycle,
    thresholds,
    gross: spend.gross,
    refunds: spend.refunds,
    progress,
    daysRemaining,
    dailyAllowance: round2(Math.max(0, progress.remaining) / usableDays),
  };
}

/** Evaluate a set of budgets, most at-risk first. */
export function evaluateBudgets(
  budgets: BudgetRecord[],
  transactions: TxnLike[],
  today: string,
): BudgetEvaluation[] {
  return budgets
    .map((budget) => evaluateBudget(budget, transactions, today))
    .sort((a, b) => b.progress.percentageUsed - a.progress.percentageUsed);
}

/** Per-cycle history for one budget, newest cycle first. */
export function budgetHistory(
  budget: BudgetRecord,
  transactions: TxnLike[],
  today: string,
  cycles = 6,
): { cycle: Cycle; progress: BudgetProgress }[] {
  const out: { cycle: Cycle; progress: BudgetProgress }[] = [];
  const thresholds = {
    warning: Number(budget.warn_threshold) || DEFAULT_THRESHOLDS.warning,
    nearLimit: Number(budget.near_limit_threshold) || DEFAULT_THRESHOLDS.nearLimit,
  };
  let cursor = today;
  for (let i = 0; i < cycles; i += 1) {
    const cycle = currentCycle(budget, cursor);
    if (cycle.start < budget.start_date && i > 0) break;
    const spend = categorySpend(transactions, budget.category, cycle.start, cycle.end);
    out.push({ cycle, progress: budgetProgress(Number(budget.amount), spend.net, thresholds) });
    if (cycle.start <= budget.start_date) break;
    cursor = addDays(cycle.start, -1);
  }
  return out;
}
