import { useMemo, useRef } from "react";
import {
  Banknote,
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileSpreadsheet,
  Landmark,
  Mail,
  Pencil,
  Plus,
  Smartphone,
  Trash2,
} from "lucide-react";
import { formatAmount, formatDate, shiftDateString } from "@/lib/format";
import type { Spend } from "@/types/database";

interface SpendsDashboardProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  today: string;
  spends: Spend[];
  loading?: boolean;
  onAddSpend: () => void;
  onEditSpend?: (spend: Spend) => void;
  onDeleteSpend?: (spend: Spend) => void;
  onImportStatement?: () => void;
  onOpenAutoTracking?: () => void;
}

function SpendSourceBadge({ source }: { source?: string | null | undefined }) {
  if (!source) return null;
  const s = source.toLowerCase();

  if (s === "cash") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
        <Banknote className="h-2.5 w-2.5 shrink-0 stroke-[2.2]" />
        Cash
      </span>
    );
  }
  if (s === "bank" || s === "upi") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40">
        <Landmark className="h-2.5 w-2.5 shrink-0 stroke-[2.2]" />
        Bank
      </span>
    );
  }
  if (s === "card") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40">
        <CreditCard className="h-2.5 w-2.5 shrink-0 stroke-[2.2]" />
        Card
      </span>
    );
  }
  if (s === "statement") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
        <FileSpreadsheet className="h-2.5 w-2.5 shrink-0 stroke-[2.2]" />
        Statement
      </span>
    );
  }
  if (s === "email") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/40">
        <Mail className="h-2.5 w-2.5 shrink-0 stroke-[2.2]" />
        Email
      </span>
    );
  }
  if (s === "notification") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300 border border-cyan-200/60 dark:border-cyan-800/40">
        <Bell className="h-2.5 w-2.5 shrink-0 stroke-[2.2]" />
        Notification
      </span>
    );
  }
  return null;
}

/**
 * Dedicated Spends Dashboard for BillBuddy.
 * Features:
 *  - Timezone-safe daily date selector with Prev/Next controls and calendar trigger
 *  - Prominent Total Spent summary card with cartoon wallet illustration
 *  - Filtered daily expenses list with name, ₹ amount, notes, edit and delete actions
 *  - Compact daily total summary footer
 *  - Empty state with direct Add Spend CTA
 */
