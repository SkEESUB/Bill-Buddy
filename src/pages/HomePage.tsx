import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  BarChart3,
  ClipboardList,
  Plus,
  Search,
  SearchX,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatAmountShort, greeting, displayName } from "@/lib/format";
import { addDays } from "@/lib/money";
import { toUserMessage } from "@/lib/errors";
import { matchesSearch, relevantOccurrences, type OccurrenceView } from "@/lib/occurrences";
import { useAuth } from "@/hooks/useAuth";
import { useDebounced } from "@/hooks/useDebounced";
import { useFinance } from "@/hooks/useFinance";
import { BillCard } from "@/components/BillCard";
import { BillFormModal, type BillInput } from "@/components/BillFormModal";
import { PaymentModal } from "@/components/PaymentModal";
import { FloatingAddButton } from "@/components/FloatingAddButton";
import {
  TransactionFormModal,
  type EntryType,
  type TransactionInput,
} from "@/components/TransactionFormModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import type { Bill } from "@/types/database";
import type { PaymentInput } from "@/lib/bills.functions";

type FilterKey = "all" | "overdue" | "week" | "paid";

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const finance = useFinance();
  const { snapshot, today, loading, error, reload, actions } = finance;

  const [online, setOnline] = useState(true);
  const [query, setQuery] = useState("");
  const search = useDebounced(query, 250).trim().toLowerCase();
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

  const counts = useMemo(
    () => ({
      all: listed.length,
      overdue: listed.filter((o) => o.status === "overdue").length,
      week: listed.filter((o) => !o.isSettled && o.dueDate >= today && o.dueDate <= weekEnd).length,
      paid: listed.filter((o) => o.storedStatus === "paid").length,
    }),
    [listed, today, weekEnd],
  );

  const visible = useMemo(
    () =>
      listed.filter((o) => {
        if (filter === "overdue" && o.status !== "overdue") return false;
        if (filter === "paid" && o.storedStatus !== "paid") return false;
        if (filter === "week" && !(!o.isSettled && o.dueDate >= today && o.dueDate <= weekEnd))
          return false;
        return matchesSearch(o, search);
      }),
    [listed, filter, search, today, weekEnd],
  );

  const groups = useMemo(() => {
    const tomorrow = addDays(today, 1);
    const g: Record<"today" | "tomorrow" | "week" | "later" | "settled", OccurrenceView[]> = {
      today: [],
      tomorrow: [],
      week: [],
      later: [],
      settled: [],
    };
    for (const o of visible) {
      if (o.isSettled) g.settled.push(o);
      else if (o.dueDate <= today) g.today.push(o);
      else if (o.dueDate === tomorrow) g.tomorrow.push(o);
      else if (o.dueDate <= weekEnd) g.week.push(o);
      else g.later.push(o);
    }
    return g;
  }, [visible, today, weekEnd]);

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
  const hasBills = finance.occurrences.length > 0;
  const { totals, spend } = finance;

  return (
    <section className="animate-fade-in">
      {!online ? (
        <div role="alert" className="card mb-4 flex items-center justify-between gap-3 p-3">
          <p className="text-sm font-medium text-text-primary">No internet connection</p>
          <button className="btn btn-secondary !min-h-11 !text-xs" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      ) : null}

      {/* Hero */}
      <div className="card relative overflow-hidden rounded-[28px] p-6">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lilac/35 blur-2xl"
        />
        <h1 className="text-[15px] font-semibold text-text-secondary">
          {greeting()}, <span className="text-text-primary">{name}</span>
        </h1>
        <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.14em] text-text-tertiary">
          Safe to spend this month
        </p>
        <p
          className="mt-1 text-[36px] font-extrabold leading-tight tabular-nums"
          style={{ color: spend.safeToSpend < 0 ? "#A73A4C" : "var(--primary)" }}
        >
          {formatAmountShort(spend.safeToSpend)}
        </p>
        <p className="mt-1 text-[13px] text-text-secondary">
          {spend.safeToSpend < 0
            ? `You're ${formatAmountShort(Math.abs(spend.safeToSpend))} short of this month's bills.`
            : `${formatAmountShort(spend.dailySafeSpend)} a day for the rest of the month.`}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-soft-plum p-3">
            <p className="text-xs text-text-secondary">Due this week</p>
            <p className="text-lg font-bold text-text-primary">
              {formatAmountShort(totals.dueThisWeekAmount)}
            </p>
          </div>
          <div
            className="rounded-2xl p-3"
            style={{ backgroundColor: totals.overdueAmount ? "#FCEAED" : "var(--soft-blue)" }}
          >
            <p className="text-xs text-text-secondary">Overdue</p>
            <p
              className="text-lg font-bold"
              style={{ color: totals.overdueAmount ? "#A73A4C" : "var(--text-primary)" }}
            >
              {formatAmountShort(totals.overdueAmount)}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-text-secondary">
            <span>
              {totals.monthlyBudgetLimit > 0 ? "Monthly budget used" : "Spent this month"}
            </span>
            <span className="font-semibold text-text-primary">
              {totals.monthlyBudgetLimit > 0
                ? `${finance.overallBudget.percentageUsed}%`
                : formatAmountShort(totals.monthSpending)}
            </span>
          </div>
          <div
            className="neu-inset mt-1.5 h-2.5 w-full overflow-hidden rounded-full"
            role="progressbar"
            aria-valuenow={finance.overallBudget.percentageUsed}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Monthly budget used"
          >
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, finance.overallBudget.percentageUsed)}%`,
                backgroundColor:
                  finance.overallBudget.status === "over_budget" ? "#C94F62" : "var(--primary)",
              }}
            />
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-4 grid grid-cols-4 gap-3">
        <QuickAction
          icon={Plus}
          label="Add Bill"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
        <QuickAction
          icon={ClipboardList}
          label="Bills"
          onClick={() => void navigate({ to: "/bills" })}
        />
        <QuickAction icon={Wallet} label="Money" onClick={() => void navigate({ to: "/money" })} />
        <QuickAction
          icon={BarChart3}
          label="Insights"
          onClick={() => void navigate({ to: "/analytics" })}
        />
      </div>

      {/* Cash flow */}
      <button
        type="button"
        onClick={() => void navigate({ to: "/money" })}
        className="card mt-4 w-full p-5 text-left transition-shadow hover:shadow-lg"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">
              Available balance
            </p>
            <p className="text-2xl font-bold tabular-nums text-text-primary">
              {formatAmountShort(totals.available)}
            </p>
          </div>
          <span className="text-xs font-semibold text-primary">Open tracker →</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-[#E7F5EF] p-3">
            <p className="text-xs text-[#1F7053]">Income this month</p>
            <p className="text-base font-bold text-[#1F7053]">
              {formatAmountShort(totals.monthIncome)}
            </p>
          </div>
          <div className="rounded-2xl bg-[#FCEAED] p-3">
            <p className="text-xs text-[#A73A4C]">Spent this month</p>
            <p className="text-base font-bold text-[#A73A4C]">
              {formatAmountShort(totals.monthSpending)}
            </p>
          </div>
        </div>
      </button>

      {/* Search + filters */}
      <div className="mt-6">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            className="input-field !min-h-12 pl-10 pr-10"
            placeholder="Search bills..."
            value={query}
            aria-label="Search bills"
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
          <Chip
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={`All (${counts.all})`}
            color="#4B1D3F"
          />
          <Chip
            active={filter === "overdue"}
            onClick={() => setFilter("overdue")}
            label={`Overdue (${counts.overdue})`}
            color="#C94F62"
          />
          <Chip
            active={filter === "week"}
            onClick={() => setFilter("week")}
            label={`This week (${counts.week})`}
            color="#C5822B"
          />
          <Chip
            active={filter === "paid"}
            onClick={() => setFilter("paid")}
            label={`Paid (${counts.paid})`}
            color="#278A63"
          />
        </div>
      </div>

      {/* List */}
      <div id="bill-list" className="mt-5">
        {error ? (
          <div role="alert" className="card p-4">
            <p className="text-sm font-medium text-error">{error}</p>
            <button
              className="btn btn-secondary mt-3 !min-h-10 !text-xs"
              onClick={() => void reload()}
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <BillListSkeleton />
        ) : !hasBills ? (
          <EmptyState
            icon={ClipboardList}
            title="No bills yet"
            subtitle="Tap + to add your first bill and start tracking due dates."
            action={
              <button
                className="btn btn-primary"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Add your first bill
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
            <Group title="Due Today" tone="#C94F62" items={groups.today} render={renderCard} />
            <Group title="Tomorrow" tone="#C5822B" items={groups.tomorrow} render={renderCard} />
            <Group title="This Week" tone="#4B1D3F" items={groups.week} render={renderCard} />
            <Group title="Later" tone="#948590" items={groups.later} render={renderCard} />
            <Group title="Settled" tone="#278A63" items={groups.settled} render={renderCard} />
          </div>
        )}
      </div>

      <FloatingAddButton
        onAddBill={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        onAddTransaction={(type) => {
          setTxType(type);
          setTxOpen(true);
        }}
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

  function renderCard(occurrence: OccurrenceView, index: number) {
    return (
      <div
        key={occurrence.id}
        className="animate-fade-in-up"
        style={{ animationDelay: `${index * 40}ms` }}
      >
        <BillCard
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
      </div>
    );
  }
}

function Group({
  title,
  tone,
  items,
  render,
}: {
  title: string;
  tone: string;
  items: OccurrenceView[];
  render: (occurrence: OccurrenceView, index: number) => React.ReactNode;
}) {
  if (items.length === 0) return null;
  // The dashboard is a summary; the full list lives on the Bills screen.
  const MAX = 10;
  const shown = items.slice(0, MAX);
  return (
    <div>
      <h2
        className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest"
        style={{ color: tone }}
      >
        {title}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-text-secondary">
          {items.length}
        </span>
      </h2>
      <div className="space-y-3">{shown.map(render)}</div>
      {items.length > shown.length ? (
        <Link
          to="/bills"
          className="mt-2 block text-center text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          View all {items.length} in Bills
        </Link>
      ) : null}
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card card-hover neu-press flex min-h-[88px] flex-col items-center justify-center gap-1.5 rounded-[20px] px-1 py-4"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-lilac/55 text-primary">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <span className="text-[12.5px] font-semibold text-text-primary">{label}</span>
    </button>
  );
}

function Chip({
  active,
  label,
  color,
  onClick,
}: {
  active: boolean;
  label: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className="rounded-full px-3.5 py-2 text-xs font-semibold transition-colors"
      style={
        active
          ? { backgroundColor: `${color}1F`, color, border: `2px solid ${color}` }
          : {
              backgroundColor: "var(--muted)",
              color: "var(--text-secondary)",
              border: "2px solid transparent",
            }
      }
    >
      {label}
    </button>
  );
}
