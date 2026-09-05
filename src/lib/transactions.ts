/**
 * Pure ledger helpers shared by the browser and the server.
 *
 * Nothing here does I/O, so every rule (what counts as money in, how a range
 * resolves, how a row is exported) can be unit-tested and can never disagree
 * between the list screen, the export file and the server query.
 */
import { MONTHS_LONG, MONTHS_SHORT } from "./format";
import { addDays, monthBounds, previousMonthBounds, round2 } from "./money";

export const TRANSACTION_TYPES = [
  "income",
  "expense",
  "bill_payment",
  "transfer",
  "refund",
  "adjustment",
] as const;
export type LedgerType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_STATUSES = [
  "completed",
  "pending",
  "failed",
  "cancelled",
  "reversed",
] as const;
export type LedgerStatus = (typeof TRANSACTION_STATUSES)[number];

/** Types a person can create by hand. `bill_payment` is written by the engine only. */
export const MANUAL_TYPES = ["income", "expense", "transfer", "refund", "adjustment"] as const;
export type ManualType = (typeof MANUAL_TYPES)[number];

export const PAYMENT_METHODS = [
  "upi",
  "manual",
  "cash",
  "card",
  "netbanking",
  "wallet",
  "bank_transfer",
  "other",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAGE_SIZE = 50;
/** Hard ceiling for a single export so a request can never exhaust memory. */
export const EXPORT_ROW_LIMIT = 5000;

export const TYPE_LABELS: Record<LedgerType, string> = {
  income: "Income",
  expense: "Expense",
  bill_payment: "Bill payment",
  transfer: "Transfer",
  refund: "Refund",
  adjustment: "Adjustment",
};

export const STATUS_LABELS: Record<LedgerStatus, string> = {
  completed: "Completed",
  pending: "Pending",
  failed: "Failed",
  cancelled: "Cancelled",
  reversed: "Reversed",
};

export const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  manual: "Manual",
  cash: "Cash",
  card: "Card",
  netbanking: "Net banking",
  wallet: "Wallet",
  bank_transfer: "Bank transfer",
  other: "Other",
};

export function typeLabel(type: string): string {
  return TYPE_LABELS[type as LedgerType] ?? type;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status as LedgerStatus] ?? status;
}

export function methodLabel(method?: string | null): string {
  if (!method) return "—";
  return METHOD_LABELS[method] ?? method;
}

/* --------------------------------- ranges -------------------------------- */

export const DATE_RANGES = [
  "all",
  "today",
  "week",
  "month",
  "last_month",
  "3months",
  "custom",
] as const;
export type DateRangeKey = (typeof DATE_RANGES)[number];

export const RANGE_LABELS: Record<DateRangeKey, string> = {
  all: "All time",
  today: "Today",
  week: "This week",
  month: "This month",
  last_month: "Last month",
  "3months": "Last 3 months",
  custom: "Custom",
};

/** Turn a range key into inclusive YYYY-MM-DD bounds relative to `today`. */
export function resolveRange(
  key: DateRangeKey,
  today: string,
  custom?: { from?: string | null; to?: string | null },
): { from: string | null; to: string | null } {
  switch (key) {
    case "today":
      return { from: today, to: today };
    case "week": {
      // Week starts on Monday.
      const weekday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
      return { from: addDays(today, -weekday), to: addDays(today, 6 - weekday) };
    }
    case "month": {
      const bounds = monthBounds(today);
      return { from: bounds.start, to: bounds.end };
    }
    case "last_month": {
      const bounds = previousMonthBounds(today);
      return { from: bounds.start, to: bounds.end };
    }
    case "3months":
      return { from: addDays(today, -89), to: today };
    case "custom":
      return { from: custom?.from || null, to: custom?.to || null };
    case "all":
    default:
      return { from: null, to: null };
  }
}

/* --------------------------------- amounts -------------------------------- */

export type LedgerRow = {
  id: string;
  type: string;
  status: string;
  amount: number | string;
  currency?: string | null;
  category: string;
  description?: string | null;
  notes?: string | null;
  date: string;
  payment_method?: string | null;
  external_reference?: string | null;
  bill_occurrence_id?: string | null;
  reversal_of?: string | null;
  reversed_by?: string | null;
  source?: string | null;
  created_at?: string;
};

/**
 * The direction a row moves money in the ledger:
 *  +1 money in, -1 money out, 0 neutral (transfers never change net worth).
 */
export function direction(type: string, amount = 1): 1 | -1 | 0 {
  switch (type) {
    case "income":
    case "refund":
      return 1;
    case "expense":
    case "bill_payment":
      return -1;
    case "adjustment":
      return amount < 0 ? -1 : 1;
    case "transfer":
    default:
      return 0;
  }
}

