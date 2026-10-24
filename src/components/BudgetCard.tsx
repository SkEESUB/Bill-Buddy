import { Link } from "@tanstack/react-router";
import { formatAmount } from "@/lib/format";
import { moneyCategory } from "@/lib/categories";
import { PERIOD_LABELS, STATE_LABELS, type BudgetEvaluation } from "@/lib/budgets";
import type { BudgetStatus } from "@/lib/money";

export const BUDGET_STATUS_STYLES: Record<
  BudgetStatus,
  { label: string; badgeClass: string; barClass: string; color: string; bg: string }
> = {
  healthy: {
    label: "On Track",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    barClass: "bg-emerald-500",
    color: "#1F7053",
    bg: "#E7F5EF",
  },
  warning: {
    label: "Warning",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    barClass: "bg-amber-500",
    color: "#9C6318",
    bg: "#FFF3DF",
  },
  near_limit: {
    label: "Near Limit",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    barClass: "bg-amber-500",
    color: "#9C6318",
    bg: "#FFF3DF",
  },
  over_budget: {
    label: "Over Budget",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
    barClass: "bg-rose-500",
    color: "#A73A4C",
    bg: "#FCEAED",
  },
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
      className="block rounded-3xl border border-border-light/80 bg-surface p-5 shadow-xs transition-all hover:border-primary/40 hover:shadow-md cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${category.color}15`, color: category.color }}
          >
            <category.icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-bold text-text-primary">{budget.name}</p>
            <p className="text-xs text-text-secondary">
              {category.label} · {PERIOD_LABELS[budget.period]}
              {budget.state === "active" ? "" : ` · ${STATE_LABELS[budget.state]}`}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style.badgeClass}`}
        >
          {style.label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <p className="text-lg font-extrabold text-text-primary tabular-nums">
          {formatAmount(budget.progress.spent)}{" "}
          <span className="text-xs font-normal text-text-tertiary">
            / {formatAmount(budget.progress.budget)}
          </span>
        </p>
        <span className="text-xs font-bold tabular-nums text-text-primary">
          {budget.progress.percentageUsed}%
        </span>
      </div>

      <div
        className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={budget.progress.percentageUsed}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${budget.name} budget used`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${style.barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-text-tertiary">
        <span className={over ? "font-semibold text-rose-600" : ""}>
          {over
            ? `${formatAmount(Math.abs(budget.progress.remaining))} over limit`
            : `${formatAmount(budget.progress.remaining)} remaining`}
        </span>
        <span>
          {budget.daysRemaining} day{budget.daysRemaining === 1 ? "" : "s"} left
        </span>
      </div>
    </Link>
  );
}