import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Calendar,
  CreditCard,
  Eye,
  EyeOff,
  Plus,
  Receipt,
  Search,
  SearchX,
  Wallet,
  X,
  type LucideIcon,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { formatAmountShort, greeting, displayName } from "@/lib/format";
import { addDays } from "@/lib/money";
import { toUserMessage } from "@/lib/errors";
import { matchesSearch, relevantOccurrences, type OccurrenceView } from "@/lib/occurrences";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/hooks/useFinance";
import { BillCard } from "@/components/BillCard";
import { BillFormModal, type BillInput } from "@/components/BillFormModal";
import { PaymentModal } from "@/components/PaymentModal";
import {
  TransactionFormModal,
  type EntryType,
  type TransactionInput,
} from "@/components/TransactionFormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import type { Bill } from "@/types/database";
import type { PaymentInput } from "@/lib/bills.functions";

type FilterKey = "all" | "upcoming" | "overdue" | "paid";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const finance = useFinance();
  const { snapshot, today, loading, error, reload, actions } = finance;

  const [online, setOnline] = useState(true);
  const [hideBalance, setHideBalance] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [txOpen, setTxOpen] = useState(false);
  const [txType, setTxType] = useState<EntryType>("expense");
  const [payTarget, setPayTarget] = useState<OccurrenceView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OccurrenceView | null>(null);
  const [skipTarget, setSkipTarget] = useState<OccurrenceView | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const weekEnd = addDays(today, 7);

  const listed = useMemo(
    () =>
      relevantOccurrences(finance.occurrences, today, {
        horizon: addDays(today, 45),
        settledSince: addDays(today, -45),
      }),
    [finance.occurrences, today],
  );

  const upcomingBills = useMemo(
    () => listed.filter((o) => !o.isSettled),
    [listed],
  );

  const counts = useMemo(
    () => ({
      all: listed.length,
      upcoming: listed.filter((o) => !o.isSettled).length,
      overdue: listed.filter((o) => o.status === "overdue").length,
      paid: listed.filter((o) => o.storedStatus === "paid").length,
    }),
    [listed],
  );

  const visible = useMemo(
    () =>
      listed.filter((o) => {
        if (filter === "overdue" && o.status !== "overdue") return false;
        if (filter === "paid" && o.storedStatus !== "paid") return false;
        if (filter === "upcoming" && o.isSettled) return false;
        return true;
      }),
    [listed, filter],
  );

  const billsById = useMemo(
    () => new Map(snapshot.bills.map((b) => [b.id, b as unknown as Bill])),
    [snapshot.bills],
  );

  const copyUpi = useCallback((upi: string) => {
    void navigator.clipboard?.writeText(upi);
    toast.success("UPI ID copied");
  }, []);

  const handleSubmit = async (values: BillInput) => {
    if (editing) {
      await actions.updateBill({ id: editing.id, ...values });
      toast.success("Bill updated");
    } else {
      await actions.createBill(values);
      toast.success("Bill added");
    }
  };

  const handleTransaction = async (values: TransactionInput) => {
    await actions.createTransaction({
      type: values.type,
      amount: Number(values.amount),
      category: values.category,
      description: values.description ?? null,
      date: values.date,
      payment_method: values.payment_method,
      notes: values.notes ?? null,
      client_request_id: values.client_request_id,
    });
    toast.success(values.type === "income" ? "Income added" : "Expense added");
  };

  const handleDelete = async () => {
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

  const handleSkip = async () => {
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

  const handlePay = async (input: PaymentInput) => {
    await actions.recordPayment(input);
    toast.success("Payment recorded");
  };

  const name = displayName(user?.email);
  const { totals, spend } = finance;
  const balanceDisplay = totals.available;

  return (
    <section className="animate-fade-in space-y-6 pb-20 sm:pb-8">
      {/* Offline Alert */}
      {!online ? (
        <div role="alert" className="card flex items-center justify-between gap-3 p-3.5 bg-rose-50 border-rose-200 text-rose-800">
          <p className="text-xs font-medium">Connection lost. Operating in offline mode.</p>
          <button className="btn btn-secondary !min-h-8 !px-3 !text-xs" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {/* Top Header matching Phase 1 Screen 2 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary font-bold text-lg shadow-xs">
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-base font-bold text-text-primary leading-tight">
              Hi {name}! 👋
            </h1>
            <p className="text-xs text-text-secondary">Welcome back!</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search Button */}
          <button
            type="button"
            onClick={() => setSearchModalOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border-light bg-surface text-text-secondary shadow-xs hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
            aria-label="Search"
          >
            <Search className="h-4.5 w-4.5" />
          </button>

          {/* Notifications Button */}
          <Link
            to="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-2xl border border-border-light bg-surface text-text-secondary shadow-xs hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-2 right-2 flex h-2 w-2 rounded-full bg-rose-500 ring-2 ring-surface" />
          </Link>
        </div>
      </div>

      {/* Hero Financial Card: Vibrant Indigo/Violet Gradient matching Phase 1 Screen 2 */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#4F46E5] via-[#5B4DFF] to-[#7C3AED] p-6 text-white shadow-xl shadow-indigo-500/25">
        {/* Subtle decorative glow */}
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-purple-400/20 blur-2xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-indigo-100 uppercase">
              Total Balance
            </span>
            <button
              type="button"
              onClick={() => setHideBalance(!hideBalance)}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors cursor-pointer"
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
            >
              {hideBalance ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div className="mt-2">
            <p className="text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums">
              {hideBalance ? "₹••••••" : formatAmountShort(balanceDisplay)}
            </p>
          </div>

          {/* Income & Expense Summary Capsules */}
          <div className="mt-5 grid grid-cols-2 gap-3 pt-4 border-t border-white/15">
            <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 backdrop-blur-xs p-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300">
                <ArrowDownLeft className="h-4 w-4 stroke-[2.5]" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-indigo-100">Income</p>
                <p className="text-sm font-bold text-white tabular-nums truncate">
                  {hideBalance ? "••••" : `+${formatAmountShort(totals.monthIncome)}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 rounded-2xl bg-white/10 backdrop-blur-xs p-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-400/20 text-rose-300">
                <ArrowUpRight className="h-4 w-4 stroke-[2.5]" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-indigo-100">Expense</p>
                <p className="text-sm font-bold text-white tabular-nums truncate">
                  {hideBalance ? "••••" : `-${formatAmountShort(totals.monthSpending)}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions Row */}
      <div className="grid grid-cols-4 gap-2.5">
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border-light/80 bg-surface p-3 text-center transition-all hover:scale-102 hover:border-primary/50 shadow-xs cursor-pointer"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600">
            <Calendar className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold text-text-primary">Add Bill</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setTxType("expense");
            setTxOpen(true);
          }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border-light/80 bg-surface p-3 text-center transition-all hover:scale-102 hover:border-primary/50 shadow-xs cursor-pointer"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-600">
            <CreditCard className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold text-text-primary">Add Expense</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setTxType("income");
            setTxOpen(true);
          }}
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border-light/80 bg-surface p-3 text-center transition-all hover:scale-102 hover:border-primary/50 shadow-xs cursor-pointer"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600">
            <Wallet className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold text-text-primary">Add Income</span>
        </button>

        <Link
          to="/goals"
          className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-border-light/80 bg-surface p-3 text-center transition-all hover:scale-102 hover:border-primary/50 shadow-xs cursor-pointer"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-600">
            <Sparkles className="h-5 w-5" />
          </span>
          <span className="text-[11px] font-semibold text-text-primary">Goals</span>
        </Link>
      </div>

      {/* Upcoming Bills Section matching Phase 1 Screen 2 */}
      <div>
        <div className="flex items-center justify-between mb-3 px-0.5">
          <div>
            <h2 className="text-base font-bold text-text-primary">Upcoming Bills</h2>
            <p className="text-xs text-text-secondary">
              {counts.upcoming} scheduled {counts.upcoming === 1 ? "bill" : "bills"}
            </p>
          </div>
          <Link
            to="/bills"
            className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
          >
            See All <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <BillListSkeleton />
        ) : upcomingBills.length === 0 ? (
          <div className="rounded-3xl border border-border-light/80 bg-surface p-6 text-center shadow-xs">
            <Receipt className="mx-auto h-9 w-9 text-text-tertiary/40 mb-2" />
            <p className="text-sm font-semibold text-text-primary">No upcoming bills</p>
            <p className="text-xs text-text-tertiary mt-0.5">
              You are all caught up on scheduled bills!
            </p>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="mt-3.5 btn btn-primary !min-h-9 !text-xs !px-3.5"
            >
              <Plus className="h-3.5 w-3.5" /> Add Bill
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcomingBills.slice(0, 4).map((occurrence) => (
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
          </div>
        )}
      </div>

      {/* Monthly Budget Spending Progress matching Phase 1 & 5 */}
      <div className="rounded-3xl border border-border-light/80 bg-surface p-5 shadow-xs">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-text-secondary">Monthly Budget</span>
          <span className="font-bold text-text-primary">
            {formatAmountShort(totals.monthSpending)} / {formatAmountShort(totals.monthlyBudgetLimit || 15000)}
          </span>
        </div>
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-indigo-500 to-primary"
            style={{
              width: `${Math.min(100, Math.max(15, totals.monthlyBudgetLimit > 0 ? (totals.monthSpending / totals.monthlyBudgetLimit) * 100 : 35))}%`,
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-text-tertiary">
          <span>Safe to spend: {formatAmountShort(spend.safeToSpend)}</span>
          <Link to="/money" className="font-medium text-primary hover:underline">
            Manage Budget →
          </Link>
        </div>
      </div>

      {/* Recent Transactions Section matching Phase 1 & 4 */}
      {snapshot.transactions && snapshot.transactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3 px-0.5">
            <div>
              <h2 className="text-base font-bold text-text-primary">Recent Transactions</h2>
              <p className="text-xs text-text-secondary">Your latest income & expenses</p>
            </div>
            <Link
              to="/transactions"
              className="flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              See All <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="card divide-y divide-border-light/70 overflow-hidden shadow-xs">
            {snapshot.transactions.slice(0, 5).map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3.5 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                      tx.type === "income"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-rose-500/15 text-rose-600"
                    }`}
                  >
                    {tx.type === "income" ? (
                      <ArrowDownLeft className="h-5 w-5" />
                    ) : (
                      <ArrowUpRight className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">
                      {tx.description || tx.category}
                    </p>
                    <p className="text-[11px] text-text-secondary capitalize">
                      {tx.date} · {tx.category}
                    </p>
                  </div>
                </div>
                <p
                  className={`text-xs font-bold tabular-nums ml-3 shrink-0 ${
                    tx.type === "income" ? "text-emerald-600" : "text-text-primary"
                  }`}
                >
                  {tx.type === "income" ? "+" : "-"}
                  {formatAmountShort(Number(tx.amount))}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modals & Dialogs */}
      <GlobalSearchModal
        open={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
      />

      <BillFormModal
        open={formOpen}
        bill={editing}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <TransactionFormModal
        open={txOpen}
        initialType={txType}
        onClose={() => setTxOpen(false)}
        onSubmit={handleTransaction}
      />

      <PaymentModal
        occurrence={payTarget}
        safeToSpend={spend.safeToSpend}
        today={today}
        onClose={() => setPayTarget(null)}
        onConfirm={handlePay}
        onCopyUpi={copyUpi}
        onSettled={finance.reload}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete bill?"
        message={`This removes ${deleteTarget?.title ?? "this bill"} and all of its scheduled instalments. Bills with recorded payments can't be deleted.`}
        busy={working}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDialog
        open={!!skipTarget}
        title="Skip this instalment?"
        message={`${skipTarget?.title ?? "This bill"} for ${skipTarget?.dueDate ?? ""} will be marked as skipped and left out of your totals. Future instalments are unaffected.`}
        busy={working}
        onCancel={() => setSkipTarget(null)}
        onConfirm={() => void handleSkip()}
      />
    </section>
  );
}
