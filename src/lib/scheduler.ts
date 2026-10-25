/**
 * Deterministic automation engine.
 *
 * Pure functions only: no I/O, no clock reads except where a `Date` is passed
 * in explicitly. The scheduler runner (`jobs.server.ts`) supplies the data and
 * persists whatever these functions decide, so every automation rule is unit
 * testable and produces the same result however many times a job runs.
 */
import { daysBetween, round2, type OccurrenceStatus } from "./money";

/* ------------------------------- contracts ------------------------------- */

export const NOTIFICATION_TYPES = [
  "bill_due",
  "bill_overdue",
  "payment_success",
  "payment_failed",
  "budget_warning",
  "budget_exceeded",
  "weekly_summary",
  "security",
  "system",
  "insight",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** One notification the scheduler wants to exist. `dedupeKey` makes it unique. */
export type NotificationDraft = {
  type: NotificationType;
  title: string;
  body: string;
  dedupeKey: string;
  billId?: string | null;
  transactionId?: string | null;
  budgetId?: string | null;
};

/** `notification_preferences` — what the user agreed to receive at all. */
export type Channels = {
  bill_reminders: boolean;
  overdue_alerts: boolean;
  payment_confirmations: boolean;
  budget_alerts: boolean;
  weekly_summary: boolean;
  security_alerts: boolean;
};

/** `user_settings` — when those notifications are allowed to fire. */
export type Schedule = {
  notify_bill_reminders: boolean;
  notify_due_tomorrow: boolean;
  notify_due_today: boolean;
  notify_overdue: boolean;
  notify_payment_recorded: boolean;
  notify_weekly_summary: boolean;
  notify_monthly_summary: boolean;
};

export const DEFAULT_CHANNELS: Channels = {
  bill_reminders: true,
  overdue_alerts: true,
  payment_confirmations: true,
  budget_alerts: true,
  weekly_summary: true,
  security_alerts: true,
};

export const DEFAULT_SCHEDULE: Schedule = {
  notify_bill_reminders: true,
  notify_due_tomorrow: true,
  notify_due_today: true,
  notify_overdue: true,
  notify_payment_recorded: true,
  notify_weekly_summary: false,
  notify_monthly_summary: true,
};

/** Statuses that must never produce a reminder of any kind. */
export const NON_REMINDABLE: readonly OccurrenceStatus[] = [
  "paid",
  "skipped",
  "cancelled",
  "payment_pending",
] as const;

/* -------------------------------- timezone ------------------------------- */

/** Local hour (0-23) at which the morning batch runs in each user's timezone. */
export const MORNING_HOUR = 9;
/** Local hour for the "due tomorrow" heads-up. */
export const EVENING_HOUR = 18;

export type Slot = "morning" | "evening" | "weekly";

export type LocalTime = { day: string; hour: number; weekday: number };

/**
 * The wall-clock day, hour and weekday (1 = Monday) in an IANA timezone.
 * Falls back to UTC when the zone is unknown rather than throwing mid-run.
 */
export function localTime(timeZone: string, now: Date): LocalTime {
  let zone = timeZone;
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatParts(zone, now);
  } catch {
    zone = "UTC";
    parts = formatParts(zone, now);
  }
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24;
  const day = `${get("year")}-${get("month")}-${get("day")}`;
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekday = weekdays.indexOf(get("weekday")) + 1;
  return { day, hour, weekday: weekday || 1 };
}

function formatParts(timeZone: string, now: Date): Intl.DateTimeFormatPart[] {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
}

/**
 * Which batches are due for a user right now, in their own timezone. The job
 * runs hourly in UTC; each user only gets work when their local clock reaches
 * the configured hour, so 9 AM means 9 AM where they are.
 */
export function slotsFor(local: LocalTime): Slot[] {
  const slots: Slot[] = [];
  if (local.hour === MORNING_HOUR) slots.push("morning");
  if (local.hour === EVENING_HOUR) slots.push("evening");
  if (local.hour === MORNING_HOUR && local.weekday === 1) slots.push("weekly");
  return slots;
}

/* ------------------------------- formatting ------------------------------ */