export function SpendsDashboard({
  selectedDate,
  onDateChange,
  today,
  spends,
  loading = false,
  onAddSpend,
  onEditSpend,
  onDeleteSpend,
  onImportStatement,
  onOpenAutoTracking,
}: SpendsDashboardProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Timezone-safe date navigation
  const isToday = selectedDate === today;
  const canGoForward = selectedDate < today;

  const handlePrevDay = () => {
    const prev = shiftDateString(selectedDate, -1);
    onDateChange(prev);
  };

  const handleNextDay = () => {
    if (!canGoForward) return;
    const next = shiftDateString(selectedDate, 1);
    if (next <= today) {
      onDateChange(next);
    }
  };

  const handleDateSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val && val <= today) {
      onDateChange(val);
    }
  };

  // Safe daily calculations derived exclusively from persisted date records
  const dailyTotal = useMemo(() => {
    return spends.reduce((sum, s) => {
      const amt = Number(s.amount);
      return sum + (Number.isFinite(amt) ? amt : 0);
    }, 0);
  }, [spends]);

  const spendsCount = spends.length;

  // Title for the daily list according to selected date
  const listHeading = useMemo(() => {
    if (isToday) return "Today's Spends";
    return `Spends for ${formatDate(selectedDate)}`;
  }, [isToday, selectedDate]);

  return (
    <div className="flex flex-col gap-3.5 w-full animate-fade-in" aria-label="Spends Dashboard">
      {/* ==================================================================== */}
      {/* 3.1 SELECTED-DATE HEADER (DATE SELECTOR)                             */}
      {/* ==================================================================== */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-[0_2px_10px_-2px_rgba(15,35,75,0.05)]">
        {/* Previous Day Arrow */}
        <button
          type="button"
          onClick={handlePrevDay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer active:scale-95"
          aria-label="Previous day"
          title="Previous day"
        >
          <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
        </button>

        {/* Selected Date & Calendar Picker Trigger */}
        <div className="relative flex-1 flex justify-center">
          <button
            type="button"
            onClick={() => {
              try {
                dateInputRef.current?.showPicker();
              } catch {
                dateInputRef.current?.click();
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer group"
            aria-label="Choose specific date"
          >
            <CalendarIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform" />
            <span className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
              {isToday ? `Today, ${formatDate(selectedDate)}` : formatDate(selectedDate)}
            </span>
          </button>

          {/* Hidden native calendar input constrained strictly to <= today */}
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            max={today}
            onChange={handleDateSelect}
            className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
            aria-label="Calendar date picker"
          />
        </div>

        {/* Next Day Arrow (safely disabled when viewing today) */}
        <button
          type="button"
          onClick={handleNextDay}
          disabled={!canGoForward}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            canGoForward
              ? "bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer active:scale-95"
              : "bg-slate-50 dark:bg-slate-800/40 text-slate-300 dark:text-slate-600 cursor-not-allowed opacity-50"
          }`}
          aria-label="Next day"
          title={canGoForward ? "Next day" : "Future dates disabled"}
        >
          <ChevronRight className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 3.2 TOTAL SPENT SUMMARY CARD                                         */}
      {/* ==================================================================== */}
      <div className="glass-panel rounded-3xl p-5 border border-white/90 dark:border-slate-800/90 shadow-[0_10px_30px_-8px_rgba(15,39,66,0.06)] relative overflow-hidden">
        {/* Subtle decorative glow */}
        <div
          className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-indigo-400/15 blur-2xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-blue-400/15 blur-2xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                TOTAL SPENT
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900 dark:text-white">
              {formatAmount(dailyTotal)}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {spendsCount} {spendsCount === 1 ? "expense" : "expenses"}
            </p>
          </div>

          {/* Supplied Cartoon Wallet Illustration */}
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-white/80 dark:bg-slate-800/80 p-1.5 shadow-xs border border-white/90 dark:border-slate-700/80 overflow-hidden">
            <img
              src="/spends-icon.png"
              alt="BillBuddy Wallet Mascot"
              className="h-full w-full object-contain animate-gentle-float hover:scale-105 transition-transform"
            />
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* 3.3 DAILY EXPENSE LIST                                               */}
      {/* ==================================================================== */}
      <div className="flex flex-col gap-2.5 mt-1">
        {/* Section Heading with Count and + Add Spend button */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              {listHeading}
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {spendsCount}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onOpenAutoTracking && (
              <button
                type="button"
                onClick={onOpenAutoTracking}
                className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100/80 dark:hover:bg-cyan-900/60 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                title="Automatic Notification Tracking"
              >
                <Smartphone className="h-3.5 w-3.5 stroke-[2.2]" />
                <span className="hidden xs:inline">Auto Track</span>
              </button>
            )}

            {onImportStatement && (
              <button
                type="button"
                onClick={onImportStatement}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100/80 dark:hover:bg-amber-900/60 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
                title="Import Bank Statement CSV"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 stroke-[2.2]" />
                <span className="hidden xs:inline">Import CSV</span>
              </button>
            )}

            <button
              type="button"
              onClick={onAddSpend}
              className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100/80 dark:hover:bg-indigo-900/60 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
              <span>Add Spend</span>
            </button>
          </div>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="glass-card rounded-2xl p-6 border border-white/80 dark:border-slate-800 text-center animate-pulse">
            <p className="text-xs text-slate-400">Loading daily expenses...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && spendsCount === 0 && (
          <div className="glass-card rounded-3xl p-8 border border-white/80 dark:border-slate-800 text-center flex flex-col items-center justify-center my-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 p-2 mb-3">
              <img
                src="/spends-icon.png"
                alt="No spends"
                className="h-full w-full object-contain animate-gentle-float"
              />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
              {isToday ? "No spends logged today" : "No spends for this date"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mb-4">
              Track your daily meals, petrol, bus fare, or groceries to monitor your daily cash
              flow.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                type="button"
                onClick={onAddSpend}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-sm transition-transform active:scale-95 cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[2.5]" />
                <span>Add Your First Spend</span>
              </button>

              {onImportStatement && (
                <button
                  type="button"
                  onClick={onImportStatement}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-transform active:scale-95 cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 stroke-[2.2] text-amber-600 dark:text-amber-400" />
                  <span>Import Statement (CSV)</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Daily Expense Cards */}
        {!loading && spendsCount > 0 && (
          <div className="flex flex-col gap-2.5">
            {spends.map((spend, index) => {
              const floatDelay = `${((index % 5) * 0.35).toFixed(1)}s`;
              return (
                <div
                  key={spend.id}
                  className="spend-card-premium spend-card-floating flex items-center justify-between p-3.5 sm:p-4 rounded-2xl transition-all group"
                  style={{ animationDelay: floatDelay }}
                >
                  {/* Left: Cartoon wallet icon and spend details */}
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-xl bg-white/95 dark:bg-slate-800/95 border border-indigo-100/80 dark:border-indigo-900/60 shadow-xs p-1.5 transition-all duration-200 group-hover:scale-105 group-hover:shadow-sm">
                      <img
                        src="/spends-icon.png"
                        alt=""
                        className="h-full w-full object-contain animate-gentle-float"
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm sm:text-[15px] font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                          {spend.name}
                        </p>
                        <SpendSourceBadge source={spend.source} />
                      </div>
                      {spend.notes && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                          {spend.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Right: Amount and Actions */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-sm sm:text-base font-extrabold tabular-nums text-slate-900 dark:text-white">
                      {formatAmount(Number(spend.amount))}
                    </span>

                    {(onEditSpend || onDeleteSpend) && (
                      <div className="flex items-center gap-1 ml-1 opacity-90 sm:opacity-75 sm:group-hover:opacity-100 transition-opacity">
                        {onEditSpend && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditSpend(spend);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
                            aria-label={`Edit ${spend.name}`}
                            title="Edit spend"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {onDeleteSpend && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteSpend(spend);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer"
                            aria-label={`Delete ${spend.name}`}
                            title="Delete spend"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* ==================================================================== */}
            {/* 3.4 DAILY TOTAL FOOTER                                               */}
            {/* ==================================================================== */}
            <div className="mt-1 p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between text-xs sm:text-sm font-bold shadow-xs">
              <span className="text-slate-600 dark:text-slate-400">
                {isToday ? "Total spent today:" : `Total spent on ${formatDate(selectedDate)}:`}
              </span>
              <span className="text-base sm:text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">
                {formatAmount(dailyTotal)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
