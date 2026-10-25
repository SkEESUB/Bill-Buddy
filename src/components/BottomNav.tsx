import { CheckCircle2, Clock, Plus } from "lucide-react";

export type BottomNavAction = "completed" | "add" | "remaining";

interface BottomNavProps {
  activeView?: "home" | "completed" | "remaining";
  onSelectView?: (view: "home" | "completed" | "remaining") => void;
  onAddBill?: () => void;
}

/**
 * Fixed Bottom Navigation for BillBuddy.
 * Exactly three primary actions in mandatory order:
 *  1. LEFT: Completed (Checkmark icon, opens completed overlay/view)
 *  2. CENTER: Add Bill (Prominent plus pill button, opens Add Bill form)
 *  3. RIGHT: Remaining (Clock icon, filters to outstanding bills)
 *
 * NOTE: Completed and Remaining buttons do NOT display counts or amounts.
 */
export function BottomNav({ activeView = "home", onSelectView, onAddBill }: BottomNavProps) {
  return (
    <nav
      aria-label="BillBuddy navigation"
      className="fixed bottom-4 inset-x-0 z-40 flex justify-center px-4 pointer-events-none safe-bottom"
    >
      <div className="pointer-events-auto flex items-center justify-between w-full max-w-sm px-3 py-2 rounded-full glass-nav border border-white/70 shadow-[0_12px_36px_-6px_rgba(15,35,75,0.14)]">
        {/* LEFT: Completed */}
        <button
          type="button"
          onClick={() => onSelectView?.(activeView === "completed" ? "home" : "completed")}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-full transition-all duration-200 cursor-pointer ${
            activeView === "completed"
              ? "bg-blue-600/10 text-blue-700 font-semibold"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
          }`}
          aria-label="View Completed Bills"
          aria-pressed={activeView === "completed"}
        >
          <CheckCircle2 className="w-5 h-5 mb-0.5 stroke-[2.2]" />
          <span className="text-[11px] tracking-tight">Completed</span>
        </button>

        {/* CENTER: Add Bill (Prominent pill treatment) */}
        <div className="px-1.5">
          <button
            type="button"
            onClick={onAddBill}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium text-xs shadow-md shadow-blue-500/25 transition-all duration-200 active:scale-95 hover:shadow-lg hover:shadow-blue-500/35 hover:brightness-105 cursor-pointer"
            aria-label="Add a new bill"
          >
            <Plus className="w-4 h-4 stroke-[2.8]" />
            <span>Add Bill</span>
          </button>
        </div>

        {/* RIGHT: Remaining */}
        <button
          type="button"
          onClick={() => onSelectView?.(activeView === "remaining" ? "home" : "remaining")}
          className={`flex-1 flex flex-col items-center justify-center py-1.5 px-2 rounded-full transition-all duration-200 cursor-pointer ${
            activeView === "remaining"
              ? "bg-blue-600/10 text-blue-700 font-semibold"
              : "text-slate-500 hover:text-slate-800 hover:bg-slate-100/60"
          }`}
          aria-label="View Remaining Bills"
          aria-pressed={activeView === "remaining"}
        >
          <Clock className="w-5 h-5 mb-0.5 stroke-[2.2]" />
          <span className="text-[11px] tracking-tight">Remaining</span>
        </button>
      </div>
    </nav>
  );
}
