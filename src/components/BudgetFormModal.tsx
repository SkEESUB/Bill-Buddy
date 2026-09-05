import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EXPENSE_CATEGORIES } from "@/lib/categories";
import {
  BUDGET_PERIODS,
  DEFAULT_THRESHOLDS,
  PERIOD_LABELS,
  type BudgetPeriod,
  type BudgetRecord,
} from "@/lib/budgets";
import type { BudgetFormInput } from "@/lib/budgets.functions";
import { useModalA11y } from "@/hooks/useModalA11y";

/** Create/edit form for a budget. Thresholds default to the business layer. */
export function BudgetFormModal({
  open,
  budget,
  onClose,
  onSubmit,
}: {
  open: boolean;
  budget?: BudgetRecord | null;
  onClose: () => void;
  onSubmit: (values: BudgetFormInput) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]!.key);
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState<BudgetPeriod>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [warn, setWarn] = useState(String(DEFAULT_THRESHOLDS.warning));
  const [near, setNear] = useState(String(DEFAULT_THRESHOLDS.nearLimit));
  const [saving, setSaving] = useState(false);

  const dialogRef = useModalA11y<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    setName(budget?.name ?? "");
    setCategory(budget?.category ?? EXPENSE_CATEGORIES[0]!.key);
    setAmount(budget ? String(Number(budget.amount)) : "");
    setPeriod(((budget?.period as BudgetPeriod) ?? "monthly") as BudgetPeriod);
    setStartDate(budget?.start_date ?? new Date().toISOString().slice(0, 10));
    setEndDate(budget?.end_date ?? "");
    setWarn(String(Number(budget?.warn_threshold ?? DEFAULT_THRESHOLDS.warning)));
    setNear(String(Number(budget?.near_limit_threshold ?? DEFAULT_THRESHOLDS.nearLimit)));
  }, [open, budget]);

  if (!open) return null;

  const submit = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Enter an amount greater than 0");
      return;
    }
    if (Number(warn) >= Number(near)) {
      toast.error("Warning threshold must be below the near-limit threshold");
      return;
    }
    if (period === "custom" && !endDate) {
      toast.error("A custom budget needs an end date");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        name: name.trim() || undefined,
        category,
        amount: value,
        period,
        start_date: startDate,
        end_date: endDate || null,
        warn_threshold: Number(warn),
        near_limit_threshold: Number(near),
      });
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save budget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-[4px] sm:items-center sm:p-5"
      role="presentation"
      onClick={() => !saving && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={budget ? "Edit budget" : "New budget"}
        onClick={(e) => e.stopPropagation()}
        className="animate-scale-in max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-2xl sm:rounded-3xl"
      >
        <h2 className="text-lg font-bold text-text-primary">
          {budget ? "Edit budget" : "New budget"}
        </h2>

        <label className="mt-4 block text-xs font-semibold text-text-secondary" htmlFor="budget-name">
          Name (optional)
        </label>
        <input
          id="budget-name"
          className="input-field mt-1 !min-h-12"
          placeholder="e.g., Groceries"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="mt-4 block text-xs font-semibold text-text-secondary" htmlFor="budget-category">
          Category
        </label>
        <select
          id="budget-category"
          className="input-field mt-1 !min-h-12"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={!!budget}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>

        <label className="mt-4 block text-xs font-semibold text-text-secondary" htmlFor="budget-amount">
          Amount
        </label>
        <input
          id="budget-amount"
          type="number"
          min="1"
          className="input-field mt-1 !min-h-12"
          placeholder="5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <label className="mt-4 block text-xs font-semibold text-text-secondary" htmlFor="budget-period">
          Period
        </label>
        <select
          id="budget-period"
          className="input-field mt-1 !min-h-12"
          value={period}
          onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
        >
          {BUDGET_PERIODS.map((p) => (
            <option key={p} value={p}>
              {PERIOD_LABELS[p]}
            </option>
          ))}
        </select>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-secondary" htmlFor="budget-start">
              Starts
            </label>
            <input
              id="budget-start"
              type="date"
              className="input-field mt-1 !min-h-12"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary" htmlFor="budget-end">
              Ends {period === "custom" ? "" : "(optional)"}
            </label>
            <input
              id="budget-end"
              type="date"
              className="input-field mt-1 !min-h-12"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-text-secondary" htmlFor="budget-warn">
              Warning at %
            </label>
            <input
              id="budget-warn"
              type="number"
              min="1"
              max="99"
              className="input-field mt-1 !min-h-12"
              value={warn}
              onChange={(e) => setWarn(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-text-secondary" htmlFor="budget-near">
              Near limit at %
            </label>
            <input
              id="budget-near"
              type="number"
              min="2"
              max="100"
              className="input-field mt-1 !min-h-12"
              value={near}
              onChange={(e) => setNear(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="btn btn-secondary flex-1" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="btn btn-primary flex-1" onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : budget ? "Save changes" : "Create budget"}
          </button>
        </div>
      </div>
    </div>
  );
}