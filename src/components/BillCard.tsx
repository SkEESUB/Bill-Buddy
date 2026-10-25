import { Bell, CheckCircle2, ChevronRight, Repeat } from "lucide-react";
import { category } from "@/lib/categories";
import { formatAmount } from "@/lib/format";
import { BillBuddyLogo } from "@/components/BillBuddyLogo";
import type { OccurrenceView } from "@/lib/occurrences";

const REPEAT_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "3 mo",
  yearly: "Yearly",
  custom: "Custom",
};

/** Compute human-friendly due status text, badge styling, and animation category */
function getStatusDetails(dueDate: string, today: string, isSettled: boolean) {
  if (isSettled) {
    return {
      statusType: "completed" as const,
      label: "Completed",
      className:
        "bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/60",
    };
  }

  const parts1 = dueDate.split("-").map(Number);
  const parts2 = today.split("-").map(Number);
  const y1 = parts1[0] ?? 0;
  const m1 = parts1[1] ?? 1;
  const d1 = parts1[2] ?? 1;
  const y2 = parts2[0] ?? 0;
  const m2 = parts2[1] ?? 1;
  const d2 = parts2[2] ?? 1;
  const due = new Date(y1, m1 - 1, d1).getTime();
  const now = new Date(y2, m2 - 1, d2).getTime();
  const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      statusType: "overdue" as const,
      label: overdueDays === 1 ? "Overdue 1 day" : `Overdue ${overdueDays} days`,
      className:
        "bg-rose-50 text-rose-700 border-rose-200/90 font-medium dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/60",
    };
  }
  if (diffDays === 0) {
    return {
      statusType: "due-soon" as const,
      label: "Due today",
      className:
        "bg-amber-50 text-amber-700 border-amber-200/90 font-medium dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/60",
    };
  }
  if (diffDays === 1) {
    return {
      statusType: "due-soon" as const,
      label: "Due tomorrow",
      className:
        "bg-amber-50/80 text-amber-800 border-amber-200/70 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/50",
    };
  }
  if (diffDays <= 7) {
    return {
      statusType: "upcoming" as const,
      label: `Due in ${diffDays} days`,
      className:
        "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800/60",
    };
  }

  // Format date e.g. "Due 15 Nov"
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return {
    statusType: "upcoming" as const,
    label: `Due ${d1} ${months[m1 - 1]}`,
    className:
      "bg-slate-100/80 text-slate-700 border-slate-200/80 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700/60",
  };
}

export function BillCard({
  occurrence,
  today,
  index = 0,
  onSelect,
}: {
  occurrence: OccurrenceView;
  today: string;
  index?: number;
  onSelect?: (occurrence: OccurrenceView) => void;
  onPay?: (occurrence: OccurrenceView) => void;
  onEdit?: (occurrence: OccurrenceView) => void;
  onSkip?: (occurrence: OccurrenceView) => void;
  onDelete?: (occurrence: OccurrenceView) => void;
  onCopyUpi?: (upi: string) => void;
}) {
  const cat = category(occurrence.category);
  const settled = occurrence.isSettled;
  const statusDetails = getStatusDetails(occurrence.dueDate, today, settled);

  const statusClass = `status-${statusDetails.statusType}`;
  const floatClass = !settled ? "bill-card-floating" : "";
  const floatDelay = `${((index % 5) * 0.4).toFixed(1)}s`;

  return (
    <article
      onClick={() => onSelect?.(occurrence)}
      className={`group bill-card-premium ${statusClass} ${floatClass} flex items-center justify-between gap-3.5 p-3.5 sm:p-4 cursor-pointer`}
      style={{ animationDelay: floatDelay }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.(occurrence);
        }
      }}
      aria-label={`${occurrence.title}, ${formatAmount(occurrence.amount)}, ${statusDetails.label}`}
    >
      {/* Primary Branded BillBuddy Icon */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500/15 via-indigo-500/15 to-purple-500/15 text-blue-600 dark:text-indigo-400 border border-blue-200/50 dark:border-indigo-500/30 shadow-sm transition-all duration-200 group-hover:scale-108 group-hover:shadow-md group-hover:from-blue-600/25 group-hover:to-purple-600/25"
        >
          <BillBuddyLogo size={20} className="stroke-[2.3]" />
        </span>

        {/* Title, Status & Metadata */}
        <div className="min-w-0">
          <h3 className="truncate text-sm sm:text-[15px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
            {occurrence.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border transition-colors duration-200 ${statusDetails.className}`}
            >
              {settled ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 stroke-[2.5]" /> Paid
                </span>
              ) : occurrence.isRecurring ? (
                `Next: ${statusDetails.label}`
              ) : (
                statusDetails.label
              )}
            </span>

            {/* Recurrence frequency badge */}
            {occurrence.isRecurring && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200/70 dark:border-indigo-800/50">
                <Repeat className="h-3 w-3 text-indigo-500 dark:text-indigo-400 stroke-[2.2]" />
                {REPEAT_LABEL[occurrence.repeatType] ?? "Recurring"}
              </span>
            )}

            {/* Reminder indicator */}
            {occurrence.reminderTime && !settled && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                <Bell className="h-3 w-3 text-slate-400 dark:text-slate-500 stroke-[2]" />
                <span>{occurrence.reminderTime.slice(0, 5)}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Amount & Right Interaction */}
      <div className="flex items-center gap-2.5 shrink-0 text-right">
        <div>
          <p className="text-sm sm:text-base font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {formatAmount(occurrence.amount)}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            {cat.label}
          </p>
        </div>

        <div className="flex items-center text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-indigo-400 transition-all duration-200 group-hover:translate-x-0.5 pl-1">
          <ChevronRight className="h-4 w-4 stroke-[2.2]" />
        </div>
      </div>
    </article>
  );
}
