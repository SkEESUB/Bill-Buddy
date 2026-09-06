// src/pages/GoalsPage.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Target, Plus, Trash2, PlusCircle } from "lucide-react";
import { toast } from "sonner";
import {
  listGoals,
  createGoal,
  contributeToGoal,
  deleteGoal,
  type SpendingGoalRow,
} from "@/lib/goals.functions";
import { formatCurrency } from "@/lib/utils/format-currency";
import { formatDate } from "@/lib/utils/format-date";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { classifyError } from "@/lib/errors";

export function GoalsPage() {
  const [showForm, setShowForm] = useState(false);
  const [contributingId, setContributingId] = useState<string | null>(null);
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
      setContributingId(null);
      setContributionAmount("");
      if (result.status === "completed") {
        toast.success("🎉 Goal completed! Congratulations!");
      } else {
        toast.success("Contribution added!");
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
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="card" className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Savings Goals</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your financial targets</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Goal
        </button>
      </div>

      {/* Add Goal Form */}
      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            const title = String(fd.get("title") ?? "");
            const target_amount = Number(fd.get("target_amount") ?? 0);
            const desc = fd.get("description") ? String(fd.get("description")) : "";
            const date = fd.get("target_date") ? String(fd.get("target_date")) : "";

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
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-4"
        >
          <h2 className="font-semibold text-gray-900 dark:text-white">New Goal</h2>
          <input
            name="title"
            required
            placeholder="Goal title (e.g. Emergency Fund)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            name="target_amount"
            type="number"
            required
            min="1"
            step="1"
            placeholder="Target amount (₹)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            name="target_date"
            type="date"
            placeholder="Target date (optional)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <textarea
            name="description"
            placeholder="Description (optional)"
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {createMutation.isPending ? "Creating..." : "Create Goal"}
            </button>
          </div>
        </form>
      )}

      {/* Goals List */}
      {goals.length === 0 && !showForm ? (
        <EmptyState
          icon={Target}
          title="No goals yet"
          description="Set a savings target and track your progress toward it."
          actionLabel="Add Your First Goal"
          onAction={() => setShowForm(true)}
        />
      ) : (
        <div className="space-y-4">
          {goals.map((goal) => {
            const current = Number(goal.current_amount || 0);
            const target = Number(goal.target_amount || 1);
            const pct = Math.min(100, Math.round((current / target) * 100));
            const isCompleted = goal.status === "completed" || pct >= 100;

            return (
              <div
                key={goal.id}
                className={`bg-white dark:bg-gray-900 rounded-xl border p-4 ${
                  isCompleted
                    ? "border-emerald-200 dark:border-emerald-800"
                    : "border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{goal.title}</h3>
                      {isCompleted && (
                        <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                          ✓ Completed
                        </span>
                      )}
                    </div>
                    {goal.target_date && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Target: {formatDate(goal.target_date)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm("Delete this goal?")) {
                        deleteMutation.mutate({ id: goal.id });
                      }
                    }}
                    className="text-gray-400 hover:text-rose-500 transition-colors p-1"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-600 dark:text-gray-400">
                      {formatCurrency(current)}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(target)} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-300 ${
                        isCompleted ? "bg-emerald-500" : "bg-indigo-600"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                {/* Contribution Action */}
                {!isCompleted && (
                  contributingId === goal.id ? (
                    <div className="flex gap-2 items-center mt-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(e.target.value)}
                        placeholder="Amount (₹)"
                        className="flex-1 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        onClick={() => {
                          const amount = Number(contributionAmount);
                          if (amount > 0) {
                            contributeMutation.mutate({
                              goal_id: goal.id,
                              amount,
                            });
                          }
                        }}
                        disabled={contributeMutation.isPending}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
                      >
                        Add
                      </button>
                      <button
                        onClick={() => setContributingId(null)}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setContributingId(goal.id)}
                      className="flex items-center gap-1.5 text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline mt-2"
                    >
                      <PlusCircle className="w-4 h-4" />
                      Add Contribution
                    </button>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
