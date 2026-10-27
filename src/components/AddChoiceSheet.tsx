import { X } from "lucide-react";
import { BillBuddyLogo } from "@/components/BillBuddyLogo";

interface AddChoiceSheetProps {
  open: boolean;
  onClose: () => void;
  onSelectAddBill: () => void;
  onSelectAddSpend: () => void;
}

/**
 * Compact selection sheet presented when user taps the central Add button.
 * Allows choosing between adding a Bill or a daily Spend independently.
 */
export function AddChoiceSheet({
  open,
  onClose,
  onSelectAddBill,
  onSelectAddSpend,
}: AddChoiceSheetProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs p-3 pb-6 sm:items-center sm:pb-3 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-3xl glass-panel bg-white/95 border border-white/90 p-5 shadow-2xl relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="choice-sheet-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div>
            <h3
              id="choice-sheet-title"
              className="text-base font-bold text-slate-900 leading-tight"
            >
              What would you like to add?
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Select an action to continue</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Options */}
        <div className="flex flex-col gap-2.5">
          {/* Add Bill Option */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectAddBill();
            }}
            className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left group cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 p-1.5 group-hover:bg-blue-600/10 transition-colors overflow-hidden">
              <BillBuddyLogo
                size={36}
                alt="Add Bill"
                className="h-full w-full object-contain group-hover:scale-110 transition-transform"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                Add Bill
              </div>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                Electricity, rent, internet or subscriptions
              </p>
            </div>
          </button>

          {/* Add Spend Option */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectAddSpend();
            }}
            className="flex items-center gap-3.5 p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:bg-indigo-50/50 hover:border-indigo-200 transition-all text-left group cursor-pointer shadow-xs active:scale-[0.99]"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 p-1.5 group-hover:bg-indigo-600/10 transition-colors overflow-hidden">
              <img
                src="/spends-icon.png"
                alt="Add Spend"
                className="h-full w-full object-contain group-hover:scale-110 transition-transform"
              />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Add Spend
              </div>
              <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                Breakfast, petrol, coffee, groceries or shopping
              </p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
