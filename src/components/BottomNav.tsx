import { Plus } from "lucide-react";
import { BillBuddyLogo } from "@/components/BillBuddyLogo";

export type BottomNavSection = "bills" | "spends";

interface BottomNavProps {
  activeSection: BottomNavSection;
  onSelectSection: (section: BottomNavSection) => void;
  onOpenAddChoice: () => void;
  onAddBill?: () => void;
}

/**
 * Premium Floating Bottom Navigation for BillBuddy.
 * Exactly three primary actions:
 *  1. LEFT: [ Bills ] (Receipt icon + "Bills", active indicator pill)
 *  2. CENTER: [ + ] (Prominent 3D raised blue-to-purple plus button, opens choice sheet)
 *  3. RIGHT: [ Spends ] (Cartoon wallet logo + "Spends", active indicator pill)
 */
export function BottomNav({
  activeSection,
  onSelectSection,
  onOpenAddChoice,
  onAddBill,
}: BottomNavProps) {
  const isBills = activeSection === "bills";
  const isSpends = activeSection === "spends";

  const handleCenterClick = () => {
    if (onOpenAddChoice) {
      onOpenAddChoice();
    } else if (onAddBill) {
      onAddBill();
    }
  };

  return (
    <nav
      aria-label="BillBuddy navigation"
      className="fixed bottom-3 sm:bottom-4 inset-x-0 z-40 flex justify-center px-3 sm:px-4 pointer-events-none safe-bottom"
    >
      <div className="pointer-events-auto flex items-center justify-between gap-2 w-full max-w-[390px] p-2 rounded-full glass-nav bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-white/80 dark:border-slate-800/80 shadow-[0_16px_40px_-6px_rgba(15,35,75,0.18)]">
        {/* LEFT: Bills Section Button */}
        <button
          type="button"
          onClick={() => onSelectSection("bills")}
          className={`nav-pill-btn flex-1 ${isBills ? "active" : ""}`}
          aria-label="Bills Section"
          aria-pressed={isBills}
        >
          <div className="w-[19px] h-[19px] shrink-0 flex items-center justify-center">
            <BillBuddyLogo
              size={19}
              alt=""
              className={`w-full h-full object-contain transition-transform duration-200 ${
                isBills ? "scale-110" : "opacity-80"
              }`}
            />
          </div>
          <span className="truncate">Bills</span>
        </button>

        {/* CENTER: Prominent 3D Plus Action Button */}
        <div className="px-1 shrink-0 -my-1">
          <button
            type="button"
            onClick={handleCenterClick}
            className="group relative flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white font-bold shadow-[0_10px_25px_-4px_rgba(79,70,229,0.5),0_4px_10px_-2px_rgba(37,99,235,0.35)] border border-white/30 transition-all duration-200 active:scale-95 hover:scale-105 hover:shadow-[0_14px_30px_-4px_rgba(79,70,229,0.6)] cursor-pointer"
            aria-label="What would you like to add?"
            title="Add Bill or Spend"
          >
            {/* Subtle inner top highlight for 3D raised sheen */}
            <span
              className="absolute inset-x-2 top-0.5 h-3 rounded-full bg-gradient-to-b from-white/35 to-transparent pointer-events-none"
              aria-hidden="true"
            />
            <Plus className="w-6 h-6 stroke-[2.8] transition-transform duration-200 group-hover:rotate-90 group-active:scale-90" />
          </button>
        </div>

        {/* RIGHT: Spends Section Button */}
        <button
          type="button"
          onClick={() => onSelectSection("spends")}
          className={`nav-pill-btn flex-1 ${isSpends ? "active" : ""}`}
          aria-label="Spends Section"
          aria-pressed={isSpends}
        >
          <div className="w-[19px] h-[19px] shrink-0 flex items-center justify-center">
            <img
              src="/spends-icon.png"
              alt=""
              className={`w-full h-full object-contain transition-transform duration-200 ${
                isSpends ? "scale-110" : "opacity-80"
              }`}
              aria-hidden="true"
            />
          </div>
          <span className="truncate">Spends</span>
        </button>
      </div>
    </nav>
  );
}
