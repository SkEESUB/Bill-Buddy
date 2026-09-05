import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { moneyCategory } from "@/lib/categories";
import { formatAmount } from "@/lib/format";
import {
  amountPrefix,
  direction,
  isSettled,
  methodLabel,
  statusLabel,
  typeLabel,
  type LedgerRow,
} from "@/lib/transactions";

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  pending: { bg: "#FFF3E0", color: "#8A5A16" },
  failed: { bg: "#FCEAED", color: "#A73A4C" },
  cancelled: { bg: "#EFEDF1", color: "#6E5B69" },
  reversed: { bg: "#EEE5F5", color: "#4B1D3F" },
};

/** One ledger line linking to its detail page. */
export function LedgerRowCard({ row }: { row: LedgerRow }) {
  const cat = moneyCategory(row.category);
  const Icon = cat.icon;
  const dir = direction(row.type, Number(row.amount));
  const settled = isSettled(row);
  const badge = STATUS_STYLES[row.status];

  const color =
    !settled || dir === 0
      ? "var(--text-secondary)"
      : dir > 0
        ? "var(--status-success)"
        : "var(--primary)";

  return (
    <Link
      to="/transactions/$id"
      params={{ id: row.id }}
      className="card flex items-center gap-3 rounded-[22px] p-4 transition-transform active:scale-[0.995]"
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lilac/50"
        style={{ color: cat.color }}
        aria-hidden="true"
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-text-primary">
          {row.description || typeLabel(row.type)}
        </p>
        <p className="mt-0.5 truncate text-[13px] text-text-secondary">
          {cat.label} · {methodLabel(row.payment_method)}
        </p>
        {badge ? (
          <span
            className="mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {statusLabel(row.status)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1">
        <p
          className="text-[17px] font-bold tabular-nums"
          style={{ color, textDecoration: row.status === "reversed" ? "line-through" : undefined }}
        >
          {amountPrefix(row)}
          {formatAmount(Math.abs(Number(row.amount)))}
        </p>
        <ChevronRight className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
      </div>
    </Link>
  );
}
