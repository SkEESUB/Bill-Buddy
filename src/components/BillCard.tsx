import { CheckCircle2, ChevronRight, Repeat } from "lucide-react";
import { category } from "@/lib/categories";
import { formatAmount, formatDue } from "@/lib/format";
import { STATUS_BADGES, type OccurrenceView } from "@/lib/occurrences";

const REPEAT_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Every 3 mo",
  yearly: "Yearly",
  custom: "Custom",
};

/**
 * Clean fintech bill card strictly matching media_1792824194145.jpg Phase 3 & Phase 1.
 * Removed left border alert stripes and cluttering inline menus.
 * Tapping opens the comprehensive BillDetailsModal with full actions.
 */
export function BillCard({
  occurrence,
  today,
  onPay,
  onEdit,
  onSkip,
  onDelete,
  onCopyUpi,
  onSelect,
}: {
  occurrence: OccurrenceView;
  today: string;
  onPay: (occurrence: OccurrenceView) => void;
  onEdit?: (occurrence: OccurrenceView) => void;
  onSkip?: (occurrence: OccurrenceView) => void;
  onDelete?: (occurrence: OccurrenceView) => void;
  onCopyUpi?: (upi: string) => void;
  onSelect?: (occurrence: OccurrenceView) => void;
}) {
  const cat = category(occurrence.category);
  const Icon = cat.icon;
  const badge = STATUS_BADGES[occurrence.status];
  const settled = occurrence.isSettled;

  const handleClick = () => {
    if (onSelect) {
      onSelect(occurrence);
    } else {
      onPay(occurrence);
    }
  };

  return (
    <article
      onClick={handleClick}
      className="group card card-hover flex items-center justify-between gap-3.5 rounded-[24px] border border-border-light/70 bg-surface p-4 transition-all duration-200 hover:border-primary/40 hover:shadow-md cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${occurrence.title}, ${formatAmount(occurrence.amount)}, ${badge.label}`}
    >
      {/* Category Icon */}
      <div className="flex items-center gap-3.5 min-w-0">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
        >
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>

        {/* Title & Metadata */}
        <div className="min-w-0">
          <h3 className="truncate text-[15px] font-bold text-text-primary group-hover:text-primary transition-colors leading-snug">
            {occurrence.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                occurrence.status === "overdue" ? "animate-pulse-soft" : ""
              }`}
              style={{ backgroundColor: badge.bg, color: badge.color }}
            >
              {settled ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> Paid
                </span>
              ) : (
                formatDue(occurrence.dueDate, today)
              )}
            </span>

            {occurrence.isRecurring && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-text-tertiary">
                <Repeat className="h-3 w-3" />
                {REPEAT_LABEL[occurrence.repeatType] ?? "Recurring"}
              </span>
            )}

            {!occurrence.isActive && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-text-secondary">
                Paused
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Amount & Quick Action */}
      <div className="flex items-center gap-3 shrink-0 text-right">
        <div>
          <p className="text-[16px] sm:text-[17px] font-bold tabular-nums text-text-primary">
            {formatAmount(occurrence.amount)}
          </p>
          <p className="text-[11px] font-medium text-text-tertiary mt-0.5">
            {cat.label}
          </p>
        </div>

        <div className="hidden sm:flex items-center">
          {settled ? (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </span>
          ) : (
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-text-tertiary group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
