import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
  ReceiptText,
  RefreshCw,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatAmount, formatAmountShort, displayName } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";
import { byUrgency, toViews, type OccurrenceView } from "@/lib/occurrences";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/hooks/useFinance";
import { BillCard } from "@/components/BillCard";
import { BillDetailsModal } from "@/components/BillDetailsModal";
import { BillFormModal, type BillInput } from "@/components/BillFormModal";
import { BottomNav } from "@/components/BottomNav";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import { UserMenu } from "@/components/UserMenu";
import { AddChoiceSheet } from "@/components/AddChoiceSheet";
import { SpendsDashboard } from "@/components/spends/SpendsDashboard";
import { SpendFormModal } from "@/components/spends/SpendFormModal";
import type { Bill, Spend } from "@/types/database";
import type { SpendInput } from "@/lib/spends.functions";

export function HomePage() {
  const { user } = useAuth();
  const finance = useFinance();
  const { snapshot, today, loading, error, reload, actions } = finance;

  // Top-level Navigation: "bills" = existing Bills dashboard, "spends" = dedicated Spends dashboard
  const [activeTab, setActiveTab] = useState<"bills" | "spends">("bills");

  // In-page Bills View filter: "remaining" = unpaid/due bills, "completed" = paid/settled bills
  const [billsFilter, setBillsFilter] = useState<"remaining" | "completed">("remaining");

  // Spends State
  const [selectedSpendDate, setSelectedSpendDate] = useState<string>(today);
  const [spendModalOpen, setSpendModalOpen] = useState(false);
  const [editingSpend, setEditingSpend] = useState<Spend | null>(null);
  const [deleteSpendTarget, setDeleteSpendTarget] = useState<Spend | null>(null);

  // Modals & Action Targets
  const [choiceSheetOpen, setChoiceSheetOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<OccurrenceView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OccurrenceView | null>(null);
  const [working, setWorking] = useState(false);

  // Authenticated User Greeting: Use actual saved name, fallback to "there"
  const profileName = snapshot.profile?.full_name?.trim();
  const userName = profileName || "there";

  // Spends for selected date (derived authoritatively from snapshot.spends or transactions fallback)
  const dateSpends = useMemo<Spend[]>(() => {
    const allSpends: Spend[] =
      snapshot.spends && snapshot.spends.length > 0
        ? snapshot.spends
        : (snapshot.transactions || [])
            .filter((t: any) => t.type === "expense")
            .map((t: any) => ({
              id: t.id,
              user_id: t.user_id,
              name: t.description || t.category || "Expense",
              amount: Number(t.amount) || 0,
              spend_date: t.date,
              notes: t.notes ?? null,
              created_at: t.created_at,
            }));

    return allSpends
      .filter((s) => s.spend_date === selectedSpendDate)
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [snapshot.spends, snapshot.transactions, selectedSpendDate]);

  // Bill occurrence views
  const views = useMemo(() => toViews(snapshot.occurrences, today), [snapshot.occurrences, today]);

  const billsById = useMemo(() => {
    const map = new Map<string, Bill>();
    for (const b of snapshot.bills) map.set(b.id, b as unknown as Bill);
    return map;
  }, [snapshot.bills]);

  // Clean recurring bill management: display one primary bill card for each
  // recurring bill series on the dashboard (the next upcoming/active occurrence)
  const primaryRemainingOccurrences = useMemo(() => {
    const sorted = [...views.filter((o) => !o.isSettled)].sort(byUrgency);
    const seenBills = new Set<string>();
    const result: OccurrenceView[] = [];

    for (const occ of sorted) {
      if (!occ.isRecurring) {
        result.push(occ);
      } else {
        if (!seenBills.has(occ.billId)) {
          seenBills.add(occ.billId);
          result.push(occ);
        }
      }
    }
    return result;
  }, [views]);

  // Financial Summary calculations (safe numeric handling on primary upcoming bills)
  const remainingAmount = useMemo(
    () =>
      primaryRemainingOccurrences.reduce(
        (sum, o) => sum + (Number.isFinite(o.amount) ? o.amount : 0),
        0,
      ),
    [primaryRemainingOccurrences],
  );
  const remainingCount = primaryRemainingOccurrences.length;

  const completedOccurrences = useMemo(() => views.filter((o) => o.isSettled), [views]);
  const completedAmount = useMemo(
    () =>
      completedOccurrences.reduce((sum, o) => sum + (Number.isFinite(o.amount) ? o.amount : 0), 0),
    [completedOccurrences],
  );
  const completedCount = completedOccurrences.length;

  // Filtered and Sorted Bill List (Controlled by in-page Bills filter)
  const displayedBills = useMemo(() => {
    if (billsFilter === "completed") {
      // Completed bills sorted most recent payment or date first
      return [...completedOccurrences].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    }
    // All primary outstanding bills sorted strictly by urgency/due date
    return [...primaryRemainingOccurrences].sort(byUrgency);
  }, [billsFilter, completedOccurrences, primaryRemainingOccurrences]);

  // Handlers for Bill operations
  const handleSubmitBill = async (values: BillInput) => {
    try {
      if (editing) {
        await actions.updateBill({ ...values, id: editing.id });
        toast.success("Bill updated successfully");
      } else {
        await actions.createBill(values);
        toast.success("Bill added successfully");
      }
      setEditing(null);
      setFormOpen(false);
    } catch (e) {
      toast.error(toUserMessage(e));
      throw e;
    }
  };

  const handleMarkCompleted = async (occurrence: OccurrenceView) => {
    if (working) return;
    try {
      setWorking(true);
      // Close details modal right away for instant feedback
      setDetailsTarget(null);
      await actions.recordPayment({
        occurrence_id: occurrence.id,
        amount: occurrence.amount,
        paid_on: today,
        payment_method: "other",
      });
      toast.success(`${occurrence.title} marked as completed`);
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteBill = async () => {
    if (!deleteTarget || working) return;
    setWorking(true);
    try {
      await actions.deleteBill(deleteTarget.billId);
      toast.success("Bill deleted successfully");
      setDeleteTarget(null);
      if (detailsTarget?.id === deleteTarget.id) {
        setDetailsTarget(null);
      }
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setWorking(false);
    }
  };

  // Handlers for Spend operations
  const handleSubmitSpend = async (values: SpendInput) => {
    try {
      if (editingSpend) {
        await actions.updateSpend({ ...values, id: editingSpend.id });
        toast.success("Spend updated successfully");
      } else {
        await actions.createSpend(values);
        toast.success("Spend added successfully");
      }
      // If the saved expense has a different date, switch to that date to display it
      if (values.spend_date && values.spend_date !== selectedSpendDate) {
        setSelectedSpendDate(values.spend_date);
      }
      setEditingSpend(null);
      setSpendModalOpen(false);
    } catch (e) {
      toast.error(toUserMessage(e));
      throw e;
    }
  };

  const handleDeleteSpend = async () => {
    if (!deleteSpendTarget || working) return;
    setWorking(true);
    try {
      await actions.deleteSpend(deleteSpendTarget.id);
      toast.success("Spend deleted successfully");
      setDeleteSpendTarget(null);
    } catch (e) {
      toast.error(toUserMessage(e));
    } finally {
      setWorking(false);
    }
  };

  return (
    <section className="flex flex-col gap-4 w-full" aria-label="BillBuddy Home">
      {/* ==================================================================== */}
      {/* SECTION A — HEADER & GREETING                                         */}
      {/* ==================================================================== */}
      <header className="flex items-center justify-between pt-2 pb-1">
        <div className="flex items-center gap-2.5">
          {/* BillBuddy Brand Mascot */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-200/60 overflow-hidden p-1">
            <img
              src="/billbuddy-icon.png"
              alt="BillBuddy"
              className="h-full w-full object-contain animate-gentle-float"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold tracking-wider uppercase text-blue-600">
                BillBuddy
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-tight">
                {profileName ? `Hi, ${profileName}` : "Hi there"}
              </h1>
              {!profileName && (
                <button
                  type="button"
                  onClick={() => {
                    const btn = document.querySelector<HTMLButtonElement>(
                      'button[aria-label="User account menu"]',
                    );
                    btn?.click();
                  }}
                  className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 px-2 py-0.5 rounded-full transition-colors cursor-pointer"
                  title="Click to set your display name"
                >
                  + Add name
                </button>
              )}
            </div>
          </div>
        </div>

        {/* User Account / Theme Toggle */}
        <div className="flex items-center gap-2">
          <UserMenu />
        </div>
      </header>

      {/* ==================================================================== */}
      {/* SECTION VIEW RENDERING (BILLS vs SPENDS VIA BOTTOM NAV ONLY)         */}
      {/* ==================================================================== */}
      {activeTab === "bills" ? (
        <div
          id="bills-panel"
          role="tabpanel"
          aria-label="Bills Section"
          className="flex flex-col gap-4 animate-fade-in"
        >
          {/* ==================================================================== */}
          {/* SECTION B — COMPACT MONEY SUMMARY CONTAINER                           */}
          {/* ==================================================================== */}
          <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-white/90 shadow-[0_10px_30px_-8px_rgba(15,39,66,0.06)] relative overflow-hidden">
            {/* Subtle decorative glow */}
            <div
              className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blue-400/10 blur-2xl pointer-events-none"
              aria-hidden="true"
            />

            <div className="grid grid-cols-2 divide-x divide-slate-200/80">
              {/* Remaining (Outstanding) Column - Interactive */}
              <button
                type="button"
                onClick={() => setBillsFilter("remaining")}
                className={`text-left pr-3 sm:pr-4 rounded-2xl p-1.5 -m-1.5 transition-all cursor-pointer ${
                  billsFilter === "remaining"
                    ? "bg-blue-50/70 ring-1 ring-blue-200/60"
                    : "hover:bg-slate-50/60"
                }`}
                aria-label="Filter Remaining Bills"
                aria-pressed={billsFilter === "remaining"}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                    <Clock className="h-3 w-3 stroke-[2.5]" />
                  </span>
                  <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                    Remaining
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-slate-900">
                  {formatAmount(remainingAmount)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {remainingCount} {remainingCount === 1 ? "bill" : "bills"} due
                </p>
              </button>

              {/* Completed Column - Interactive */}
              <button
                type="button"
                onClick={() => setBillsFilter("completed")}
                className={`text-left pl-3 sm:pr-2 sm:pl-4 rounded-2xl p-1.5 -my-1.5 -mr-1.5 transition-all cursor-pointer ${
                  billsFilter === "completed"
                    ? "bg-emerald-50/70 ring-1 ring-emerald-200/60"
                    : "hover:bg-slate-50/60"
                }`}
                aria-label="Filter Completed Bills"
                aria-pressed={billsFilter === "completed"}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3 stroke-[2.5]" />
                  </span>
                  <span className="text-[11px] font-semibold tracking-wide uppercase text-slate-500">
                    Completed
                  </span>
                </div>
                <p className="text-xl sm:text-2xl font-bold tracking-tight tabular-nums text-slate-900">
                  {formatAmount(completedAmount)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">
                  {completedCount} {completedCount === 1 ? "bill" : "bills"} paid
                </p>
              </button>
            </div>
          </div>

          {/* ==================================================================== */}
          {/* SECTION B.2 — IN-PAGE REMAINING & COMPLETED CONTROLS                  */}
          {/* ==================================================================== */}
          <div
            className="relative flex items-center p-2 rounded-full glass-nav bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/80 dark:border-slate-800/80 shadow-[0_16px_40px_-6px_rgba(15,35,75,0.18)] gap-2 select-none"
            role="tablist"
            aria-label="Bill status filter"
          >
            {/* Active sliding glossy gradient pill (identical to navbar 3D gradient treatment) */}
            <div
              className={`absolute top-2 bottom-2 w-[calc(50%-0.75rem)] rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 shadow-[0_10px_25px_-4px_rgba(79,70,229,0.5),0_4px_10px_-2px_rgba(37,99,235,0.35)] border border-white/30 transition-transform duration-250 ease-out pointer-events-none motion-reduce:transition-none ${
                billsFilter === "remaining"
                  ? "left-2 translate-x-0"
                  : "left-2 translate-x-[calc(100%+0.5rem)]"
              }`}
              aria-hidden="true"
            >
              {/* Glossy top reflection highlight */}
              <span
                className="absolute inset-x-3 top-0.5 h-3 rounded-full bg-gradient-to-b from-white/35 to-transparent pointer-events-none"
                aria-hidden="true"
              />
            </div>

            {/* REMAINING TAB */}
            <button
              type="button"
              role="tab"
              aria-selected={billsFilter === "remaining"}
              onClick={() => setBillsFilter("remaining")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full min-h-[44px] text-xs sm:text-[13px] font-semibold tracking-tight transition-colors duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 active:scale-[0.98] ${
                billsFilter === "remaining"
                  ? "text-white font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
              }`}
            >
              <Clock
                className={`w-[18px] h-[18px] stroke-[2.3] shrink-0 transition-transform duration-200 ${
                  billsFilter === "remaining" ? "scale-105 text-white" : "opacity-80"
                }`}
              />
              <span className="truncate">Remaining</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all shrink-0 ${
                  billsFilter === "remaining"
                    ? "bg-white/25 text-white border border-white/30 backdrop-blur-xs shadow-xs"
                    : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/50"
                }`}
              >
                {remainingCount}
              </span>
            </button>

            {/* COMPLETED TAB */}
            <button
              type="button"
              role="tab"
              aria-selected={billsFilter === "completed"}
              onClick={() => setBillsFilter("completed")}
              className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-full min-h-[44px] text-xs sm:text-[13px] font-semibold tracking-tight transition-colors duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/70 focus-visible:ring-offset-2 active:scale-[0.98] ${
                billsFilter === "completed"
                  ? "text-white font-bold"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
              }`}
            >
              <CheckCircle2
                className={`w-[18px] h-[18px] stroke-[2.3] shrink-0 transition-transform duration-200 ${
                  billsFilter === "completed" ? "scale-105 text-white" : "opacity-80"
                }`}
              />
              <span className="truncate">Completed</span>
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full font-bold transition-all shrink-0 ${
                  billsFilter === "completed"
                    ? "bg-white/25 text-white border border-white/30 backdrop-blur-xs shadow-xs"
                    : "bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/40 dark:border-slate-700/50"
                }`}
              >
                {completedCount}
              </span>
            </button>
          </div>

          {/* ==================================================================== */}
          {/* SECTION C — MAIN BILL LIST                                           */}
          {/* ==================================================================== */}
          <div className="flex flex-col gap-2.5 mt-0.5">
            {/* List Header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-slate-900">
                  {billsFilter === "completed" ? "Completed Bills" : "Remaining Bills"}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
                  {displayedBills.length}
                </span>
              </div>
            </div>

            {/* Error State Banner */}
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error || "Unable to refresh bills."}</span>
                </div>
                <button
                  type="button"
                  onClick={() => reload()}
                  className="px-2 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-800 font-semibold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Loading Skeletons */}
            {loading && <BillListSkeleton />}

            {/* Empty State */}
            {!loading && displayedBills.length === 0 && (
              <div className="glass-card rounded-3xl p-8 border border-white/80 text-center flex flex-col items-center justify-center my-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3">
                  <Calendar className="h-6 w-6 stroke-[1.8]" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1">
                  {billsFilter === "completed"
                    ? "No completed bills yet"
                    : "No remaining bills due"}
                </h3>
                <p className="text-xs text-slate-500 max-w-xs mb-4">
                  {billsFilter === "completed"
                    ? "Bills you mark as completed will appear here for your records."
                    : "Add your electricity, internet, rent, or credit card bills to receive timely reminders."}
                </p>
                {billsFilter === "remaining" && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setFormOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition-transform active:scale-95 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 stroke-[2.5]" />
                    <span>Add Your First Bill</span>
                  </button>
                )}
              </div>
            )}

            {/* Bill Rows */}
            {!loading && displayedBills.length > 0 && (
              <div className="flex flex-col gap-2.5">
                {displayedBills.map((occurrence, index) => (
                  <BillCard
                    key={occurrence.id}
                    index={index}
                    occurrence={occurrence}
                    today={today}
                    onSelect={(o) => setDetailsTarget(o)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div id="spends-panel" role="tabpanel" aria-label="Spends Section">
          <SpendsDashboard
            selectedDate={selectedSpendDate}
            onDateChange={(d) => setSelectedSpendDate(d)}
            today={today}
            spends={dateSpends}
            loading={loading}
            onAddSpend={() => {
              setEditingSpend(null);
              setSpendModalOpen(true);
            }}
            onEditSpend={(spend) => {
              setEditingSpend(spend);
              setSpendModalOpen(true);
            }}
            onDeleteSpend={(spend) => setDeleteSpendTarget(spend)}
          />
        </div>
      )}

      {/* ==================================================================== */}
      {/* SECTION D — FIXED BOTTOM NAVIGATION (EXACTLY THREE ACTIONS)           */}
      {/* ==================================================================== */}
      <BottomNav
        activeSection={activeTab}
        onSelectSection={(section) => setActiveTab(section)}
        onOpenAddChoice={() => setChoiceSheetOpen(true)}
      />

      {/* ==================================================================== */}
      {/* MODALS & OVERLAYS                                                    */}
      {/* ==================================================================== */}
      {/* Bill Details Bottom Sheet / Modal */}
      <BillDetailsModal
        open={!!detailsTarget}
        occurrence={detailsTarget}
        bill={detailsTarget ? billsById.get(detailsTarget.billId) : null}
        today={today}
        working={working}
        onClose={() => setDetailsTarget(null)}
        onPay={(o) => void handleMarkCompleted(o)}
        onEdit={(b) => {
          setDetailsTarget(null);
          setEditing(b);
          setFormOpen(true);
        }}
        onDelete={(o) => {
          setDetailsTarget(null);
          setDeleteTarget(o);
        }}
      />

      {/* Add / Edit Bill Form Modal */}
      <BillFormModal
        open={formOpen}
        bill={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmitBill}
      />

      {/* Permanent Delete Confirmation Dialog for Bills */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete bill?"
        message={`Are you sure you want to delete ${deleteTarget?.title ?? "this bill"}? All pending reminders will be cancelled.`}
        busy={working}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteBill()}
      />

      {/* Add Action Choice Sheet: Add Bill vs Add Spend */}
      <AddChoiceSheet
        open={choiceSheetOpen}
        onClose={() => setChoiceSheetOpen(false)}
        onSelectAddBill={() => {
          setActiveTab("bills");
          setEditing(null);
          setFormOpen(true);
        }}
        onSelectAddSpend={() => {
          setActiveTab("spends");
          setEditingSpend(null);
          setSpendModalOpen(true);
        }}
      />

      {/* Add / Edit Spend Form Modal */}
      <SpendFormModal
        open={spendModalOpen}
        spend={editingSpend}
        defaultDate={selectedSpendDate}
        today={today}
        onClose={() => {
          setSpendModalOpen(false);
          setEditingSpend(null);
        }}
        onSubmit={handleSubmitSpend}
      />

      {/* Permanent Delete Confirmation Dialog for Spends */}
      <ConfirmDialog
        open={!!deleteSpendTarget}
        title="Delete spend?"
        message={`Are you sure you want to delete ${deleteSpendTarget?.name ?? "this spend"} of ₹${deleteSpendTarget?.amount ?? 0}?`}
        busy={working}
        onCancel={() => setDeleteSpendTarget(null)}
        onConfirm={() => void handleDeleteSpend()}
      />
    </section>
  );
}
