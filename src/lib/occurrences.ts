/**
 * View helpers that turn raw `bill_occurrences` rows into what the UI renders.
 * All status and money maths delegates to `src/lib/money.ts` so every screen
 * agrees on the numbers.
 */
import {
  deriveOccurrenceStatus,
  statusPriority,
  type OccurrenceStatus,
  TERMINAL_STATUSES,
} from "./money";
import type { OccurrenceWithBill } from "./finance.functions";

export type OccurrenceView = {
  id: string;
  billId: string;
  title: string;
  category: string;
  amount: number;
  dueDate: string;
  status: OccurrenceStatus;
  storedStatus: OccurrenceStatus;
  isRecurring: boolean;
  repeatType: string;
  upiId: string | null;
  notes: string | null;
  paidAt: string | null;
  reminderDaysBefore?: number;
  reminderTime?: string | null;
  reminderEmail?: string | null;
  isActive: boolean;
  isSettled: boolean;
  createdAt: string;
};

export const STATUS_BADGES: Record<OccurrenceStatus, { label: string; bg: string; color: string }> =
  {
    overdue: { label: "Overdue", bg: "#FCEAED", color: "#A73A4C" },
    due_today: { label: "Due today", bg: "#FFF3DF", color: "#9C6318" },
    due_soon: { label: "Due soon", bg: "#FFF3DF", color: "#9C6318" },
    upcoming: { label: "Upcoming", bg: "#EEE5F5", color: "#4B1D3F" },
    pending: { label: "Pending", bg: "#EEE5F5", color: "#4B1D3F" },
    payment_pending: { label: "Payment pending", bg: "#E6EEFA", color: "#2C4E86" },
    payment_failed: { label: "Payment failed", bg: "#FCEAED", color: "#A73A4C" },
    paid: { label: "Paid", bg: "#E7F5EF", color: "#1F7053" },
    skipped: { label: "Skipped", bg: "#EDEAEF", color: "#6E5B69" },
    cancelled: { label: "Cancelled", bg: "#EDEAEF", color: "#6E5B69" },
  };

/** Map one occurrence row into its rendered view for `today`. */
export function toView(row: OccurrenceWithBill, today: string): OccurrenceView {
  const stored = (row.status as OccurrenceStatus) ?? "pending";
  const status = deriveOccurrenceStatus(stored, row.scheduled_date, today);
  const amount = Number(row.actual_amount ?? row.expected_amount);
  return {
    id: row.id,
    billId: row.bill_id,
    title: row.bill?.title ?? "Bill",
    category: row.bill?.category ?? "other",
    amount,
    dueDate: row.scheduled_date,
    status,
    storedStatus: stored,
    isRecurring: (row.bill?.repeat_type ?? "none") !== "none",
    repeatType: row.bill?.repeat_type ?? "none",
    upiId: row.bill?.upi_id ?? null,
    notes: row.bill?.notes ?? null,
    paidAt: row.paid_at,
    reminderDaysBefore: row.bill?.reminder_days_before ?? 3,
    reminderTime: row.bill?.reminder_time ?? "09:00",
    reminderEmail: row.bill?.reminder_email ?? null,
    isActive: row.bill?.is_active ?? true,
    isSettled: TERMINAL_STATUSES.includes(stored),
    createdAt: row.bill?.created_at ?? row.scheduled_date,
  };
}

export function toViews(rows: OccurrenceWithBill[], today: string): OccurrenceView[] {
  return rows.map((row) => toView(row, today));
}

/** Most urgent first, then earliest due date. */
export function byUrgency(a: OccurrenceView, b: OccurrenceView): number {
  const byStatus = statusPriority(a.status) - statusPriority(b.status);
  return byStatus !== 0 ? byStatus : a.dueDate.localeCompare(b.dueDate);
}

/**
 * The instalments worth showing in a list: everything unsettled up to the
 * horizon, the next open instalment of each recurring bill, and recently
 * settled instalments. Distant future repeats stay out of the way.
 */
export function relevantOccurrences(
  views: OccurrenceView[],
  today: string,
  options: { horizon: string; settledSince: string },
): OccurrenceView[] {
  const nextOpenByBill = new Map<string, string>();
  for (const view of [...views].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    if (view.isSettled) continue;
    if (!nextOpenByBill.has(view.billId)) nextOpenByBill.set(view.billId, view.id);
  }

  return views
    .filter((view) => {
      if (view.isSettled) return view.dueDate >= options.settledSince;
      if (view.dueDate <= options.horizon) return true;
      return nextOpenByBill.get(view.billId) === view.id;
    })
    .sort(byUrgency);
}

/** Unsettled instalments only — what the user still owes. */
export function openOccurrences(views: OccurrenceView[]): OccurrenceView[] {
  return views.filter((view) => !view.isSettled);
}

/** Search across title, category and notes. */
export function matchesSearch(view: OccurrenceView, term: string): boolean {
  if (!term) return true;
  return [view.title, view.category, view.notes ?? ""].join(" ").toLowerCase().includes(term);
}
