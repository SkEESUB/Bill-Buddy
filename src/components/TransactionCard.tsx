import { Pencil, Trash2 } from "lucide-react";
import { moneyCategory } from "@/lib/categories";
import { formatAmount, formatDate } from "@/lib/format";
import type { Transaction } from "@/types/database";

/** One income/expense row with edit + delete actions. */
export function TransactionCard({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) {
  const cat = moneyCategory(transaction.category);
  const Icon = cat.icon;
  const income = transaction.type === "income";

  return (
    <div className="card flex items-center gap-3 rounded-[22px] p-4">
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lilac/50"
        style={{ color: cat.color }}
        aria-hidden="true"
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-text-primary">
          {transaction.description || cat.label}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-text-secondary">
          {cat.label} · {formatDate(transaction.date)}
        </p>
      </div>
      <div className="text-right">
        <p
          className="text-[18px] font-bold tabular-nums"
          style={{ color: income ? "var(--status-success)" : "var(--primary)" }}
        >
          {income ? "+" : "−"}
          {formatAmount(Number(transaction.amount))}
        </p>
        <div className="mt-1 flex justify-end gap-1">
          <button
            type="button"
            aria-label={`Edit ${transaction.description || cat.label}`}
            onClick={() => onEdit(transaction)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-text-secondary transition-colors hover:text-text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${transaction.description || cat.label}`}
            onClick={() => onDelete(transaction)}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-soft-red text-[#A73A4C] transition-opacity hover:opacity-80"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