/** Amount with its ledger sign applied (transfers stay unsigned). */
export function signedAmount(row: Pick<LedgerRow, "type" | "amount">): number {
  const amount = Number(row.amount);
  return round2(direction(row.type, amount) * Math.abs(amount));
}

/** Text prefix so the direction is readable without relying on colour alone. */
export function amountPrefix(row: Pick<LedgerRow, "type" | "amount">): string {
  const dir = direction(row.type, Number(row.amount));
  if (dir > 0) return "+";
  if (dir < 0) return "−";
  return "";
}

/** True when the row is a settled movement that affects balances. */
export function isSettled(row: Pick<LedgerRow, "status">): boolean {
  return (row.status ?? "completed") === "completed";
}

/** Manual rows may be edited/deleted; engine- and provider-owned rows may not. */
export function isEditable(row: LedgerRow): boolean {
  if (row.type === "bill_payment") return false;
  if ((row.source ?? "manual") !== "manual") return false;
  if (row.reversed_by) return false;
  if (row.reversal_of) return false;
  return true;
}

/** A settled movement that has not been reversed yet can be reversed. */
export function isReversible(row: LedgerRow): boolean {
  return isSettled(row) && !row.reversed_by && !row.reversal_of && row.type !== "transfer";
}

/** The offsetting row type used when reversing `row`. */
export function reversalTypeFor(row: Pick<LedgerRow, "type">): ManualType {
  return row.type === "expense" || row.type === "bill_payment" ? "refund" : "adjustment";
}

/* --------------------------------- grouping ------------------------------- */

export type DateGroup = { key: string; label: string; rows: LedgerRow[]; net: number };

function groupLabel(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  const sameYear = day.slice(0, 4) === today.slice(0, 4);
  const month = sameYear ? MONTHS_SHORT[(m ?? 1) - 1] : MONTHS_LONG[(m ?? 1) - 1];
  return sameYear ? `${d} ${month}` : `${d} ${month} ${y}`;
}

/** Group rows (already sorted newest first) into labelled day buckets. */
export function groupByDate(rows: LedgerRow[], today: string): DateGroup[] {
  const groups: DateGroup[] = [];
  const index = new Map<string, DateGroup>();
  for (const row of rows) {
    let group = index.get(row.date);
    if (!group) {
      group = { key: row.date, label: groupLabel(row.date, today), rows: [], net: 0 };
      index.set(row.date, group);
      groups.push(group);
    }
    group.rows.push(row);
    if (isSettled(row)) group.net = round2(group.net + signedAmount(row));
  }
  return groups;
}

/* ---------------------------------- export -------------------------------- */

export const EXPORT_HEADERS = [
  "date",
  "description",
  "amount",
  "signed_amount",
  "currency",
  "type",
  "category",
  "status",
  "payment_method",
  "reference",
  "related_bill",
  "notes",
  "created_at",
] as const;

export type ExportRow = LedgerRow & { bill_title?: string | null };

/** One export record — never includes ids, tokens or provider secrets. */
export function toExportRow(row: ExportRow): (string | number)[] {
  return [
    row.date,
    row.description ?? "",
    round2(Math.abs(Number(row.amount))),
    signedAmount(row),
    row.currency ?? "INR",
    row.type,
    row.category,
    row.status,
    row.payment_method ?? "",
    row.external_reference ?? "",
    row.bill_title ?? "",
    row.notes ?? "",
    row.created_at ?? "",
  ];
}

function escapeCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

/** RFC-4180 style CSV of real ledger rows. */
export function toLedgerCsv(rows: ExportRow[]): string {
  return [[...EXPORT_HEADERS], ...rows.map(toExportRow)]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}

/** JSON export payload with the same safe field set as the CSV. */
export function toLedgerJson(rows: ExportRow[]): string {
  const records = rows.map((row) => {
    const values = toExportRow(row);
    return Object.fromEntries(EXPORT_HEADERS.map((header, i) => [header, values[i]]));
  });
  return JSON.stringify({ exported_at: new Date().toISOString(), count: records.length, transactions: records }, null, 2);
}

/* --------------------------------- totals --------------------------------- */

/** Money in / money out / net for a set of rows (settled rows only). */
export function summarise(rows: LedgerRow[]): { inflow: number; outflow: number; net: number } {
  let inflow = 0;
  let outflow = 0;
  for (const row of rows) {
    if (!isSettled(row)) continue;
    const signed = signedAmount(row);
    if (signed > 0) inflow += signed;
    else outflow += Math.abs(signed);
  }
  return { inflow: round2(inflow), outflow: round2(outflow), net: round2(inflow - outflow) };
}