import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Receipt, Search, X } from "lucide-react";
import { toast } from "sonner";
import { formatAmountShort } from "@/lib/format";
import { addDays } from "@/lib/money";
import { toUserMessage } from "@/lib/errors";
import { byUrgency, matchesSearch, type OccurrenceView } from "@/lib/occurrences";
import { useDebounced } from "@/hooks/useDebounced";
import { useFinance } from "@/hooks/useFinance";
import { BillCard } from "@/components/BillCard";
import { BillFormModal, type BillInput } from "@/components/BillFormModal";
import { PaymentModal } from "@/components/PaymentModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import type { Bill } from "@/types/database";
import type { PaymentInput } from "@/lib/bills.functions";

type FilterKey = "all" | "upcoming" | "soon" | "overdue" | "paid" | "skipped";
type SortKey = "due" | "amount" | "recent";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "overdue", label: "Overdue" },
  { key: "paid", label: "Paid" },
];

const SORTS: { key: SortKey; label: string }[] = [
  { key: "due", label: "Due date" },
  { key: "amount", label: "Amount" },
  { key: "recent", label: "Recently added" },
];

/** Every instalment across all bills, with search, status filters and sorting. */
export function BillsPage() {
  const finance = useFinance();
  const { snapshot, today, loading, error, reload, actions } = finance;

  const [query, setQuery] = useState("");
  const search = useDebounced(query, 250).trim().toLowerCase();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("due");
  const PAGE = 40;
  const [limit, setLimit] = useState(PAGE);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [payTarget, setPayTarget] = useState<OccurrenceView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OccurrenceView | null>(null);
  const [skipTarget, setSkipTarget] = useState<OccurrenceView | null>(null);
  const [working, setWorking] = useState(false);

  const soonEnd = addDays(today, 3);
  const horizon = addDays(today, 120);
  const settledSince = addDays(today, -120);

  const rows = useMemo(
    () =>
      finance.occurrences.filter((o) =>
        o.isSettled ? o.dueDate >= settledSince : o.dueDate <= horizon,
      ),
    [finance.occurrences, horizon, settledSince],
  );

  const counts = useMemo(() => {
    const totals = { all: rows.length, upcoming: 0, soon: 0, overdue: 0, paid: 0, skipped: 0 };
    for (const o of rows) {
      if (o.storedStatus === "paid") totals.paid += 1;
      else if (o.storedStatus === "skipped" || o.storedStatus === "cancelled") totals.skipped += 1;
      else if (o.status === "overdue") totals.overdue += 1;
      else if (o.dueDate <= soonEnd) totals.soon += 1;
      else totals.upcoming += 1;
    }
    return totals;
  }, [rows, soonEnd]);

  const visible = useMemo(() => {
    const filtered = rows.filter((o) => {
      if (!matchesSearch(o, search)) return false;
      if (filter === "paid") return o.storedStatus === "paid";
      if (filter === "skipped")
        return o.storedStatus === "skipped" || o.storedStatus === "cancelled";
      if (filter === "overdue") return o.status === "overdue";
      if (filter === "soon") return !o.isSettled && o.dueDate >= today && o.dueDate <= soonEnd;
      if (filter === "upcoming") return !o.isSettled && o.dueDate > soonEnd;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "amount") return b.amount - a.amount;
      if (sort === "recent") return b.createdAt.localeCompare(a.createdAt);
      return byUrgency(a, b);
    });
  }, [rows, filter, search, soonEnd, sort, today]);

  // Render in pages: a long history should never cost thousands of DOM nodes.
  const shown = visible.slice(0, limit);

  useEffect(() => {
    setLimit(PAGE);
  }, [filter, search, sort]);

  const outstanding = useMemo(
    () => rows.filter((o) => !o.isSettled).reduce((sum, o) => sum + o.amount, 0),
    [rows],
  );

  const billsById = useMemo(
    () => new Map(snapshot.bills.map((b) => [b.id, b as unknown as Bill])),
    [snapshot.bills],
  );

  const copyUpi = useCallback((upi: string) => {
    void navigator.clipboard?.writeText(upi);
    toast.success("UPI ID copied");
  }, []);

  const submitBill = async (values: BillInput) => {
    if (editing) {
      await actions.updateBill({ id: editing.id, ...values });
      toast.success("Bill updated");
    } else {
      await actions.createBill(values);
      toast.success("Bill added");
    }
  };

  const handlePay = async (input: PaymentInput) => {
    await actions.recordPayment(input);
    toast.success("Payment recorded");
  };

  const removeBill = async () => {
    if (!deleteTarget) return;
    setWorking(true);
    try {
      await actions.deleteBill(deleteTarget.billId);
      toast.success("Bill deleted");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const skip = async () => {
    if (!skipTarget) return;
    setWorking(true);
    try {
      await actions.skipOccurrence(skipTarget.id);
      toast.success("Instalment skipped");
      setSkipTarget(null);
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5 pb-28">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">Bills</h1>
          <p className="text-sm text-text-secondary">
            {formatAmountShort(outstanding)} outstanding · {counts.all}{" "}
            {counts.all === 1 ? "instalment" : "instalments"}
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary !min-h-11 !px-4 !text-sm"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add Bill
        </button>
      </header>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bills..."
          aria-label="Search bills"
          className="h-12 w-full rounded-2xl border border-border-light bg-surface pl-11 pr-10 text-[15px] text-text-primary outline-none transition focus:border-primary"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => setQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="flex rounded-2xl bg-muted/60 p-1 border border-border-light/70 overflow-x-auto">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`flex-1 min-w-[72px] rounded-xl py-2 px-3 text-xs font-bold transition-all ${
              filter === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="bill-sort" className="text-xs font-semibold text-text-tertiary">
          Sort by
        </label>
        <select
          id="bill-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="h-10 rounded-xl border border-border-light bg-surface px-3 text-sm font-medium text-text-primary outline-none focus:border-primary"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <BillListSkeleton />
      ) : error ? (
        <div role="alert" className="card p-6 text-center">
          <p className="text-sm text-error">{error}</p>
          <button type="button" className="btn btn-secondary mt-4" onClick={() => void reload()}>
            Try again
          </button>
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={rows.length === 0 ? "No bills yet" : "Nothing matches this view"}
          subtitle={
            rows.length === 0
              ? "Add your first bill and BillBuddy will keep every instalment on schedule."
              : "Try a different filter or search term."
          }
          action={
            rows.length === 0 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add Bill
              </button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-3">
          {shown.map((occurrence) => (
            <BillCard
              key={occurrence.id}
              occurrence={occurrence}
              today={today}
              onPay={setPayTarget}
              onEdit={(o) => {
                const bill = billsById.get(o.billId);
                if (!bill) return;
                setEditing(bill);
                setFormOpen(true);
              }}
              onSkip={setSkipTarget}
              onDelete={setDeleteTarget}
              onCopyUpi={copyUpi}
            />
          ))}
          {visible.length > shown.length ? (
            <button
              type="button"
              className="btn btn-secondary w-full"
              onClick={() => setLimit((n) => n + PAGE)}
            >
              Show more ({visible.length - shown.length} remaining)
            </button>
          ) : null}
        </div>
      )}

      <BillFormModal
        open={formOpen}
        bill={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={submitBill}
      />

      <PaymentModal
        occurrence={payTarget}
        safeToSpend={finance.spend.safeToSpend}
        today={today}
        onClose={() => setPayTarget(null)}
        onConfirm={handlePay}
        onCopyUpi={copyUpi}
        onSettled={finance.reload}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete this bill?"
        message={
          deleteTarget
            ? `${deleteTarget.title} and all of its scheduled instalments will be removed. Bills with recorded payments can't be deleted — archive them instead.`
            : ""
        }
        busy={working}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void removeBill()}
      />

      <ConfirmDialog
        open={!!skipTarget}
        title="Skip this instalment?"
        message={
          skipTarget
            ? `${skipTarget.title} for ${skipTarget.dueDate} will be marked skipped and left out of your totals.`
            : ""
        }
        confirmLabel="Skip"
        destructive={false}
        busy={working}
        onCancel={() => setSkipTarget(null)}
        onConfirm={() => void skip()}
      />
    </div>
  );
}
