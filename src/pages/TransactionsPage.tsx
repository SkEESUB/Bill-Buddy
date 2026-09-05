import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Filter, Loader2, Plus, Receipt, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useDebounced } from "@/hooks/useDebounced";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/categories";
import { formatAmountShort, toDay } from "@/lib/format";
import { log } from "@/lib/logger";
import {
  DATE_RANGES,
  METHOD_LABELS,
  PAGE_SIZE,
  PAYMENT_METHODS,
  RANGE_LABELS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  groupByDate,
  resolveRange,
  statusLabel,
  summarise,
  typeLabel,
  type DateRangeKey,
  type LedgerRow,
} from "@/lib/transactions";
import {
  createTransaction as createTransactionFn,
  exportTransactions as exportTransactionsFn,
  listTransactions as listTransactionsFn,
} from "@/lib/transactions.functions";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import { LedgerRowCard } from "@/components/LedgerRowCard";
import {
  TransactionFormModal,
  type EntryType,
  type TransactionInput,
} from "@/components/TransactionFormModal";

const CATEGORY_OPTIONS = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

function download(filename: string, mime: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Full financial ledger: filters, search, grouped rows, pagination and export. */
export function TransactionsPage() {
  const listTransactions = useServerFn(listTransactionsFn);
  const exportTransactions = useServerFn(exportTransactionsFn);
  const createTransaction = useServerFn(createTransactionFn);

  const today = useMemo(() => toDay(new Date()), []);
  const [query, setQuery] = useState("");
  const search = useDebounced(query, 300).trim();
  const [type, setType] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");
  const [method, setMethod] = useState<string>("all");
  const [range, setRange] = useState<DateRangeKey>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"csv" | "json" | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<EntryType>("expense");
  const requestSeq = useRef(0);

  const filters = useMemo(() => {
    const bounds = resolveRange(range, today, { from: customFrom, to: customTo });
    return {
      search: search || null,
      type: type as "all",
      status: status as "all",
      category: category === "all" ? null : category,
      payment_method: method === "all" ? null : method,
      from: bounds.from,
      to: bounds.to,
    };
  }, [search, type, status, category, method, range, customFrom, customTo, today]);

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      const seq = ++requestSeq.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const result = await listTransactions({
          data: { ...filters, page: nextPage, pageSize: PAGE_SIZE },
        });
        if (seq !== requestSeq.current) return;
        setRows((prev) => (append ? [...prev, ...result.rows] : result.rows));
        setTotal(result.total);
        setPage(result.page);
        setHasMore(result.hasMore);
      } catch (e) {
        if (seq !== requestSeq.current) return;
        const message = e instanceof Error ? e.message : "Failed to load transactions";
        log.error(message, e);
        setError(message);
      } finally {
        if (seq === requestSeq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [filters, listTransactions],
  );

  useEffect(() => {
    void load(0, false);
  }, [load]);

  const groups = useMemo(() => groupByDate(rows, today), [rows, today]);
  const totals = useMemo(() => summarise(rows), [rows]);
  const activeFilters =
    (type !== "all" ? 1 : 0) +
    (status !== "all" ? 1 : 0) +
    (category !== "all" ? 1 : 0) +
    (method !== "all" ? 1 : 0) +
    (range !== "month" ? 1 : 0);

  const handleExport = async (format: "csv" | "json") => {
    setExporting(format);
    try {
      const file = await exportTransactions({ data: { ...filters, format } });
      if (file.count === 0) {
        toast.error("No transactions match these filters");
        return;
      }
      download(file.filename, file.mime, file.content);
      toast.success(
        file.truncated
          ? `Exported the first ${file.count} matching records`
          : `Exported ${file.count} transactions`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const handleCreate = async (values: TransactionInput) => {
    await createTransaction({
      data: {
        type: values.type,
        amount: values.amount,
        category: values.category,
        description: values.description,
        date: values.date,
        payment_method: values.payment_method,
        notes: values.notes,
        client_request_id: values.client_request_id,
      },
    });
    toast.success("Entry recorded");
    void load(0, false);
  };

  const openForm = (next: EntryType) => {
    setFormType(next);
    setFormOpen(true);
  };

  return (
    <section className="animate-fade-in">
      <header className="card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-[22px] font-extrabold text-text-primary">Transactions</h1>
            <p className="mt-1 text-sm text-text-secondary">
              {total} record{total === 1 ? "" : "s"} · {RANGE_LABELS[range]}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary !min-h-11 !px-3"
              onClick={() => void handleExport("csv")}
              disabled={exporting !== null}
              aria-label="Export CSV"
            >
              {exporting === "csv" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              CSV
            </button>
            <button
              type="button"
              className="btn btn-secondary !min-h-11 !px-3"
              onClick={() => void handleExport("json")}
              disabled={exporting !== null}
              aria-label="Export JSON"
            >
              {exporting === "json" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              JSON
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[#E7F5EF] p-3">
            <p className="text-xs text-[#1F7053]">Money in</p>
            <p className="text-[17px] font-bold text-[#1F7053] tabular-nums">
              {formatAmountShort(totals.inflow)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FCEAED] p-3">
            <p className="text-xs text-[#A73A4C]">Money out</p>
            <p className="text-[17px] font-bold text-[#A73A4C] tabular-nums">
              {formatAmountShort(totals.outflow)}
            </p>
          </div>
          <div className="rounded-2xl bg-lilac/50 p-3">
            <p className="text-xs text-primary">Net</p>
            <p className="text-[17px] font-bold text-primary tabular-nums">
              {formatAmountShort(totals.net)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <button type="button" className="btn btn-primary" onClick={() => openForm("income")}>
            <Plus className="h-4 w-4" /> Income
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => openForm("expense")}>
            <Plus className="h-4 w-4" /> Expense
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => openForm("transfer")}>
            <Plus className="h-4 w-4" /> Transfer
          </button>
        </div>
      </header>

      <div className="mt-4 flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Search transactions</span>
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary"
            aria-hidden="true"
          />
          <input
            className="input-field !min-h-12 pl-11 pr-10"
            placeholder="Search description, notes or reference"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-muted text-text-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          className="btn btn-secondary !min-h-12 !px-4"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <Filter className="h-4 w-4" />
          {activeFilters > 0 ? activeFilters : "Filter"}
        </button>
      </div>

      {showFilters ? (
        <div className="card mt-3 grid gap-3 p-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Type</span>
            <select
              className="input-field !min-h-11"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="all">All types</option>
              {TRANSACTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Status</span>
            <select
              className="input-field !min-h-11"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              {TRANSACTION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Category</span>
            <select
              className="input-field !min-h-11"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Method</span>
            <select
              className="input-field !min-h-11"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              <option value="all">All methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-text-secondary">Period</span>
            <select
              className="input-field !min-h-11"
              value={range}
              onChange={(e) => setRange(e.target.value as DateRangeKey)}
            >
              {DATE_RANGES.map((r) => (
                <option key={r} value={r}>
                  {RANGE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          {range === "custom" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-text-secondary">From</span>
                <input
                  type="date"
                  className="input-field !min-h-11"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-text-secondary">To</span>
                <input
                  type="date"
                  className="input-field !min-h-11"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                />
              </label>
            </div>
          ) : null}
          {activeFilters > 0 ? (
            <button
              type="button"
              className="btn btn-secondary sm:col-span-2"
              onClick={() => {
                setType("all");
                setStatus("all");
                setCategory("all");
                setMethod("all");
                setRange("month");
              }}
            >
              Reset filters
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 space-y-5">
        {loading ? (
          <BillListSkeleton />
        ) : error ? (
          <div className="card p-6 text-center">
            <p className="text-sm font-medium text-error">{error}</p>
            <button
              type="button"
              className="btn btn-secondary mt-4"
              onClick={() => void load(0, false)}
            >
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No transactions yet"
            subtitle="Add income, an expense or a transfer and it will show up here."
            action={
              <button type="button" className="btn btn-primary" onClick={() => openForm("expense")}>
                <Plus className="h-4 w-4" /> Add entry
              </button>
            }
          />
        ) : (
          groups.map((group) => (
            <div key={group.key}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold text-text-primary">{group.label}</h2>
                <span className="text-xs font-semibold text-text-secondary tabular-nums">
                  {group.net >= 0 ? "+" : "−"}
                  {formatAmountShort(Math.abs(group.net))}
                </span>
              </div>
              <div className="space-y-2.5">
                {group.rows.map((row) => (
                  <LedgerRowCard key={row.id} row={row} />
                ))}
              </div>
            </div>
          ))
        )}

        {hasMore && !loading ? (
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => void load(page + 1, true)}
            disabled={loadingMore}
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Load more
          </button>
        ) : null}
      </div>

      <TransactionFormModal
        open={formOpen}
        initialType={formType}
        allowAttachment={false}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreate}
      />
    </section>
  );
}
