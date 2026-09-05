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

  return (
    <section className="animate-fade-in">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Budgets</h1>
          <p className="text-sm text-text-secondary">
            Category limits calculated from your completed spending.
          </p>
        </div>
        <button className="btn btn-primary !min-h-10 !px-4 !text-xs" onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> New
        </button>
      </header>

      {active.length > 0 ? (
        <div className="card mt-4 p-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-tertiary">
            Active budgets
          </p>
          <p className="mt-1 text-[22px] font-bold tabular-nums text-text-primary">
            {formatAmount(totalSpent)}{" "}
            <span className="text-text-tertiary">/ {formatAmount(totalBudget)}</span>
          </p>
          <p className="text-xs text-text-secondary">
            {formatAmount(Math.max(0, totalBudget - totalSpent))} left across {active.length} budget
            {active.length === 1 ? "" : "s"} in their current cycles.
          </p>
        </div>
      ) : null}

      <div className="mt-5 space-y-3">
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