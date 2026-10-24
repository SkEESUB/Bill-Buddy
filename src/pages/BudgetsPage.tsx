import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { BudgetCard } from "@/components/BudgetCard";
import { BudgetFormModal } from "@/components/BudgetFormModal";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import { createBudget, listBudgets, type BudgetFormInput } from "@/lib/budgets.functions";
import { bumpFinance, useFinanceSync } from "@/lib/finance-sync";
import { classifyError } from "@/lib/errors";
import { formatAmount } from "@/lib/format";
import type { BudgetEvaluation } from "@/lib/budgets";

export function BudgetsPage() {
  const list = useServerFn(listBudgets);
  const create = useServerFn(createBudget);

  const [budgets, setBudgets] = useState<BudgetEvaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await list({});
      setBudgets(data.budgets);
      setError(null);
    } catch (e) {
      setError(classifyError(e).message);
    } finally {
      setLoading(false);
    }
  }, [list]);

  useEffect(() => {
    void load();
  }, [load]);
  useFinanceSync(load);

  const handleCreate = async (values: BudgetFormInput) => {
    await create({ data: values });
    toast.success("Budget created");
    await load();
    bumpFinance();
  };

  const active = budgets.filter((b) => b.state === "active");
  const inactive = budgets.filter((b) => b.state !== "active");
  const totalBudget = active.reduce((sum, b) => sum + b.progress.budget, 0);
  const totalSpent = active.reduce((sum, b) => sum + b.progress.spent, 0);
  const warningBudgets = active.filter(
    (b) =>
      b.progress.percentageUsed >= 80 ||
      b.progress.status === "warning" ||
      b.progress.status === "near_limit" ||
      b.progress.status === "over_budget",
  );

  return (
    <section className="animate-fade-in space-y-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Budgets</h1>
          <p className="text-xs text-text-secondary">
            Category limits calculated from your completed spending
          </p>
        </div>
        <button className="btn btn-primary !min-h-10 !px-4 !text-xs cursor-pointer" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> New Budget
        </button>
      </header>

      {/* Budget Warning Banner matching Phase 5 Screen 6 */}
      {warningBudgets[0] && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/20 p-4 text-amber-900 dark:text-amber-200 shadow-xs flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600">
            ⚠️
          </span>
          <div className="min-w-0">
            <h4 className="text-xs font-bold uppercase tracking-wide">
              {warningBudgets[0].progress.status === "over_budget" ? "Budget Limit Exceeded" : "Approaching Budget Limit"}
            </h4>
            <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
              You've used <span className="font-bold">{warningBudgets[0].progress.percentageUsed}%</span> of your{" "}
              <span className="font-semibold">{warningBudgets[0].name}</span> budget with{" "}
              <span className="font-semibold">{warningBudgets[0].daysRemaining} days</span> remaining.
            </p>
          </div>
        </div>
      )}

      {active.length > 0 ? (
        <div className="rounded-3xl border border-border-light/80 bg-surface p-5 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Active Budgets Overview
          </p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-text-primary">
            {formatAmount(totalSpent)}{" "}
            <span className="text-sm font-normal text-text-tertiary">/ {formatAmount(totalBudget)}</span>
          </p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{
                width: `${Math.min(100, totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-text-secondary">
            {formatAmount(Math.max(0, totalBudget - totalSpent))} remaining across {active.length} active budget
            {active.length === 1 ? "" : "s"}
          </p>
        </div>
      ) : null}

      <div className="space-y-3">
        {error ? (
          <div role="alert" className="card p-4">
            <p className="text-sm font-medium text-error">{error}</p>
            <button className="btn btn-secondary mt-3 !min-h-10 !text-xs" onClick={() => void load()}>
              Try again
            </button>
          </div>
        ) : loading ? (
          <BillListSkeleton />
        ) : budgets.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No budgets yet"
            subtitle="Create a budget to track category spending against a real limit."
            action={
              <button className="btn btn-primary" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" /> Create a budget
              </button>
            }
          />
        ) : (
          <>
            {active.map((budget) => (
              <BudgetCard key={budget.id} budget={budget} />
            ))}
            {inactive.length > 0 ? (
              <>
                <h2 className="pt-3 text-xs font-bold uppercase tracking-wide text-text-tertiary">
                  Paused & archived
                </h2>
                {inactive.map((budget) => (
                  <BudgetCard key={budget.id} budget={budget} />
                ))}
              </>
            ) : null}
          </>
        )}
      </div>

      <BudgetFormModal open={formOpen} onClose={() => setFormOpen(false)} onSubmit={handleCreate} />
    </section>
  );
}