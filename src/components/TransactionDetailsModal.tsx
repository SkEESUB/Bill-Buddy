import {
  Calendar,
  CreditCard,
  FileText,
  Pencil,
  Trash2,
  X,
  ArrowDownLeft,
  ArrowUpRight,
  Tag,
  CheckCircle2,
} from "lucide-react";
import { formatAmount } from "@/lib/format";
import { moneyCategory } from "@/lib/categories";
import type { Transaction } from "@/types/database";

export function TransactionDetailsModal({
  open,
  transaction,
  onClose,
  onEdit,
  onDelete,
}: {
  open: boolean;
  transaction: Transaction | null;
  onClose: () => void;
  onEdit: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}) {
  if (!open || !transaction) return null;

  const isIncome = transaction.type === "income";
  const cat = moneyCategory(transaction.category);
  const Icon = cat.icon;
  const amount = Number(transaction.amount);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 pb-8 sm:items-center sm:pb-4 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-[32px] border border-border-light bg-surface p-6 shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Transaction Details"
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                isIncome
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "bg-rose-500/15 text-rose-600"
              }`}
            >
              {isIncome ? (
                <ArrowDownLeft className="h-6 w-6 stroke-[2.2]" />
              ) : (
                <ArrowUpRight className="h-6 w-6 stroke-[2.2]" />
              )}
            </span>
            <div>
              <h2 className="text-lg font-bold text-text-primary leading-tight">
                {transaction.description || cat.label}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5 capitalize">
                {transaction.type} · {cat.label}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Big Amount Card matching Phase 4 Screen 5 */}
        <div className="mt-4 rounded-2xl bg-muted/60 p-5 text-center border border-border-light/60">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold mb-2 ${
              isIncome
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Completed
          </span>
          <p
            className={`text-3xl font-extrabold tabular-nums tracking-tight ${
              isIncome ? "text-emerald-600 dark:text-emerald-400" : "text-text-primary"
            }`}
          >
            {isIncome ? "+" : "-"}
            {formatAmount(amount)}
          </p>
          <p className="text-xs text-text-secondary mt-1">Recorded on {transaction.date}</p>
        </div>

        {/* Details Table */}
        <div className="mt-5 space-y-3 divide-y divide-border-light/60 text-xs">
          <div className="flex items-center justify-between pt-2">
            <span className="flex items-center gap-2 text-text-secondary font-medium">
              <Calendar className="h-4 w-4 text-text-tertiary" /> Date
            </span>
            <span className="font-semibold text-text-primary tabular-nums">
              {transaction.date}
            </span>
          </div>

          <div className="flex items-center justify-between pt-2.5">
            <span className="flex items-center gap-2 text-text-secondary font-medium">
              <Tag className="h-4 w-4 text-text-tertiary" /> Category
            </span>
            <span className="font-semibold text-text-primary">{cat.label}</span>
          </div>

          <div className="flex items-center justify-between pt-2.5">
            <span className="flex items-center gap-2 text-text-secondary font-medium">
              <CreditCard className="h-4 w-4 text-text-tertiary" /> Payment Method
            </span>
            <span className="font-semibold text-text-primary uppercase">
              {transaction.payment_method || "UPI"}
            </span>
          </div>

          {transaction.notes && (
            <div className="pt-2.5">
              <span className="flex items-center gap-2 text-text-secondary font-medium mb-1">
                <FileText className="h-4 w-4 text-text-tertiary" /> Notes
              </span>
              <p className="text-text-primary bg-background/60 p-2.5 rounded-xl border border-border-light/60">
                {transaction.notes}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons matching Phase 4 Screen 5 */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onEdit(transaction);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-border-light bg-surface py-3 text-xs font-bold text-text-primary hover:bg-muted transition-colors cursor-pointer"
          >
            <Pencil className="h-4 w-4" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onDelete(transaction);
            }}
            className="flex items-center justify-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/60 dark:bg-rose-950/40 py-3 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </button>
        </div>
      </div>
    </div>
  );
}
