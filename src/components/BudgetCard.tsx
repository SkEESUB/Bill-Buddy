import { Link } from "@tanstack/react-router";
import { formatAmount } from "@/lib/format";
import { moneyCategory } from "@/lib/categories";
import { PERIOD_LABELS, STATE_LABELS, type BudgetEvaluation } from "@/lib/budgets";
import type { BudgetStatus } from "@/lib/money";

export const BUDGET_STATUS_STYLES: Record<BudgetStatus, { label: string; bg: string; color: string }> =
  {
    healthy: { label: "Healthy", bg: "#E7F5EF", color: "#1F7053" },
    warning: { label: "Warning", bg: "#FFF3DF", color: "#9C6318" },
    near_limit: { label: "Near limit", bg: "#FFF3DF", color: "#9C6318" },
    over_budget: { label: "Over budget", bg: "#FCEAED", color: "#A73A4C" },
  };

/** One budget summarised with real amounts — the bar never stands alone. */
export function BudgetCard({ budget }: { budget: BudgetEvaluation }) {
  const style = BUDGET_STATUS_STYLES[budget.progress.status];
  const category = moneyCategory(budget.category);
  const pct = Math.min(100, Math.max(0, budget.progress.percentageUsed));
  const over = budget.progress.remaining < 0;

  return (
    <Link
      to="/money/budgets/$id"
      params={{ id: budget.id }}
      className="card block p-4 transition-shadow hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <category.icon className="h-4 w-4" style={{ color: category.color }} aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-text-primary">{budget.name}</p>
            <p className="text-xs text-text-tertiary">
              {category.label} · {PERIOD_LABELS[budget.period]}
              {budget.state === "active" ? "" : ` · ${STATE_LABELS[budget.state]}`}
            </p>
          </div>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: style.bg, color: style.color }}
        >
          {style.label}
        </span>
      </div>

      <p className="mt-3 text-[15px] font-bold text-text-primary tabular-nums">
        {formatAmount(budget.progress.spent)}{" "}
        <span className="text-text-tertiary">/ {formatAmount(budget.progress.budget)}</span>
      </p>
      <p className="text-xs text-text-secondary">
        {over
          ? `${formatAmount(Math.abs(budget.progress.remaining))} over budget`
          : `${formatAmount(budget.progress.remaining)} remaining`}{" "}
        · {budget.progress.percentageUsed}%
      </p>

      <div
        className="mt-2 neu-inset h-2.5 w-full overflow-hidden rounded-full bg-lilac/40"
        role="progressbar"
        aria-valuenow={budget.progress.percentageUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${budget.name} budget used`}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: style.color }}
        />
      </div>
      <p className="mt-2 text-[11px] text-text-tertiary">
        {budget.cycle.start} → {budget.cycle.end} · {budget.daysRemaining} day
        {budget.daysRemaining === 1 ? "" : "s"} left
      </p>
    </Link>
  );
}