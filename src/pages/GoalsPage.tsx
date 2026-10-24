import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Plus, Trash2, PlusCircle, CheckCircle2, Trophy, Calendar, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  listGoals,
  createGoal,
  contributeToGoal,
  deleteGoal,
  type SpendingGoalRow,
} from "@/lib/goals.functions";
import { formatAmountShort } from "@/lib/format";
import { formatDate } from "@/lib/utils/format-date";
import { EmptyState } from "@/components/EmptyState";
import { BillListSkeleton } from "@/components/Skeletons";
import { classifyError } from "@/lib/errors";

export function GoalsPage() {
  const [showForm, setShowForm] = useState(false);
  const [contributingGoal, setContributingGoal] = useState<SpendingGoalRow | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");
  const queryClient = useQueryClient();

  const { data: goals = [], isLoading } = useQuery<SpendingGoalRow[]>({
    queryKey: ["goals"],
    queryFn: () => listGoals(),
  });

  const createMutation = useMutation({
    mutationFn: (values: {
      title: string;
      target_amount: number;
      description?: string | undefined;
      target_date?: string | undefined;
    }) => createGoal({ data: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setShowForm(false);
      toast.success("Goal created successfully!");
    },
    onError: (err) => toast.error(classifyError(err).message),
  });

  const contributeMutation = useMutation({
    mutationFn: (values: { goal_id: string; amount: number }) =>
      contributeToGoal({ data: values }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      setContributingGoal(null);
      setContributionAmount("");
      if (result.status === "completed") {
        toast.success("🎉 Goal completed! Congratulations!");
      } else {
        toast.success("Contribution recorded!");
      }
    },
    onError: (err) => toast.error(classifyError(err).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (values: { id: string }) => deleteGoal({ data: values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Goal deleted");
    },
    onError: (err) => toast.error(classifyError(err).message),
  });

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto pb-24">
        <BillListSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-28 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-text-primary">Financial Goals</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Track your milestones and build your savings targets.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary !min-h-11 !px-4 text-sm cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Add Goal Modal / Inline Form */}
      {showForm && (
        <div className="card p-6 sm:p-7 rounded-[28px] border border-border-light shadow-xl animate-slide-up">
          <div className="flex items-center justify-between pb-3 border-b border-border-light">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Create New Goal
            </h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const fd = new FormData(form);
              const title = String(fd.get("title") ?? "").trim();
              const target_amount = Number(fd.get("target_amount") ?? 0);
              const desc = String(fd.get("description") ?? "").trim();
              const date = String(fd.get("target_date") ?? "").trim();

              const payload: {
                title: string;
                target_amount: number;
                description?: string;
                target_date?: string;
              } = { title, target_amount };

              if (desc) payload.description = desc;
              if (date) payload.target_date = date;

              createMutation.mutate(payload);
            }}
            className="mt-5 space-y-4"
          >
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Goal Title
              </label>
              <input
                name="title"
                required
                placeholder="e.g. Dubai Trip, Emergency Fund, New Bike"
                className="input-field"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Target Amount (₹)
              </label>
              <input
                name="target_amount"
                type="number"
                required
                min="1"
                step="1"
                placeholder="e.g. 150000"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Target Date (Optional)
              </label>
              <input
                name="target_date"
                type="date"
                className="input-field"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                Notes / Description (Optional)
              </label>
              <textarea
                name="description"
                placeholder="Why are you saving for this?"
                rows={2}
                className="input-field resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary flex-1 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="btn btn-primary flex-[2] cursor-pointer"
              >
                {createMutation.isPending ? "Saving..." : "Save Goal"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goals Grid matching Phase 5 Screen 10 */}
      {goals.length === 0 && !showForm ? (
        <EmptyState
          icon={Target}
          title="No goals set yet"
          subtitle="Set a financial target like a vacation, emergency fund or purchase."
          action={
            <button
              onClick={() => setShowForm(true)}
              className="btn btn-primary mt-2"
            >
              <Plus className="w-4 h-4" /> Add Your First Goal
            </button>
          }
        />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {goals.map((goal) => {
            const current = Number(goal.current_amount || 0);
            const target = Number(goal.target_amount || 1);
            const pct = Math.min(100, Math.round((current / target) * 100));
            const isCompleted = goal.status === "completed" || pct >= 100;

            // SVG Circular Progress math
            const radius = 45;
            const circumference = 2 * Math.PI * radius;
            const strokeDashoffset = circumference - (pct / 100) * circumference;

            return (
              <div
                key={goal.id}
                className={`card rounded-[32px] p-6 text-center shadow-md relative overflow-hidden transition-all hover:shadow-xl ${
                  isCompleted ? "border-emerald-300 bg-emerald-50/20" : ""
                }`}
              >
                {/* Header Action Menu */}
                <div className="flex items-center justify-between mb-4 text-left">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      {isCompleted ? <Trophy className="h-4 w-4" /> : <Target className="h-4 w-4" />}
                    </span>
                    <h3 className="font-bold text-base text-text-primary">{goal.title}</h3>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Delete this goal?")) {
                        deleteMutation.mutate({ id: goal.id });
                      }
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Circular Gauge matching Phase 5 Screen 10 */}
                <div className="relative mx-auto my-3 flex h-36 w-36 items-center justify-center">
                  <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 110 110">
                    <circle
                      cx="55"
                      cy="55"
                      r={radius}
                      className="stroke-muted"
                      strokeWidth="10"
                      fill="transparent"
                    />
                    <circle
                      cx="55"
                      cy="55"
                      r={radius}
                      className={`transition-all duration-1000 ease-out ${
                        isCompleted ? "stroke-emerald-500" : "stroke-primary"
                      }`}
                      strokeWidth="10"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-extrabold text-text-primary">{pct}%</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                      {isCompleted ? "Completed" : "Progress"}
                    </span>
                  </div>
                </div>

                {/* Amounts & Deadlines */}
                <div className="mt-2">
                  <p className="text-sm font-bold text-text-primary">
                    {formatAmountShort(current)} of {formatAmountShort(target)}
                  </p>
                  {goal.target_date && (
                    <p className="text-xs text-text-secondary mt-1 flex items-center justify-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-text-tertiary" /> Target: {formatDate(goal.target_date)}
                    </p>
                  )}
                </div>

                {/* Contribution Action Button */}
                <div className="mt-5">
                  {!isCompleted ? (
                    <button
                      onClick={() => {
                        setContributingGoal(goal);
                        setContributionAmount("");
                      }}
                      className="btn btn-primary w-full !min-h-11 !rounded-2xl text-xs font-bold shadow-md cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4" /> Add Contribution
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-800 px-4 py-1.5 text-xs font-bold">
                      <CheckCircle2 className="h-4 w-4" /> Goal Achieved!
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Contribution Dialog Modal */}
      {contributingGoal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setContributingGoal(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-[32px] border border-border-light bg-surface p-6 shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Add Contribution"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border-light">
              <div>
                <h3 className="font-bold text-base text-text-primary">Add Contribution</h3>
                <p className="text-xs text-text-secondary">{contributingGoal.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setContributingGoal(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">
                  Contribution Amount (₹)
                </label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={contributionAmount}
                  onChange={(e) => setContributionAmount(e.target.value)}
                  placeholder="e.g. 5000"
                  className="input-field"
                  autoFocus
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setContributingGoal(null)}
                  className="btn btn-secondary flex-1 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={contributeMutation.isPending || !Number(contributionAmount)}
                  onClick={() => {
                    const amount = Number(contributionAmount);
                    if (amount > 0) {
                      contributeMutation.mutate({
                        goal_id: contributingGoal.id,
                        amount,
                      });
                    }
                  }}
                  className="btn btn-primary flex-[2] cursor-pointer"
                >
                  {contributeMutation.isPending ? "Adding..." : "Add to Goal"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
