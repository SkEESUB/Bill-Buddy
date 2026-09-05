import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, ScrollText, Search, SearchX, X } from "lucide-react";
import { toast } from "sonner";
import { getPayments, type PaymentWithBill } from "@/lib/api";
import { category } from "@/lib/categories";
import { formatAmount, formatDate, monthLabel, toDay, addDays } from "@/lib/format";
import { downloadFile, toCsv } from "@/lib/export";
import { log, timed } from "@/lib/logger";
import { useDebounced } from "@/hooks/useDebounced";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";

type RangeKey = "all" | "month" | "last" | "3months";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "month", label: "This Month" },
  { key: "last", label: "Last Month" },
  { key: "3months", label: "Last 3 Months" },
];

export function HistoryPage() {
  const [payments, setPayments] = useState<PaymentWithBill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const search = useDebounced(query, 250).trim().toLowerCase();
  const [range, setRange] = useState<RangeKey>("month");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPayments(await timed("load payments", getPayments));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load payments";
      log.error(message, e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = toDay(new Date());
  const monthPrefix = today.slice(0, 7);

  const inRange = useCallback(
    (day: string) => {
      if (range === "all") return true;
      if (range === "month") return day.startsWith(monthPrefix);
      if (range === "last") {
        const d = new Date(`${today}T00:00:00`);
        d.setMonth(d.getMonth() - 1);
        return day.startsWith(toDay(d).slice(0, 7));
      }
      return day >= toDay(addDays(new Date(), -90));
    },
    [range, monthPrefix, today],
  );

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (!inRange(p.payment_date)) return false;
        if (!search) return true;
        return [p.bill?.title ?? "", p.bill?.category ?? "", p.payment_method]
          .join(" ")
          .toLowerCase()
          .includes(search);
      }),
    [payments, inRange, search],
  );

  const monthTotal = useMemo(
    () =>
      payments
        .filter((p) => p.payment_date.startsWith(monthPrefix))
        .reduce((sum, p) => sum + Number(p.amount), 0),
    [payments, monthPrefix],
  );
  const monthCount = payments.filter((p) => p.payment_date.startsWith(monthPrefix)).length;
  const average = monthCount > 0 ? monthTotal / monthCount : 0;
  const allTimeTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const budgetPct = allTimeTotal > 0 ? Math.round((monthTotal / allTimeTotal) * 100) : 0;

  const grouped = useMemo(() => {
    const map = new Map<string, PaymentWithBill[]>();
    for (const p of filtered) {
      const key = monthLabel(p.payment_date);
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [filtered]);

  const exportCsv = () => {
    const csv = toCsv(
      ["Date", "Bill", "Category", "Method", "Status", "Amount (INR)", "Payment ID"],
      filtered.map((p) => [
        p.payment_date,
        p.bill?.title ?? "Bill",
        p.bill?.category ?? "",
        p.payment_method,
        p.status,
        Number(p.amount).toFixed(2),
        p.id,
      ]),
    );
    downloadFile(`payments-${today}.csv`, csv);
    log.success(`Exported ${filtered.length} payments to CSV`);
    toast.success("Payments exported");
  };

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-text-primary">Payment History</h1>
        <button
          className="btn btn-secondary !min-h-10 !text-xs"
          onClick={exportCsv}
          disabled={filtered.length === 0}
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="card mt-4 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">
          Total paid this month
        </p>
        <p className="font-mono text-3xl font-bold tabular-nums text-success">
          {formatAmount(monthTotal)}
        </p>
        <div
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={budgetPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Share of all-time payments"
        >
          <div
            className="h-full rounded-full bg-success transition-all duration-500"
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <div className="mt-3 flex justify-between text-xs text-text-secondary">
          <span>{monthCount} transactions</span>
          <span>Avg {formatAmount(average)}</span>
        </div>
      </div>

      <div className="mt-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            className="input-field !min-h-12 pl-10 pr-10"
            placeholder="Search payments..."
            aria-label="Search payments"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-text-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              aria-pressed={range === r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full border-2 px-3.5 py-2 text-xs font-semibold transition-colors ${
                range === r.key
                  ? "border-primary bg-[#EEE5F5] text-primary"
                  : "border-transparent bg-muted text-text-secondary"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        {error ? (
          <div role="alert" className="card p-4">
            <p className="text-sm font-medium text-error">{error}</p>
            <button
              className="btn btn-secondary mt-3 !min-h-10 !text-xs"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <BillListSkeleton count={3} />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No payments yet"
            subtitle="Payments will appear here after you mark bills as paid."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No matching payments"
            subtitle="Try another search or date range."
          />
        ) : (
          grouped.map(([month, list]) => (
            <div key={month} className="mb-6">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-text-secondary">
                {month}
              </h2>
              <ul className="relative space-y-3 pl-6">
                <span
                  aria-hidden="true"
                  className="absolute bottom-3 left-[7px] top-3 w-0.5 rounded-full bg-lilac/70"
                />
                {list.map((p) => {
                  const cat = category(p.bill?.category ?? "other");
                  const open = expanded === p.id;
                  return (
                    <li key={p.id} className="relative">
                      <span
                        aria-hidden="true"
                        className="absolute -left-[22px] top-7 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-background"
                      />
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : p.id)}
                        className="card card-hover flex w-full items-center gap-3 rounded-[22px] p-4 text-left"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-lilac/50 text-primary">
                          <CheckCircle2 className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-text-primary">
                            {p.bill?.title ?? "Bill"}
                          </p>
                          <p className="text-xs text-text-secondary">{cat.label}</p>
                          <p className="mt-1 text-xs text-text-tertiary">
                            {formatDate(p.payment_date)} ·{" "}
                            <span className="rounded-full bg-muted px-2 py-0.5 font-medium capitalize">
                              via {p.payment_method}
                            </span>
                          </p>
                        </div>
                        <span className="shrink-0 text-[18px] font-bold tabular-nums text-primary">
                          {formatAmount(Number(p.amount))}
                        </span>
                      </button>
                      {open ? (
                        <div className="animate-fade-in mt-2 rounded-2xl border border-border-light bg-elevated p-4 text-xs text-text-secondary">
                          <Row label="Transaction ID" value={p.id} />
                          <Row label="Status" value={p.status} />
                          <Row
                            label="Recorded at"
                            value={new Date(p.created_at).toLocaleString()}
                          />
                          <Row label="Method" value={p.payment_method} />
                          <div className="mt-3 flex gap-2">
                            <button
                              className="btn btn-secondary !min-h-11 flex-1 !text-xs"
                              onClick={() =>
                                downloadFile(
                                  `receipt-${p.id}.csv`,
                                  toCsv(
                                    ["Field", "Value"],
                                    [
                                      ["Bill", p.bill?.title ?? "Bill"],
                                      ["Amount", Number(p.amount).toFixed(2)],
                                      ["Date", p.payment_date],
                                      ["Method", p.payment_method],
                                      ["Transaction ID", p.id],
                                    ],
                                  ),
                                )
                              }
                            >
                              Download receipt
                            </button>
                            <button
                              className="btn btn-secondary !min-h-11 flex-1 !text-xs"
                              onClick={() => {
                                const text = `Paid ${formatAmount(Number(p.amount))} for ${
                                  p.bill?.title ?? "a bill"
                                } on ${formatDate(p.payment_date)}`;
                                if (navigator.share) void navigator.share({ text });
                                else {
                                  void navigator.clipboard?.writeText(text);
                                  toast.success("Receipt copied");
                                }
                              }}
                            >
                              Share
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span>{label}</span>
      <span className="truncate font-medium text-text-primary">{value}</span>
    </div>
  );
}
