import { ChevronRight } from "lucide-react";
import { moneyCategory } from "@/lib/categories";
import { formatAmount, formatDate } from "@/lib/format";
import type { Transaction } from "@/types/database";

/**
 * Clean fintech transaction row matching media_1792824194145.jpg Phase 4 Screen 1.
 * Removed permanently visible edit/delete action clutter from the list row.
 * Tapping opens the TransactionDetailsModal with full actions.
 */
export function TransactionCard({
  transaction,
  onEdit,
  onDelete,
  onSelect,
}: {
  transaction: Transaction;
  onEdit: (t: Transaction) => void;
  onDelete?: (t: Transaction) => void;
  onSelect?: (t: Transaction) => void;
}) {
  const cat = moneyCategory(transaction.category);
  const Icon = cat.icon;
  const income = transaction.type === "income";

  const handleClick = () => {
    if (onSelect) {
      onSelect(transaction);
    } else {
      onEdit(transaction);
    }
  };

  return (
    <article
      onClick={handleClick}
      className="group card card-hover flex items-center justify-between gap-3.5 rounded-[22px] border border-border-light/70 bg-surface p-3.5 sm:p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${transaction.description || cat.label}, ${income ? "+" : "-"}${formatAmount(Number(transaction.amount))}, ${formatDate(transaction.date)}`}
    >
      {/* Category Icon */}
      <div className="flex items-center gap-3.5 min-w-0">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>

        {/* Description & Category / Date */}
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-text-primary group-hover:text-primary transition-colors leading-snug">
            {transaction.description || cat.label}
          </p>
          <p className="mt-0.5 truncate text-[12px] font-medium text-text-tertiary">
            {cat.label} · {formatDate(transaction.date)}
          </p>
        </div>
      </div>

      {/* Amount & Chevron */}
      <div className="flex items-center gap-2.5 shrink-0 text-right">
        <div>
          <p
            className={`text-[15px] sm:text-[16px] font-bold tabular-nums tracking-tight ${
              income ? "text-emerald-600 dark:text-emerald-400" : "text-text-primary"
            }`}
          >
            {income ? "+" : "−"}
            {formatAmount(Number(transaction.amount))}
          </p>
          {transaction.payment_method && (
            <p className="text-[10px] font-medium text-text-tertiary uppercase tracking-wider mt-0.5">
              {transaction.payment_method}
            </p>
          )}
        </div>

        <span className="hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-text-tertiary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </article>
  );
}
