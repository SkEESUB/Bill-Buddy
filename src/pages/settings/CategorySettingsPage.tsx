import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Eye, EyeOff, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader, Group } from "@/components/settings/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
  type CategoryRow,
} from "@/lib/categories.functions";
import { toUserMessage } from "@/lib/errors";

const KEY = ["categories", "list"] as const;
const EMOJI = ["🏷️", "🏠", "🍔", "🚗", "💡", "📱", "🎬", "🏥", "🎓", "✈️", "🛒", "💳"];

/** Create, rename, hide and delete the categories used across the app. */
export function CategorySettingsPage() {
  const fetchAll = useServerFn(listCategories);
  const createFn = useServerFn(createCategory);
  const updateFn = useServerFn(updateCategory);
  const deleteFn = useServerFn(deleteCategory);
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({ queryKey: KEY, queryFn: () => fetchAll() });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: KEY });

  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🏷️");
  const [pendingDelete, setPendingDelete] = useState<CategoryRow | null>(null);

  const create = useMutation({
    mutationFn: () => createFn({ data: { name: name.trim(), icon } }),
    onSuccess: () => {
      setName("");
      invalidate();
      toast.success("Category added");
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const toggleActive = useMutation({
    mutationFn: (row: CategoryRow) => updateFn({ data: { id: row.id, is_active: !row.is_active } }),
    onSuccess: invalidate,
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (row: CategoryRow) => deleteFn({ data: { id: row.id } }),
    onSuccess: () => {
      setPendingDelete(null);
      invalidate();
      toast.success("Category deleted");
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  const custom = categories.filter((c) => !c.is_system);
  const system = categories.filter((c) => c.is_system);

  return (
    <section className="animate-fade-in pb-8">
      <SettingsHeader title="Categories" subtitle="System labels are shared; yours are private." />

      <Group title="Add a category">
        <div className="flex flex-wrap gap-1.5">
          {EMOJI.map((e) => (
            <button
              key={e}
              type="button"
              aria-label={`Icon ${e}`}
              aria-pressed={icon === e}
              onClick={() => setIcon(e)}
              className={`h-10 w-10 rounded-xl border text-lg ${
                icon === e ? "border-primary bg-lilac/45" : "border-border-light"
              }`}
            >
              {e}
            </button>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input-field"
            placeholder="Category name"
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-primary shrink-0"
            disabled={name.trim().length === 0 || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-[18px] w-[18px]" />
            )}
            Add
          </button>
        </div>
      </Group>

      <Group title={`Your categories (${custom.length})`}>
        {isLoading ? (
          <div className="flex justify-center py-6 text-text-secondary">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : custom.length === 0 ? (
          <p className="py-3 text-[13px] text-text-tertiary">
            No custom categories yet — add one above.
          </p>
        ) : (
          custom.map((row) => (
            <div
              key={row.id}
              className="flex items-center gap-3 border-b border-border-light py-3 last:border-0"
            >
              <span className="text-lg">{row.icon}</span>
              <span
                className={`min-w-0 flex-1 truncate text-sm font-medium ${
                  row.is_active ? "text-text-primary" : "text-text-tertiary line-through"
                }`}
              >
                {row.name}
              </span>
              <button
                type="button"
                aria-label={row.is_active ? `Hide ${row.name}` : `Show ${row.name}`}
                className="rounded-xl p-2 text-text-secondary hover:text-primary"
                onClick={() => toggleActive.mutate(row)}
              >
                {row.is_active ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
              <button
                type="button"
                aria-label={`Delete ${row.name}`}
                className="rounded-xl p-2 text-error"
                onClick={() => setPendingDelete(row)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </Group>

      <Group title={`Built-in (${system.length})`}>
        <div className="flex flex-wrap gap-2">
          {system.map((row) => (
            <span
              key={row.id}
              className="flex items-center gap-1.5 rounded-xl bg-muted px-3 py-2 text-[13px] font-medium text-text-secondary"
            >
              <span>{row.icon}</span>
              {row.name}
              <Check className="h-3.5 w-3.5 text-text-tertiary" />
            </span>
          ))}
        </div>
      </Group>

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.name ?? "category"}?`}
        message="Categories already used by a bill, budget or transaction can't be deleted — hide them instead."
        confirmLabel="Delete"
        busy={remove.isPending}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete)}
      />
    </section>
  );
}