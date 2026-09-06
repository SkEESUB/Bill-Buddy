// src/components/dashboard/QuickAddFAB.tsx
import { useState } from "react";
import { Plus, X, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface QuickAddFABProps {
  onAddIncome?: () => void;
  onAddExpense?: () => void;
  onAddBill?: () => void;
}

export function QuickAddFAB({
  onAddIncome,
  onAddExpense,
  onAddBill,
}: QuickAddFABProps) {
  const [open, setOpen] = useState(false);

  const actions = [
    {
      label: "Add Income",
      icon: TrendingUp,
      color: "bg-emerald-500 hover:bg-emerald-600",
      onClick: () => {
        onAddIncome?.();
        setOpen(false);
      },
    },
    {
      label: "Add Expense",
      icon: TrendingDown,
      color: "bg-rose-500 hover:bg-rose-600",
      onClick: () => {
        onAddExpense?.();
        setOpen(false);
      },
    },
    {
      label: "Add Bill",
      icon: Receipt,
      color: "bg-violet-500 hover:bg-violet-600",
      onClick: () => {
        onAddBill?.();
        setOpen(false);
      },
    },
  ];

  return (
    // Only visible on mobile
    <div className="fixed bottom-20 right-4 z-30 md:hidden">
      {/* Action buttons — shown when open */}
      {open && (
        <div className="flex flex-col gap-3 mb-3 items-end">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-full",
                "text-white text-sm font-medium shadow-lg",
                "transition-all duration-150",
                action.color,
              )}
            >
              <action.icon className="w-4 h-4" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Main FAB button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "w-14 h-14 rounded-full shadow-lg",
          "flex items-center justify-center",
          "transition-all duration-200",
          open ? "bg-gray-700 rotate-45" : "bg-indigo-600 hover:bg-indigo-700",
        )}
        aria-label="Quick add"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
      </button>
    </div>
  );
}