/** Money for notification copy. Pure: no dependency on the UI's active locale. */
export function money(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/* ----------------------------- bill reminders ---------------------------- */

export type OccurrenceLike = {
  id: string;
  bill_id: string;
  scheduled_date: string;
  expected_amount: number;
  actual_amount?: number | null;
  status: string;
  title: string;
  reminder_days_before?: number | null;
  bill_active?: boolean;
};

export type ReminderContext = {
  today: string;
  slot: Slot;
  schedule: Schedule;
  channels: Channels;
  currency?: string;
};

/**
 * Reminders for a single instalment.
 *
 * - settled or in-flight instalments never generate anything;
 * - the lead reminder uses the bill's own `reminder_days_before` window;
 * - "due tomorrow" is an evening heads-up, everything else runs in the morning;
 * - each dedupe key is stable, so re-running the job creates nothing new.
 */
export function occurrenceDrafts(
  occurrence: OccurrenceLike,
  ctx: ReminderContext,
): NotificationDraft[] {
  const status = occurrence.status as OccurrenceStatus;
  if (NON_REMINDABLE.includes(status)) return [];
  if (occurrence.bill_active === false) return [];

  const amount = round2(Number(occurrence.actual_amount ?? occurrence.expected_amount));
  const label = money(amount, ctx.currency ?? "INR");
  const days = daysBetween(ctx.today, occurrence.scheduled_date);
  const lead = Math.max(0, Math.floor(occurrence.reminder_days_before ?? 3));
  const base = { billId: occurrence.bill_id } as const;

  if (days < 0) {
    if (ctx.slot !== "morning") return [];
    if (!ctx.channels.overdue_alerts || !ctx.schedule.notify_overdue) return [];
    const late = Math.abs(days);
    return [
      {
        ...base,
        type: "bill_overdue",
        title: `${occurrence.title} is overdue`,
        body: `${occurrence.title} of ${label} was due ${late} day${late === 1 ? "" : "s"} ago and is still unpaid.`,
        dedupeKey: `bill_overdue:${occurrence.id}`,
      },
    ];
  }

  if (days === 0) {
    if (ctx.slot !== "morning") return [];
    if (!ctx.channels.bill_reminders || !ctx.schedule.notify_due_today) return [];
    return [
      {
        ...base,
        type: "bill_due",
        title: `${occurrence.title} is due today`,
        body: `${occurrence.title} of ${label} is due today.`,
        dedupeKey: `bill_due_today:${occurrence.id}`,
      },
    ];
  }

  if (days === 1) {
    if (ctx.slot !== "evening") return [];
    if (!ctx.channels.bill_reminders || !ctx.schedule.notify_due_tomorrow) return [];
    return [
      {
        ...base,
        type: "bill_due",
        title: `${occurrence.title} is due tomorrow`,
        body: `${occurrence.title} of ${label} is due tomorrow.`,
        dedupeKey: `bill_due_1:${occurrence.id}`,
      },
    ];
  }

  if (ctx.slot === "morning" && lead > 1 && days === lead) {
    if (!ctx.channels.bill_reminders || !ctx.schedule.notify_bill_reminders) return [];
    return [
      {
        ...base,
        type: "bill_due",
        title: `${occurrence.title} is due in ${days} days`,
        body: `${occurrence.title} of ${label} is due on ${occurrence.scheduled_date}.`,
        dedupeKey: `bill_due_${days}:${occurrence.id}`,
      },
    ];
  }

  return [];
}

/** Reminders for a whole schedule, ordered by due date. */
export function reminderDrafts(
  occurrences: OccurrenceLike[],
  ctx: ReminderContext,
): NotificationDraft[] {
  return [...occurrences]
    .sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date))
    .flatMap((occurrence) => occurrenceDrafts(occurrence, ctx));
}

/* ------------------------------ budget alerts ---------------------------- */

export type BudgetAlertInput = {
  id: string;
  name: string;
  amount: number;
  spent: number;
  cycleStart: string;
  warnThreshold: number;
  state: string;
};

/**
 * At most one warning and one exceeded alert per budget cycle.
 *
 * The cycle start is part of the dedupe key, so the next cycle starts clean
 * while the current one never repeats an alert as spending climbs.
 */
export function budgetAlertDrafts(
  budget: BudgetAlertInput,
  ctx: { channels: Channels; slot: Slot; currency?: string },
): NotificationDraft[] {
  if (ctx.slot !== "morning") return [];
  if (!ctx.channels.budget_alerts) return [];
  if (budget.state !== "active") return [];
  if (!(budget.amount > 0)) return [];

  const used = (budget.spent / budget.amount) * 100;
  const currency = ctx.currency ?? "INR";
  const spent = money(round2(budget.spent), currency);
  const cap = money(round2(budget.amount), currency);
  const pct = Math.round(used);

  if (used >= 100) {
    return [
      {
        type: "budget_exceeded",
        budgetId: budget.id,
        title: `${budget.name} budget exceeded`,
        body: `You've spent ${spent} of your ${cap} ${budget.name} budget (${pct}%).`,
        dedupeKey: `budget_exceeded:${budget.id}:${budget.cycleStart}`,
      },
    ];
  }

  const threshold = Math.min(99, Math.max(1, Math.round(budget.warnThreshold)));
  if (used >= threshold) {
    return [
      {
        type: "budget_warning",
        budgetId: budget.id,
        title: `${budget.name} budget at ${pct}%`,
        body: `You've spent ${spent} of your ${cap} ${budget.name} budget.`,
        dedupeKey: `budget_warning:${budget.id}:${budget.cycleStart}`,
      },
    ];
  }

  return [];
}

