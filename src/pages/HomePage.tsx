import { useMemo, useState } from "react";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Plus,
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
import type { Bill } from "@/types/database";

export function HomePage() {
  const { user } = useAuth();
  const finance = useFinance();
  const { snapshot, today, loading, error, reload, actions } = finance;

  // View state: "home" = default outstanding list, "completed" = completed view, "remaining" = remaining view
  const [activeView, setActiveView] = useState<"home" | "completed" | "remaining">("home");

  // Modals & Action Targets
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Bill | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<OccurrenceView | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OccurrenceView | null>(null);
  const [working, setWorking] = useState(false);

  // Authenticated User Greeting: Use actual saved name, fallback to "there"
  const profileName = snapshot.profile?.full_name?.trim();
  const userName = profileName || "there";

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

  // Filtered and Sorted Bill List
  const displayedBills = useMemo(() => {
    if (activeView === "completed") {
      // Completed bills sorted most recent payment or date first
      return [...completedOccurrences].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
    }
    if (activeView === "remaining") {
      // All primary outstanding bills sorted strictly by urgency/due date
      return [...primaryRemainingOccurrences].sort(byUrgency);
    }
    // Default home list: Outstanding primary bills (one per recurring series)
    return [...primaryRemainingOccurrences].sort(byUrgency);
  }, [activeView, completedOccurrences, primaryRemainingOccurrences]);

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

  return (
    <section className="flex flex-col gap-4 w-full" aria-label="BillBuddy Home">
      {/* ==================================================================== */}
      {/* SECTION A — HEADER & GREETING                                         */}
      {/* ==================================================================== */}
      <header className="flex items-center justify-between pt-2 pb-1">
        <div className="flex items-center gap-2.5">
          {/* BillBuddy Brand Symbol */}
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md shadow-blue-500/20">
            <Wallet className="h-5 w-5 stroke-[2.3]" />
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
      {/* SECTION B — COMPACT MONEY SUMMARY CONTAINER                           */}
      {/* ==================================================================== */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-white/90 shadow-[0_10px_30px_-8px_rgba(15,39,66,0.06)] relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div
          className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-blue-400/10 blur-2xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="grid grid-cols-2 divide-x divide-slate-200/80">
          {/* Remaining (Outstanding) Column */}
          <div className="pr-3 sm:pr-4">
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
          </div>

          {/* Completed Column */}
          <div className="pl-3 sm:pr-2 sm:pl-4">
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
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* SECTION C — MAIN BILL LIST & IN-PLACE VIEW FILTER                     */}
      {/* ==================================================================== */}
      <div className="flex flex-col gap-2.5 mt-1">
        {/* List Header and Active Filter Pill */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              {activeView === "completed"
                ? "Completed Bills"
                : activeView === "remaining"
                  ? "Remaining Bills"
                  : "Upcoming Bills"}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
              {displayedBills.length}
            </span>
          </div>

          {/* If filtering by Completed or Remaining, show quick "Back to all" return button */}
          {activeView !== "home" && (
            <button
              type="button"
              onClick={() => setActiveView("home")}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100/70 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
              <span>Back to all</span>
            </button>
          )}
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
              {activeView === "completed"
                ? "No completed bills yet"
                : activeView === "remaining"
                  ? "No remaining bills due"
                  : "No bills scheduled"}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4">
              {activeView === "completed"
                ? "Bills you mark as completed will appear here for your records."
                : "Add your electricity, internet, rent, or credit card bills to receive timely reminders."}
            </p>
            {activeView === "home" && (
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

      {/* ==================================================================== */}
      {/* SECTION D — FIXED BOTTOM NAVIGATION (EXACTLY THREE ACTIONS)           */}
      {/* ==================================================================== */}
      <BottomNav
        activeView={activeView}
        onSelectView={(view) => setActiveView(view)}
        onAddBill={() => {
          setEditing(null);
          setFormOpen(true);
        }}
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

      {/* Permanent Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete bill?"
        message={`Are you sure you want to delete ${deleteTarget?.title ?? "this bill"}? All pending reminders will be cancelled.`}
        busy={working}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDeleteBill()}
      />
    </section>
  );
}
