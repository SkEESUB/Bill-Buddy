import { useEffect, useState } from "react";
import { CreditCard, Plus, TrendingDown, TrendingUp, X } from "lucide-react";

/**
 * Speed-dial floating action button: expands into "Add Bill",
 * "Add Income" and "Add Expense" actions.
 */
export function FloatingAddButton({
  onAddBill,
  onAddTransaction,
}: {
  onAddBill: () => void;
  onAddTransaction: (type: "income" | "expense") => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const item = (label: string, icon: React.ReactNode, background: string, action: () => void) => (
    <button
      key={label}
      type="button"
      onClick={() => {
        setOpen(false);
        action();
      }}
      className="animate-fade-in-up flex min-h-11 w-full items-center justify-end gap-3 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg transition-transform hover:scale-[1.03]"
      style={{ background }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <>
      {open ? (
        <div
          role="presentation"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/25 backdrop-blur-[2px]"
        />
      ) : null}

      {open ? (
        <div className="fixed bottom-44 right-5 z-40 flex w-48 flex-col gap-3 sm:bottom-28">
          {item("Add Income", <TrendingUp className="h-4 w-4" />, "#278A63", () =>
            onAddTransaction("income"),
          )}
          {item("Add Expense", <TrendingDown className="h-4 w-4" />, "#8E6FA8", () =>
            onAddTransaction("expense"),
          )}
          {item(
            "Add Bill",
            <CreditCard className="h-4 w-4" />,
            "var(--primary)",
            onAddBill,
          )}
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? "Close add menu" : "Add new entry"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-28 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_10px_24px_-8px_rgba(75,29,63,0.55)] transition-transform duration-200 sm:bottom-8"
        style={{
          background: open ? "var(--text-primary)" : "var(--primary)",
          transform: open ? "rotate(45deg)" : "none",
        }}
      >
        {open ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
      </button>
    </>
  );
}
