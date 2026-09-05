import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, MoreVertical, Pencil, Repeat, SkipForward, Trash2 } from "lucide-react";
import { category } from "@/lib/categories";
import { formatAmount, formatDue } from "@/lib/format";
import { STATUS_BADGES, type OccurrenceView } from "@/lib/occurrences";

const REPEAT_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  yearly: "Yearly",
  custom: "Custom",
};

/**
 * One scheduled bill instalment, styled as a wallet card. The card renders the
 * server-derived status — it never decides on its own whether a bill is paid.
 */
export function BillCard({
  occurrence,
  today,
  onPay,
  onEdit,
  onSkip,
  onDelete,
  onCopyUpi,
}: {
  occurrence: OccurrenceView;
  today: string;
  onPay: (occurrence: OccurrenceView) => void;
  onEdit: (occurrence: OccurrenceView) => void;
  onSkip: (occurrence: OccurrenceView) => void;
  onDelete: (occurrence: OccurrenceView) => void;
  onCopyUpi: (upi: string) => void;
}) {
  const cat = category(occurrence.category);
  const Icon = cat.icon;
  const badge = STATUS_BADGES[occurrence.status];
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const settled = occurrence.isSettled;

  return (
    <article className="card card-hover relative overflow-hidden rounded-[22px] p-4">
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: cat.color }}
      />

      <div className="flex items-start gap-3 pl-2">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-lilac/50"
          style={{ color: cat.color }}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-[16px] font-semibold leading-tight text-text-primary">
                {occurrence.title}
              </h3>
              <p className="mt-0.5 text-[13px] text-text-secondary">{cat.label}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[19px] font-bold tabular-nums text-primary">
                {formatAmount(occurrence.amount)}
              </p>
              <p className="text-[13px] text-text-secondary">
                {formatDue(occurrence.dueDate, today)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                occurrence.status === "overdue" ? "animate-pulse-soft" : ""
              }`}
              style={{ backgroundColor: badge.bg, color: badge.color }}
            >
              {badge.label}
            </span>
            {occurrence.isRecurring ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-elevated px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                <Repeat className="h-3 w-3" />
                {REPEAT_LABEL[occurrence.repeatType] ?? "Recurring"}
              </span>
            ) : null}
            {!occurrence.isActive ? (
              <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                Paused
              </span>
            ) : null}
            {occurrence.upiId ? (
              <button
                type="button"
                onClick={() => onCopyUpi(occurrence.upiId!)}
                className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-soft-blue px-2.5 py-1 text-[11px] font-medium text-primary"
                aria-label={`Copy UPI ID ${occurrence.upiId}`}
              >
                <Copy className="h-3 w-3 shrink-0" />
                <span className="truncate">{occurrence.upiId}</span>
              </button>
            ) : null}
          </div>

          <div className="mt-3 flex items-center gap-2">
            {settled ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
                <CheckCircle2 className="h-4 w-4" /> {badge.label}
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-primary !min-h-11 flex-1 !rounded-full !text-sm"
                onClick={() => onPay(occurrence)}
              >
                Pay now
              </button>
            )}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label={`More actions for ${occurrence.title}`}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border-light text-text-secondary transition-colors hover:border-primary hover:text-primary"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div
                  role="menu"
                  className="animate-scale-in absolute bottom-12 right-0 z-20 w-48 overflow-hidden rounded-2xl border border-border-light bg-surface shadow-[0_16px_40px_-12px_rgba(16,24,40,0.24)]"
                >
                  <button
                    role="menuitem"
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-text-primary hover:bg-elevated"
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(occurrence);
                    }}
                  >
                    <Pencil className="h-4 w-4" /> Edit bill
                  </button>
                  {!settled ? (
                    <button
                      role="menuitem"
                      type="button"
                      className="flex w-full items-center gap-2 px-4 py-3 text-sm text-text-primary hover:bg-elevated"
                      onClick={() => {
                        setMenuOpen(false);
                        onSkip(occurrence);
                      }}
                    >
                      <SkipForward className="h-4 w-4" /> Skip this one
                    </button>
                  ) : null}
                  <button
                    role="menuitem"
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm text-error hover:bg-elevated"
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(occurrence);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete bill
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