/* ----------------------------- weekly summary ---------------------------- */

export type WeeklySummaryInput = {
  weekStart: string;
  weekEnd: string;
  income: number;
  spent: number;
  billsPaid: number;
  upcoming: number;
  topCategory: { category: string; amount: number } | null;
  transactionCount: number;
};

export type WeeklySummaryResult =
  | { draft: NotificationDraft; skipped: false }
  | { draft: null; skipped: true; reason: "channel_off" | "schedule_off" | "insufficient_data" };

/**
 * The Monday recap. Built only from real recorded activity — a week with
 * nothing in it produces no notification rather than an empty-looking one.
 */
export function weeklySummaryDraft(
  input: WeeklySummaryInput,
  ctx: { channels: Channels; schedule: Schedule; currency?: string },
): WeeklySummaryResult {
  if (!ctx.channels.weekly_summary) return { draft: null, skipped: true, reason: "channel_off" };
  if (!ctx.schedule.notify_weekly_summary)
    return { draft: null, skipped: true, reason: "schedule_off" };

  const hasActivity =
    input.transactionCount > 0 && input.income + input.spent + input.billsPaid > 0;
  if (!hasActivity) return { draft: null, skipped: true, reason: "insufficient_data" };

  const currency = ctx.currency ?? "INR";
  const lines = [
    `Income ${money(round2(input.income), currency)}`,
    `Spent ${money(round2(input.spent), currency)}`,
    `Bills ${money(round2(input.billsPaid), currency)}`,
    `Upcoming ${money(round2(input.upcoming), currency)}`,
  ];
  if (input.topCategory) {
    lines.push(
      `Largest category ${input.topCategory.category} — ${money(round2(input.topCategory.amount), currency)}`,
    );
  }

  return {
    skipped: false,
    draft: {
      type: "weekly_summary",
      title: "Your weekly BillBuddy summary",
      body: lines.join(" · "),
      dedupeKey: `weekly_summary:${input.weekStart}`,
    },
  };
}

/* ------------------------------- deep links ------------------------------ */

/** Where a notification takes the user. Authenticated routes only. */
export function notificationLink(n: {
  type: string;
  related_bill_id?: string | null;
  related_transaction_id?: string | null;
  related_budget_id?: string | null;
}): string | null {
  if (n.related_transaction_id) return `/transactions/${n.related_transaction_id}`;
  if (n.related_budget_id) return `/money/budgets/${n.related_budget_id}`;
  if (n.related_bill_id) return `/bills`;
  if (n.type === "weekly_summary" || n.type === "insight") return "/insights";
  if (n.type === "security") return "/settings/security";
  return null;
}

/* --------------------------------- jobs ---------------------------------- */

/** Stable identifier for one scheduled execution — the idempotency anchor. */
export function runKey(now: Date): string {
  return `${now.toISOString().slice(0, 13)}:00Z`;
}

export type FailureCategory = "retryable" | "permanent";

/**
 * Transient infrastructure problems are worth another attempt; bad data and
 * rejected constraints are not, and must be recorded instead of retried.
 */
export function classifyFailure(error: unknown): FailureCategory {
  const message = (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();
  const retryable = [
    "timeout",
    "timed out",
    "econnreset",
    "econnrefused",
    "fetch failed",
    "network",
    "socket hang up",
    "503",
    "502",
    "504",
    "too many connections",
    "deadlock",
    "could not serialize",
  ];
  return retryable.some((needle) => message.includes(needle)) ? "retryable" : "permanent";
}

/** A duplicate insert is a success for an idempotent job, never an error. */
export function isDuplicateKey(error: unknown): boolean {
  // Supabase returns a plain object, not an Error, so read both shapes.
  if (!error) return false;
  const record = error as { message?: unknown; code?: unknown; details?: unknown };
  if (record.code === "23505") return true;
  const message =
    error instanceof Error
      ? error.message
      : [record.message, record.code, record.details].filter(Boolean).join(" ");
  return /duplicate key|23505|already exists/i.test(message);
}
