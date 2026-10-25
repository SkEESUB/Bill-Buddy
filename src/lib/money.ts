/**
 * Deterministic financial engine.
 *
 * Every function here is pure: same inputs -> same outputs, no I/O, no clock
 * access unless a reference date is passed in. This is the single source of
 * truth for recurrence dates, occurrence status, balances, safe-to-spend and
 * budget health, so the same maths runs on the server, in the UI and in tests.
 */

export type RepeatType = "none" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export type OccurrenceStatus =
  | "pending"
  | "upcoming"
  | "due_soon"
  | "due_today"
  | "overdue"
  | "payment_pending"
  | "paid"
  | "payment_failed"
  | "cancelled"
  | "skipped";

export const TERMINAL_STATUSES: readonly OccurrenceStatus[] = [
  "paid",
  "cancelled",
  "skipped",
] as const;

/* ----------------------------- date helpers ----------------------------- */

/** Parse a `YYYY-MM-DD` day string into its calendar parts (no timezone shift). */
export function parseDay(day: string): { year: number; month: number; date: number } {
  const [year, month, date] = day.split("-").map(Number);
  if (!year || !month || !date) throw new Error(`Invalid day string: ${day}`);
  return { year, month, date };
}

/** Format calendar parts back into a `YYYY-MM-DD` day string. */
export function formatDay(year: number, month: number, date: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(date).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

/** Number of days in a given month, leap-year aware. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Today as a `YYYY-MM-DD` day string in the given IANA timezone. */
export function todayInTimeZone(timeZone = "Asia/Kolkata", now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

/** Whole days between two day strings (`to - from`); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = parseDay(from);
  const b = parseDay(to);
  const ms = Date.UTC(b.year, b.month - 1, b.date) - Date.UTC(a.year, a.month - 1, a.date);
  return Math.round(ms / 86_400_000);
}

/** Add days to a day string. */
export function addDays(day: string, count: number): string {
  const { year, month, date } = parseDay(day);
  const d = new Date(Date.UTC(year, month - 1, date + count));
  return formatDay(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/**
 * Add months to a day string, clamping to the last valid day of the target
 * month. Jan 31 + 1 month => Feb 28 (or Feb 29 in a leap year).
 */
export function addMonthsClamped(day: string, count: number): string {
  const { year, month, date } = parseDay(day);
  const zeroBased = month - 1 + count;
  const targetYear = year + Math.floor(zeroBased / 12);
  const targetMonth = (((zeroBased % 12) + 12) % 12) + 1;
  const clamped = Math.min(date, daysInMonth(targetYear, targetMonth));
  return formatDay(targetYear, targetMonth, clamped);
}

/* ------------------------------ recurrence ------------------------------ */

export type RecurrenceRule = {
  repeat_type: RepeatType;
  /** For `custom`, the number of days between occurrences; otherwise the multiplier. */
  repeat_interval?: number;
  /** Inclusive last date an occurrence may fall on. */
  repeat_end_date?: string | null;
};

/**
 * The next scheduled date after `from`, or `null` when the bill does not
 * repeat or the series has ended.
 */
export function nextOccurrenceDate(from: string, rule: RecurrenceRule): string | null {
  const interval = Math.max(1, Math.floor(rule.repeat_interval ?? 1));
  let next: string | null = null;

  switch (rule.repeat_type) {
    case "weekly":
      next = addDays(from, 7 * interval);
      break;
    case "monthly":
      next = addMonthsClamped(from, interval);
      break;
    case "quarterly":
      next = addMonthsClamped(from, 3 * interval);
      break;
    case "yearly":
      next = addMonthsClamped(from, 12 * interval);
      break;
    case "custom":
      next = addDays(from, interval);
      break;
    case "none":
    default:
      return null;
  }

  if (rule.repeat_end_date && next > rule.repeat_end_date) return null;
  return next;
}

/**
 * Every scheduled date for a bill from `start` up to and including `until`.
 * Bounded by `maxCount` so a misconfigured rule can never loop forever.
 */
export function occurrenceDatesThrough(
  start: string,
  until: string,
  rule: RecurrenceRule,
  maxCount = 120,
): string[] {
  const dates: string[] = [];
  if (start > until) return dates;
  dates.push(start);
  if (rule.repeat_type === "none") return dates;

  let cursor = start;
  while (dates.length < maxCount) {
    const next = nextOccurrenceDate(cursor, rule);
    if (!next || next > until) break;
    dates.push(next);
    cursor = next;
  }
  return dates;
}

/* --------------------------- occurrence status --------------------------- */

/**
 * Derive the display status of an occurrence from its stored status and the
 * current day. Terminal statuses (paid/cancelled/skipped) and in-flight
 * payment states are never overridden by the clock.
 */
export function deriveOccurrenceStatus(
  stored: OccurrenceStatus,
  scheduledDate: string,
  today: string,
  dueSoonDays = 3,
): OccurrenceStatus {
  if (
    stored === "paid" ||
    stored === "cancelled" ||
    stored === "skipped" ||
    stored === "payment_pending" ||
    stored === "payment_failed"
  ) {
    return stored;
  }
  const delta = daysBetween(today, scheduledDate);
  if (delta < 0) return "overdue";
  if (delta === 0) return "due_today";
  if (delta <= dueSoonDays) return "due_soon";
  return "upcoming";
}

/** Sort weight so the most urgent obligations render first. */
export function statusPriority(status: OccurrenceStatus): number {
  const order: Record<OccurrenceStatus, number> = {
    overdue: 0,
    due_today: 1,
    payment_failed: 2,
    due_soon: 3,
    payment_pending: 4,
    upcoming: 5,
    pending: 5,
    paid: 6,
    skipped: 7,
    cancelled: 8,
  };
  return order[status];
}

/* ------------------------------- amounts -------------------------------- */

export const MAX_AMOUNT = 1_000_000_000;

/** True when a value is a usable positive money amount. */
export function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= MAX_AMOUNT;
}

/** Round to 2 decimal places without floating-point drift. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/* ------------------------------- balances ------------------------------- */

export type TxnLike = {
  type: "income" | "expense" | "bill_payment" | "transfer" | "refund" | "adjustment";
  status?: string;
  amount: number;
  date: string;
  category?: string | null;
};

/** Only settled money movements count towards balances. Accepts 'completed' or 'settled'. */
function counts(txn: TxnLike): boolean {
  const s = txn.status ?? "settled";
  return s === "completed" || s === "settled";
}

/**
 * Money actually available: starting balance plus settled inflows minus
 * settled outflows. Transfers move money between the user's own places and
 * therefore never change the total.
 */
export function availableBalance(startingBalance: number, transactions: TxnLike[]): number {
  let total = startingBalance;
  for (const txn of transactions) {
    if (!counts(txn)) continue;
    switch (txn.type) {
      case "income":
      case "refund":
        total += txn.amount;
        break;
      case "expense":
      case "bill_payment":
        total -= txn.amount;
        break;
      case "adjustment":
        total += txn.amount;
        break;
      case "transfer":
        break;
    }
  }
  return round2(total);
}

/** Total spending in a period. Transfers and refunds are not spending. */
export function totalSpending(transactions: TxnLike[], from?: string, to?: string): number {
  let total = 0;
  for (const txn of transactions) {
    if (!counts(txn)) continue;
    if (txn.type !== "expense" && txn.type !== "bill_payment") continue;
    if (from && txn.date < from) continue;
    if (to && txn.date > to) continue;
    total += txn.amount;
  }
  return round2(total);
}

/** Total income in a period. Refunds count as money back in, transfers do not. */
export function totalIncome(transactions: TxnLike[], from?: string, to?: string): number {
  let total = 0;
  for (const txn of transactions) {
    if (!counts(txn)) continue;
    if (txn.type !== "income" && txn.type !== "refund") continue;
    if (from && txn.date < from) continue;
    if (to && txn.date > to) continue;
    total += txn.amount;
  }
  return round2(total);
}

export type ObligationLike = {
  scheduled_date: string;
  expected_amount: number;
  actual_amount?: number | null;
  status: OccurrenceStatus;
};

/**
 * Unpaid obligations still owed on or before `until` (defaults to open-ended).
 * Overdue items are always included because the money is still owed.
 */
export function upcomingObligations(
  occurrences: ObligationLike[],
  today: string,
  until?: string,
): number {
  let total = 0;
  for (const occ of occurrences) {
    if (TERMINAL_STATUSES.includes(occ.status)) continue;
    if (until && occ.scheduled_date > until && occ.scheduled_date >= today) continue;
    total += occ.actual_amount ?? occ.expected_amount;
  }
  return round2(total);
}

export type SafeToSpend = {
  available: number;
  reserved: number;
  savingsCommitment: number;
  safeToSpend: number;
  daysRemaining: number;
  dailySafeSpend: number;
};

/**
 * What the user can spend without missing an obligation:
 * available balance − unpaid bills in the period − savings commitment.
 * Never reported as negative-safe: a shortfall is surfaced as a negative
 * number so the UI can warn rather than silently clamp to zero.
 */
export function safeToSpend(input: {
  available: number;
  reserved: number;
  savingsCommitment?: number;
  daysRemaining: number;
}): SafeToSpend {
  const savingsCommitment = input.savingsCommitment ?? 0;
  const safe = round2(input.available - input.reserved - savingsCommitment);
  const days = Math.max(1, Math.floor(input.daysRemaining));
  return {
    available: round2(input.available),
    reserved: round2(input.reserved),
    savingsCommitment: round2(savingsCommitment),
    safeToSpend: safe,
    daysRemaining: days,
    dailySafeSpend: round2(Math.max(0, safe) / days),
  };
}

/** Days left in the calendar month containing `today`, including today. */
export function daysRemainingInMonth(today: string): number {
  const { year, month, date } = parseDay(today);
  return daysInMonth(year, month) - date + 1;
}

/* -------------------------------- budgets -------------------------------- */

export type BudgetStatus = "healthy" | "warning" | "near_limit" | "over_budget";

export type BudgetProgress = {
  budget: number;
  spent: number;
  remaining: number;
  percentageUsed: number;
  status: BudgetStatus;
};

/** Budget health from spend vs limit, using the 50/80/100% thresholds. */
export function budgetProgress(
  budget: number,
  spent: number,
  thresholds: { warning: number; nearLimit: number } = { warning: 50, nearLimit: 80 },
): BudgetProgress {
  const safeBudget = budget > 0 ? budget : 0;
  const percentageUsed = safeBudget === 0 ? 0 : round2((spent / safeBudget) * 100);
  let status: BudgetStatus = "healthy";
  if (percentageUsed >= 100) status = "over_budget";
  else if (percentageUsed >= thresholds.nearLimit) status = "near_limit";
  else if (percentageUsed >= thresholds.warning) status = "warning";
  return {
    budget: round2(safeBudget),
    spent: round2(spent),
    remaining: round2(safeBudget - spent),
    percentageUsed,
    status,
  };
}

/* -------------------------------- insights ------------------------------- */

/** First and last day of the calendar month containing `day`. */
export function monthBounds(day: string): { start: string; end: string } {
  const { year, month } = parseDay(day);
  return {
    start: formatDay(year, month, 1),
    end: formatDay(year, month, daysInMonth(year, month)),
  };
}

/** Same for the month before `day`. */
export function previousMonthBounds(day: string): { start: string; end: string } {
  const { year, month } = parseDay(day);
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  return {
    start: formatDay(prevYear, prevMonth, 1),
    end: formatDay(prevYear, prevMonth, daysInMonth(prevYear, prevMonth)),
  };
}

/** Percentage change from `previous` to `current`; null when there is no base. */
export function percentChange(previous: number, current: number): number | null {
  if (previous <= 0) return null;
  return round2(((current - previous) / previous) * 100);
}

/** Spending grouped by category label, highest first. */
export function spendingByCategory(
  transactions: TxnLike[],
  from?: string,
  to?: string,
): { category: string; amount: number }[] {
  const totals = new Map<string, number>();
  for (const txn of transactions) {
    if (!counts(txn)) continue;
    if (txn.type !== "expense" && txn.type !== "bill_payment") continue;
    if (from && txn.date < from) continue;
    if (to && txn.date > to) continue;
    const key = txn.category ?? "Uncategorised";
    totals.set(key, (totals.get(key) ?? 0) + txn.amount);
  }
  return [...totals.entries()]
    .map(([category, amount]) => ({ category, amount: round2(amount) }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Monthly cost of a recurring bill, normalised so weekly/quarterly/yearly
 * commitments can be compared and summed.
 */
export function monthlyEquivalent(amount: number, rule: RecurrenceRule): number {
  const interval = Math.max(1, Math.floor(rule.repeat_interval ?? 1));
  switch (rule.repeat_type) {
    case "weekly":
      return round2((amount * 52) / 12 / interval);
    case "monthly":
      return round2(amount / interval);
    case "quarterly":
      return round2(amount / (3 * interval));
    case "yearly":
      return round2(amount / (12 * interval));
    case "custom":
      return round2((amount * 365) / 12 / interval);
    case "none":
    default:
      return 0;
  }
}

/**
 * Straight-line projected balance: today's balance plus expected recurring
 * income minus known obligations over the horizon. Deterministic and
 * explainable — it makes no statistical prediction.
 */
export function projectBalance(input: {
  available: number;
  monthlyIncome: number;
  obligations: number;
  monthsAhead: number;
  monthlyRecurringSpend: number;
}): number {
  const months = Math.max(0, input.monthsAhead);
  return round2(
    input.available +
      input.monthlyIncome * months -
      input.obligations -
      input.monthlyRecurringSpend * months,
  );
}
