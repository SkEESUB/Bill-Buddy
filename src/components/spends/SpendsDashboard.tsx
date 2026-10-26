import { useMemo, useRef } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { addDays, formatAmount, formatDate, toDay } from "@/lib/format";
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
}

export function SpendsDashboard({
  selectedDate,
  onDateChange,
  today,
  spends,
  loading = false,
  onAddSpend,
  onEditSpend,
  onDeleteSpend,
}: SpendsDashboardProps) {
  const dateInputRef = useRef<HTMLInputElement>(null);

  // Date math
  const isToday = selectedDate === today;
  const yesterday = useMemo(() => toDay(addDays(new Date(`${today}T00:00:00`), -1)), [today]);
  const isYesterday = selectedDate === yesterday;
  const canGoForward = selectedDate < today;

  const handlePrevDay = () => {
    const prev = toDay(addDays(new Date(`${selectedDate}T00:00:00`), -1));
    onDateChange(prev);
  };

  const handleNextDay = () => {
    if (!canGoForward) return;
    const next = toDay(addDays(new Date(`${selectedDate}T00:00:00`), 1));
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

  // Daily calculations
  const dailyTotal = useMemo(() => {
    return spends.reduce((sum, s) => sum + (Number.isFinite(s.amount) ? s.amount : 0), 0);
  }, [spends]);

  const spendsCount = spends.length;

  // Title for the daily list
  const listTitle = useMemo(() => {
    if (isToday) return "Today's Spends";
    if (isYesterday) return "Yesterday's Spends";
    return `Spends for ${formatDate(selectedDate)}`;
  }, [isToday, isYesterday, selectedDate]);

  return (
    <div className="flex flex-col gap-3.5 w-full animate-fade-in" aria-label="Spends Dashboard">
      {/* ==================================================================== */}
      {/* DATE SELECTOR                                                        */}
      {/* ==================================================================== */}
      <div className="flex items-center justify-between gap-2 p-1.5 rounded-2xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-[0_2px_10px_-2px_rgba(15,35,75,0.05)]">
        {/* Previous Day */}
        <button
          type="button"
          onClick={handlePrevDay}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 transition-colors cursor-pointer active:scale-95"
          aria-label="Previous day"
          title="Previous day"
        >
          <ChevronLeft className="h-4 w-4 stroke-[2.5]" />
        </button>

        {/* Selected Date & Calendar Trigger */}
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
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-slate-100/80 transition-colors cursor-pointer group"
            aria-label="Select date"
          >
            <CalendarIcon className="h-4 w-4 text-blue-600 group-hover:scale-105 transition-transform" />
            <span className="text-xs sm:text-sm font-bold text-slate-800">
              {isToday ? `Today, ${formatDate(selectedDate)}` : formatDate(selectedDate)}
            </span>
          </button>

          {/* Hidden native date input restricted to <= today */}
          <input
            ref={dateInputRef}
            type="date"
            value={selectedDate}
            max={today}
            onChange={handleDateSelect}
            className="absolute inset-0 opacity-0 pointer-events-none w-full h-full"
            aria-label="Date picker"
          />
        </div>

        {/* Next Day (disabled if selectedDate === today) */}
        <button
          type="button"
          onClick={handleNextDay}
          disabled={!canGoForward}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
            canGoForward
              ? "bg-slate-100 hover:bg-slate-200/80 text-slate-700 cursor-pointer active:scale-95"
              : "bg-slate-50 text-slate-300 cursor-not-allowed"
          }`}
          aria-label="Next day"
          title={canGoForward ? "Next day" : "Future dates disabled"}
        >
          <ChevronRight className="h-4 w-4 stroke-[2.5]" />
        </button>
      </div>

      {/* ==================================================================== */}
      {/* DAILY SPENDING SUMMARY CARD                                          */}
      {/* ==================================================================== */}
      <div className="glass-panel rounded-3xl p-5 border border-white/90 shadow-[0_10px_30px_-8px_rgba(15,39,66,0.06)] relative overflow-hidden">
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
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-500">
                TOTAL SPENT
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums text-slate-900">
              {formatAmount(dailyTotal)}
            </p>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {spendsCount} {spendsCount === 1 ? "expense" : "expenses"}
            </p>
          </div>

          {/* Cartoon Wallet Illustration in Summary */}
          <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-2xl bg-white/80 p-1 shadow-xs border border-white/90 overflow-hidden">
            <img
              src="/spends-icon.png"
              alt="BillBuddy Spends"
              className="h-full w-full object-contain hover:scale-105 transition-transform"
            />
          </div>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* DAILY EXPENSE LIST                                                   */}
      {/* ==================================================================== */}
      <div className="flex flex-col gap-2.5 mt-1">
        {/* Section Header with Count and Add Spend Quick Button */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900">{listTitle}</h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700">
              {spendsCount}
            </span>
          </div>

          <button
            type="button"
            onClick={onAddSpend}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1 rounded-full transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            <span>Add Spend</span>
          </button>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="glass-card rounded-2xl p-6 border border-white/80 text-center animate-pulse">
            <p className="text-xs text-slate-400">Loading daily expenses...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && spendsCount === 0 && (
          <div className="glass-card rounded-3xl p-8 border border-white/80 text-center flex flex-col items-center justify-center my-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50/80 p-2 mb-3">
              <img
                src="/spends-icon.png"
                alt="No spends"
                className="h-full w-full object-contain"
              />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              {isToday ? "No spends logged today" : "No spends for this date"}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mb-4">
              Track your daily meals, petrol, bus fare, or groceries to monitor your daily cash
              flow.
            </p>
            <button
              type="button"
              onClick={onAddSpend}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold shadow-sm transition-transform active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Add Your First Spend</span>
            </button>
          </div>
        )}

        {/* Expense Cards */}
        {!loading && spendsCount > 0 && (
          <div className="flex flex-col gap-2">
            {spends.map((spend) => (
              <div
                key={spend.id}
                className="flex items-center justify-between p-3.5 rounded-2xl glass-card border border-white/90 shadow-xs hover:shadow-md transition-all group"
              >
                {/* Left: Cartoon wallet icon and spend details */}
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100/60 p-1">
                    <img
                      src="/spends-icon.png"
                      alt=""
                      className="h-full w-full object-contain"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{spend.name}</p>
                    {spend.notes && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">{spend.notes}</p>
                    )}
                  </div>
                </div>

                {/* Right: Amount and Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm sm:text-base font-extrabold tabular-nums text-slate-900">
                    {formatAmount(spend.amount)}
                  </span>

                  {(onEditSpend || onDeleteSpend) && (
                    <div className="flex items-center gap-1 ml-1 opacity-90 sm:opacity-75 sm:group-hover:opacity-100 transition-opacity">
                      {onEditSpend && (
                        <button
                          type="button"
                          onClick={() => onEditSpend(spend)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                          aria-label={`Edit ${spend.name}`}
                          title="Edit spend"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {onDeleteSpend && (
                        <button
                          type="button"
                          onClick={() => onDeleteSpend(spend)}
                          className="flex h-7 w-7 items-center justify-center rounded-lg hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-colors cursor-pointer"
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
            ))}

            {/* Daily Total Summary Footer */}
            <div className="mt-2 p-3.5 rounded-2xl bg-white/70 border border-slate-200/80 flex items-center justify-between text-xs sm:text-sm font-bold shadow-xs">
              <span className="text-slate-600">
                {isToday ? "Total spent today:" : `Total spent on ${formatDate(selectedDate)}:`}
              </span>
              <span className="text-base sm:text-lg font-extrabold tabular-nums text-slate-900">
                {formatAmount(dailyTotal)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
