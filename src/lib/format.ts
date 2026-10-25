/** Formatting + date helpers shared across pages. All dates are `YYYY-MM-DD`. */

export const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
export const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Local (not UTC) day string, so "today" matches what the user sees. */
export function toDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/* ------------------------------ currency ------------------------------ */

export const SUPPORTED_CURRENCIES = [
  { code: "INR", symbol: "₹", locale: "en-IN", label: "Indian Rupee" },
  { code: "USD", symbol: "$", locale: "en-US", label: "US Dollar" },
  { code: "EUR", symbol: "€", locale: "de-DE", label: "Euro" },
  { code: "GBP", symbol: "£", locale: "en-GB", label: "British Pound" },
  { code: "AED", symbol: "AED ", locale: "en-AE", label: "UAE Dirham" },
  { code: "SGD", symbol: "S$", locale: "en-SG", label: "Singapore Dollar" },
  { code: "AUD", symbol: "A$", locale: "en-AU", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$", locale: "en-CA", label: "Canadian Dollar" },
] as const;

export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]["code"];

let displayCurrency: (typeof SUPPORTED_CURRENCIES)[number] = SUPPORTED_CURRENCIES[0];

/**
 * Set the currency every amount on screen is rendered in.
 * Called once the signed-in user's saved settings are known.
 */
export function setDisplayCurrency(code: string | null | undefined): void {
  displayCurrency =
    SUPPORTED_CURRENCIES.find((c) => c.code === (code ?? "").toUpperCase()) ??
    SUPPORTED_CURRENCIES[0];
}

export function currencySymbol(code?: string | null): string {
  if (!code) return displayCurrency.symbol;
  return (SUPPORTED_CURRENCIES.find((c) => c.code === code.toUpperCase()) ?? displayCurrency)
    .symbol;
}

/** ₹1,240.00 — grouped for the active currency's locale. */
export function formatAmount(amount: number): string {
  return `${displayCurrency.symbol}${new Intl.NumberFormat(displayCurrency.locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
}

/** Compact variant without decimals, for large hero numbers. */
export function formatAmountShort(amount: number): string {
  return `${displayCurrency.symbol}${new Intl.NumberFormat(displayCurrency.locale, {
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0)}`;
}

/** "15 Mar 2025, 4:20 pm" in the user's saved timezone. */
export function formatDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(displayCurrency.locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      ...(timeZone ? { timeZone } : {}),
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

/** "15 Mar 2025" */
export function formatDate(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return day;
  return `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]} ${y}`;
}

/** "Due Today" / "Due Tomorrow" / "Due 15 Mar" / "Overdue · 15 Mar" */
export function formatDue(dueDate: string, today: string): string {
  if (dueDate === today) return "Due Today";
  if (dueDate === toDay(addDays(new Date(`${today}T00:00:00`), 1))) return "Due Tomorrow";
  const [y, m, d] = dueDate.split("-").map(Number);
  if (!y || !m || !d) return dueDate;
  const label = `${String(d).padStart(2, "0")} ${MONTHS_SHORT[m - 1]}`;
  return dueDate < today ? `Overdue · ${label}` : `Due ${label}`;
}

/** "JANUARY 2025" grouping key for a `YYYY-MM-DD` day. */
export function monthLabel(day: string): string {
  const [y, m] = day.split("-").map(Number);
  if (!y || !m) return day;
  return `${MONTHS_LONG[m - 1]!.toUpperCase()} ${y}`;
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 12) return "Good Morning";
  if (h < 17) return "Good Afternoon";
  return "Good Evening";
}

/** Human name derived from an email address, e.g. rajesh@x.com -> "Rajesh". */
export function displayName(email?: string | null): string {
  if (!email) return "there";
  const local = email.split("@")[0] ?? "";
  const cleaned = local.replace(/[._-]+/g, " ").trim();
  if (!cleaned) return "there";
  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function initials(email?: string | null): string {
  return displayName(email)
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
