import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArchiveRestore, ArrowLeft, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { BudgetFormModal } from "@/components/BudgetFormModal";
import { BUDGET_STATUS_STYLES } from "@/components/BudgetCard";
import {
  deleteBudget,
  getBudgetDetail,
  setBudgetState,
  updateBudget,
  type BudgetFormInput,
} from "@/lib/budgets.functions";
import { PERIOD_LABELS, STATE_LABELS } from "@/lib/budgets";
import { moneyCategory } from "@/lib/categories";
import { classifyError } from "@/lib/errors";
import { formatAmount, formatDate } from "@/lib/format";
import { bumpFinance, useFinanceSync } from "@/lib/finance-sync";
import { typeLabel } from "@/lib/transactions";

type Detail = Awaited<ReturnType<typeof getBudgetDetail>>;

export function BudgetDetailPage({ id }: { id: string }) {
  const navigate = useNavigate();
  const fetchDetail = useServerFn(getBudgetDetail);
  const patch = useServerFn(updateBudget);
  const setState = useServerFn(setBudgetState);
  const remove = useServerFn(deleteBudget);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDetail((await fetchDetail({ data: { id } })) as Detail);
      setError(null);
    } catch (e) {
      setError(classifyError(e).message);
    }
  }, [fetchDetail, id]);

  useEffect(() => {
    void load();
  }, [load]);
  useFinanceSync(load);

  const changeState = async (status: "active" | "paused" | "archived") => {
    setBusy(true);
    try {
      await setState({ data: { id, status } });
      toast.success(`Budget ${status}`);
      await load();
      bumpFinance();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update budget");
    } finally {
      setBusy(false);
    }
  };

  const handleEdit = async (values: BudgetFormInput) => {
    await patch({ data: { id, ...values } });
    toast.success("Budget updated");
    await load();
    bumpFinance();
  };

  if (error) {
    return (
      <div role="alert" className="card p-5">
        <p className="text-sm font-medium text-error">{error}</p>
        <Link to="/money/budgets" className="btn btn-secondary mt-3 !min-h-10 !text-xs">
          Back to budgets
        </Link>
      </div>
    );
  }

  if (!detail) return <div className="card h-48 animate-pulse" aria-busy="true" />;

  const { evaluation, history, transactions } = detail;
  const style = BUDGET_STATUS_STYLES[evaluation.progress.status];
  const category = moneyCategory(evaluation.category);
  const over = evaluation.progress.remaining < 0;

  return (
    <section className="animate-fade-in space-y-5">
      <Link to="/money/budgets" className="inline-flex items-center gap-1.5 text-sm text-text-secondary">
        <ArrowLeft className="h-4 w-4" /> Budgets
      </Link>

      <header className="rounded-3xl border border-border-light/80 bg-surface p-6 shadow-xs">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${category.color}15`, color: category.color }}
            >
              <category.icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">{evaluation.name}</h1>
              <p className="text-xs text-text-secondary">
                {category.label} · {PERIOD_LABELS[evaluation.period]} ·{" "}
                {STATE_LABELS[evaluation.state]}
              </p>
            </div>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${style.badgeClass}`}
          >
            {style.label}
          </span>
        </div>

        <p className="mt-5 text-3xl font-extrabold tabular-nums text-text-primary">
          {formatAmount(evaluation.progress.spent)}
          <span className="text-sm font-normal text-text-tertiary">
            {" "}
            / {formatAmount(evaluation.progress.budget)}
          </span>
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {over
            ? `${formatAmount(Math.abs(evaluation.progress.remaining))} over budget`
            : `${formatAmount(evaluation.progress.remaining)} remaining`}{" "}
          · {evaluation.progress.percentageUsed}% used
        </p>

        <div
          className="mt-3.5 h-3 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={evaluation.progress.percentageUsed}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Budget used"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${style.barClass}`}
            style={{
              width: `${Math.min(100, Math.max(0, evaluation.progress.percentageUsed))}%`,
            }}
          />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-text-tertiary">Cycle</dt>
            <dd className="font-semibold text-text-primary">
              {formatDate(evaluation.cycle.start)} – {formatDate(evaluation.cycle.end)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Days left</dt>
            <dd className="font-semibold text-text-primary">{evaluation.daysRemaining}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Safe per day</dt>
            <dd className="font-semibold text-text-primary">
              {formatAmount(evaluation.dailyAllowance)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-tertiary">Refunds netted</dt>
            <dd className="font-semibold text-text-primary">{formatAmount(evaluation.refunds)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn btn-secondary !min-h-10 !text-xs" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          {evaluation.state === "active" ? (
            <button
              className="btn btn-secondary !min-h-10 !text-xs"
              disabled={busy}
              onClick={() => void changeState("paused")}
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          ) : (
            <button
              className="btn btn-secondary !min-h-10 !text-xs"
              disabled={busy}
              onClick={() => void changeState("active")}
            >
              <Play className="h-3.5 w-3.5" /> Resume
            </button>
          )}
          {evaluation.state !== "archived" ? (
            <button
              className="btn btn-secondary !min-h-10 !text-xs"
              disabled={busy}
              onClick={() => void changeState("archived")}
            >
              <ArchiveRestore className="h-3.5 w-3.5" /> Archive
            </button>
          ) : null}
          <button
            className="btn btn-secondary !min-h-10 !text-xs !text-error"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      </header>

      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary">Historical performance</h2>
        {history.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">No completed cycles yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((entry) => (
              <li key={entry.cycle.start} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-text-secondary">
                  {formatDate(entry.cycle.start)} – {formatDate(entry.cycle.end)}
                </span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatAmount(entry.progress.spent)} / {formatAmount(entry.progress.budget)} (
                  {entry.progress.percentageUsed}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card p-5">
        <h2 className="text-sm font-bold text-text-primary">Contributing transactions</h2>
        {transactions.length === 0 ? (
          <p className="mt-2 text-sm text-text-secondary">
            No transactions in this category for the current cycle.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border-light">
            {transactions.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-text-primary">
                    {row.description || typeLabel(row.type)}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {formatDate(row.date)} · {typeLabel(row.type)} · {row.status}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-text-primary">
                  {row.type === "refund" ? "+" : "−"}
                  {formatAmount(Math.abs(Number(row.amount)))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <BudgetFormModal
        open={editing}
        budget={detail.budget}
        onClose={() => setEditing(false)}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete budget?"
        message="This removes the budget and its history. Transactions are not affected."
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setBusy(true);
          void remove({ data: { id } })
            .then(() => {
              toast.success("Budget deleted");
              bumpFinance();
              void navigate({ to: "/money/budgets" });
            })
            .catch((e: unknown) =>
              toast.error(e instanceof Error ? e.message : "Failed to delete budget"),
            )
            .finally(() => setBusy(false));
        }}
      />
    </section>
  );
}