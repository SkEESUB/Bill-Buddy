import { CheckCircle2, Clock, Plus } from "lucide-react";

export type BottomNavAction = "completed" | "add" | "remaining";

interface BottomNavProps {
  activeView?: "home" | "completed" | "remaining";
  onSelectView?: (view: "home" | "completed" | "remaining") => void;
  onAddBill?: () => void;
}

/**
 * Fixed Bottom Navigation for BillBuddy.
 * Exactly three primary actions:
 *  1. LEFT: Completed (Premium pill control, soft blue/lavender gradient, toggle view)
 *  2. CENTER: Add Bill (Prominent plus pill button, opens Add Bill modal)
 *  3. RIGHT: Remaining (Premium pill control, soft blue/lavender gradient, filter view)
 *
 * NOTE: Completed and Remaining buttons do NOT display numbers or balances.
 */
export function BottomNav({ activeView = "home", onSelectView, onAddBill }: BottomNavProps) {
  const isCompleted = activeView === "completed";
  const isRemaining = activeView === "remaining";

  return (
    <nav
      aria-label="BillBuddy navigation"
      className="fixed bottom-3 sm:bottom-4 inset-x-0 z-40 flex justify-center px-3 sm:px-4 pointer-events-none safe-bottom"
    >
      <div className="pointer-events-auto flex items-center justify-between gap-1 sm:gap-1.5 w-full max-w-[390px] p-1.5 rounded-full glass-nav border border-white/80 dark:border-slate-800/80 shadow-[0_12px_36px_-6px_rgba(15,35,75,0.14)]">
        {/* LEFT: Completed Button */}
        <button
          type="button"
          onClick={() => onSelectView?.(isCompleted ? "home" : "completed")}
          className={`nav-pill-btn flex-1 ${isCompleted ? "active" : ""}`}
          aria-label="View Completed Bills"
          aria-pressed={isCompleted}
        >
          <CheckCircle2
            className={`w-4 h-4 transition-transform duration-200 stroke-[2.3] ${
              isCompleted
                ? "scale-110 text-indigo-600 dark:text-indigo-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          />
          <span className="truncate">Completed</span>
        </button>

        {/* CENTER: Add Bill (Prominent action pill with comfortable surrounding space) */}
        <div className="px-1 sm:px-1.5 shrink-0">
          <button
            type="button"
            onClick={onAddBill}
            className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white font-semibold text-xs shadow-md shadow-blue-500/25 transition-all duration-200 active:scale-95 hover:shadow-lg hover:shadow-blue-500/35 hover:brightness-105 cursor-pointer"
            aria-label="Add a new bill"
          >
            <Plus className="w-4 h-4 stroke-[2.8]" />
            <span>Add Bill</span>
          </button>
        </div>

        {/* RIGHT: Remaining Button */}
        <button
          type="button"
          onClick={() => onSelectView?.(isRemaining ? "home" : "remaining")}
          className={`nav-pill-btn flex-1 ${isRemaining ? "active" : ""}`}
          aria-label="View Remaining Bills"
          aria-pressed={isRemaining}
        >
          <Clock
            className={`w-4 h-4 transition-transform duration-200 stroke-[2.3] ${
              isRemaining
                ? "scale-110 text-indigo-600 dark:text-indigo-400"
                : "text-slate-500 dark:text-slate-400"
            }`}
          />
          <span className="truncate">Remaining</span>
        </button>
      </div>
    </nav>
  );
}
