import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Plus, Search, SearchX, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import {
  addTransaction,
  deleteTransaction,
  getBudgets,
  getLedgerDelta,
  getSettings,
  getTransactions,
  setBudget,
  updateTransaction,
} from "@/lib/api";
import { EXPENSE_CATEGORIES, moneyCategory } from "@/lib/categories";
import { formatAmount, formatAmountShort, monthLabel, toDay } from "@/lib/format";
import { log } from "@/lib/logger";
import { toUserMessage } from "@/lib/errors";
import { useDebounced } from "@/hooks/useDebounced";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import { TransactionCard } from "@/components/TransactionCard";
import { TransactionFormModal, type TransactionInput } from "@/components/TransactionFormModal";
import { TransactionsPage } from "@/pages/TransactionsPage";
import type { Budget, Transaction } from "@/types/database";
import { useModalA11y } from "@/hooks/useModalA11y";

type FilterKey = "all" | "income" | "expense";

export function MoneyPage() {
  const [viewMode, setViewMode] = useState<"overview" | "ledger">("overview");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [monthRows, setMonthRows] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const search = useDebounced(query, 250).trim().toLowerCase();
  const [filter, setFilter] = useState<FilterKey>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");
  const [savingBudget, setSavingBudget] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Bounded list + database-side lifetime total: a truncated page of rows
      // must never decide what balance the user is shown.
      const monthStart = `${toDay(new Date()).slice(0, 7)}-01`;
      const [t, m, b, delta, settings] = await Promise.all([
        getTransactions({ limit: 200 }),
        getTransactions({ from: monthStart, limit: 1000 }),
        getBudgets(),
        getLedgerDelta(),
        getSettings(),
      ]);
      setTransactions(t);
      setMonthRows(m);
      setBudgets(b);
      setBalance(Number(settings.starting_balance ?? 0) + delta);
    } catch (e) {
      const message = toUserMessage(e);
      log.error(message, e);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const dialogRef = useModalA11y<HTMLDivElement>(!!budgetCategory);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    let monthIncome = 0;
    let monthExpense = 0;
    const spentByCategory = new Map<string, number>();
    for (const t of monthRows) {
      const amount = Number(t.amount);
      if (t.type === "income") {
        monthIncome += amount;
      } else {
        monthExpense += amount;
        spentByCategory.set(t.category, (spentByCategory.get(t.category) ?? 0) + amount);
      }
    }
    return {
      balance,
      monthIncome,
      monthExpense,
      monthNet: monthIncome - monthExpense,
      spentByCategory,
    };
  }, [monthRows, balance]);

  const visible = useMemo(
    () =>
      transactions.filter((t) => {
        if (filter !== "all" && t.type !== filter) return false;
        if (!search) return true;
        return [t.description ?? "", moneyCategory(t.category).label]
          .join(" ")
          .toLowerCase()
          .includes(search);
      }),
    [transactions, filter, search],
  );

  const months = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of visible) {
      const key = monthLabel(t.date);
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    return [...map.entries()];
  }, [visible]);

  const budgetFor = useCallback(
    (categoryKey: string) =>
      budgets.find((b) => b.category === categoryKey && b.period === "monthly"),
    [budgets],
  );

  const handleSubmit = async (values: TransactionInput) => {
    if (editing) {
      const saved = await updateTransaction(editing.id, values);
      setTransactions((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      toast.success("Entry updated");
    } else {
      const created = await addTransaction(values);
      setTransactions((prev) => [created, ...prev]);
      toast.success(values.type === "income" ? "Income added" : "Expense added");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const target = deleteTarget;
    try {
      await deleteTransaction(target.id);
      setTransactions((prev) => prev.filter((t) => t.id !== target.id));
      toast.success("Entry deleted");
      setDeleteTarget(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete entry");
    } finally {
      setDeleting(false);
    }
  };

  const saveBudget = async () => {
    if (!budgetCategory) return;
    const amount = Number(budgetValue);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter an amount greater than 0");
      return;
    }
    setSavingBudget(true);
    try {
      const saved = await setBudget({ category: budgetCategory, amount, period: "monthly" });
      setBudgets((prev) => {
        const rest = prev.filter((b) => b.id !== saved.id);
        return [...rest, saved];
      });
      toast.success("Budget saved");
      setBudgetCategory(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save budget");
    } finally {
      setSavingBudget(false);
    }
  };

  return (
    <section className="animate-fade-in space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">Money</h1>
          <p className="text-sm text-text-secondary">
            Your balances, monthly budget progress and recent activity.
          </p>
        </div>
      </header>

      {/* Segment switcher */}
      <div className="flex gap-1 border-b border-border-light pb-px">
        <button
          type="button"
          onClick={() => setViewMode("overview")}
          className={`flex items-center gap-2 rounded-t-xl px-4 py-2 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
            viewMode === "overview"
              ? "border-primary text-primary bg-lilac/20"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <Wallet className="h-3.5 w-3.5" /> Overview & Budgets
        </button>
        <button
          type="button"
          onClick={() => setViewMode("ledger")}
          className={`flex items-center gap-2 rounded-t-xl px-4 py-2 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
            viewMode === "ledger"
              ? "border-primary text-primary bg-lilac/20"
              : "border-transparent text-text-secondary hover:text-text-primary"
          }`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" /> Full Ledger & Transactions
        </button>
      </div>

      {viewMode === "ledger" ? (
        <TransactionsPage embedded />
      ) : (
        <>
          <div className="card p-6">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">
          Current balance
        </h2>
        <p className="text-[36px] font-extrabold text-primary leading-tight tabular-nums">
          {formatAmountShort(stats.balance)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#E7F5EF] p-3">
            <p className="text-xs text-[#1F7053]">Income this month</p>
            <p className="text-lg font-bold text-[#1F7053]">
              {formatAmountShort(stats.monthIncome)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FCEAED] p-3">
            <p className="text-xs text-[#A73A4C]">Spent this month</p>
            <p className="text-lg font-bold text-[#A73A4C]">
              {formatAmountShort(stats.monthExpense)}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-text-secondary">
          Net this month:{" "}
          <span className="font-semibold text-text-primary">
            {stats.monthNet >= 0 ? "+" : "−"}
            {formatAmount(Math.abs(stats.monthNet))}
          </span>
        </p>
      </div>

      {/* Budgets */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-secondary">
          Monthly budgets
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {EXPENSE_CATEGORIES.map((cat) => {
            const budget = budgetFor(cat.key);
            const spent = stats.spentByCategory.get(cat.key) ?? 0;
            const limit = budget ? Number(budget.amount) : 0;
            const pct = limit > 0 ? Math.min(100, Math.round((spent / limit) * 100)) : 0;
            const over = limit > 0 && spent > limit;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => {
                  setBudgetCategory(cat.key);
                  setBudgetValue(limit ? String(limit) : "");
                }}
                className="card p-4 text-left transition-shadow hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-text-primary">
                    <cat.icon
                      className="h-4 w-4"
                      strokeWidth={2}
                      aria-hidden="true"
                      style={{ color: cat.color }}
                    />
                    {cat.label}
                  </span>
                  <span className="text-xs font-semibold text-text-secondary">
                    {limit > 0
                      ? `${formatAmountShort(spent)} / ${formatAmountShort(limit)}`
                      : "Set budget"}
                  </span>
                </div>
                <div
                  className="mt-2 neu-inset h-2.5 w-full overflow-hidden rounded-full bg-lilac/40"
                  role="progressbar"
                  aria-valuenow={pct}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${cat.label} budget: ${formatAmount(spent)} spent of ${limit > 0 ? formatAmount(limit) : "no limit set"}`}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${limit > 0 ? pct : 0}%`,
                      backgroundColor: over ? "#C94F62" : cat.color,
                    }}
                  />
                </div>
                {over ? (
                  <p className="mt-1.5 text-xs font-semibold text-error">
                    Over budget by {formatAmountShort(spent - limit)}
                  </p>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* Transactions */}
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-text-secondary">
          Transactions
        </h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            className="input-field !min-h-12 pl-10 pr-10"
            placeholder="Search transactions..."
            value={query}
            aria-label="Search transactions"
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
        <div className="mt-3 flex gap-2">
          {(["all", "income", "expense"] as FilterKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className="min-h-11 rounded-full border px-4 text-xs font-semibold capitalize transition-colors"
              style={
                filter === key
                  ? { backgroundColor: "#EEE5F5", borderColor: "#4B1D3F", color: "#4B1D3F" }
                  : {
                      backgroundColor: "var(--surface)",
                      borderColor: "var(--border-light)",
                      color: "var(--text-secondary)",
                    }
              }
            >
              {key}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
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
          <BillListSkeleton />
        ) : transactions.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No money entries yet"
            subtitle="Track income and spending to see your real balance."
            action={
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add your first entry
              </button>
            }
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title={search ? `No results for "${query}"` : "Nothing here"}
            subtitle="Try a different search term or filter."
          />
        ) : (
          <div className="space-y-6">
            {months.map(([label, list]) => (
              <div key={label}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-text-tertiary">
                  {label}
                </h3>
                <div className="space-y-3">
                  {list.map((t, index) => (
                    <div
                      key={t.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <TransactionCard
                        transaction={t}
                        onEdit={(item) => {
                          setEditing(item);
                          setFormOpen(true);
                        }}
                        onDelete={setDeleteTarget}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        aria-label="Add money entry"
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        className="btn btn-primary fixed bottom-24 right-5 z-30 h-14 w-14 !min-h-14 rounded-full !p-0 sm:bottom-8"
      >
        <Plus className="h-6 w-6" />
      </button>

      <TransactionFormModal
        open={formOpen}
        transaction={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete entry?"
        message={`Delete ${deleteTarget?.description || "this entry"}? This action cannot be undone.`}
        busy={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />

      {budgetCategory ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5 backdrop-blur-[4px]"
          role="presentation"
          onClick={() => !savingBudget && setBudgetCategory(null)}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Set monthly budget"
            onClick={(e) => e.stopPropagation()}
            className="animate-scale-in w-full max-w-sm rounded-3xl bg-surface p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-text-primary">
              {moneyCategory(budgetCategory).label} budget
            </h2>
            <p className="mt-1 text-sm text-text-secondary">Set a monthly spending limit.</p>
            <input
              type="number"
              min="0"
              step="1"
              autoFocus
              className="input-field mt-4 !min-h-[52px]"
              placeholder="e.g., 5000"
              value={budgetValue}
              onChange={(e) => setBudgetValue(e.target.value)}
            />
            <div className="mt-5 flex gap-3">
              <button
                className="btn btn-secondary flex-1"
                onClick={() => setBudgetCategory(null)}
                disabled={savingBudget}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary flex-1"
                onClick={() => void saveBudget()}
                disabled={savingBudget}
              >
                {savingBudget ? "Saving…" : "Save budget"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
        </>
      )}
    </section>
  );
}
