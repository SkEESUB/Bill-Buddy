import { Bell, CheckCircle2, ChevronRight, Repeat } from "lucide-react";
import { category } from "@/lib/categories";
import { formatAmount } from "@/lib/format";
import type { OccurrenceView } from "@/lib/occurrences";

const REPEAT_LABEL: Record<string, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "3 mo",
  yearly: "Yearly",
  custom: "Custom",
};

/** Compute human-friendly due status text and badge styling */
function getStatusDetails(dueDate: string, today: string, isSettled: boolean) {
  if (isSettled) {
    return {
      label: "Completed",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
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
      label: overdueDays === 1 ? "Overdue 1 day" : `Overdue ${overdueDays} days`,
      className: "bg-rose-50 text-rose-700 border-rose-200/90 font-medium",
    };
  }
  if (diffDays === 0) {
    return {
      label: "Due today",
      className: "bg-amber-50 text-amber-700 border-amber-200/90 font-medium",
    };
  }
  if (diffDays === 1) {
    return {
      label: "Due tomorrow",
      className: "bg-amber-50/80 text-amber-800 border-amber-200/70",
    };
  }
  if (diffDays <= 7) {
    return {
      label: `Due in ${diffDays} days`,
      className: "bg-sky-50 text-sky-700 border-sky-200/80",
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
    label: `Due ${d1} ${months[m1 - 1]}`,
    className: "bg-slate-100/80 text-slate-700 border-slate-200/80",
  };
}

export function BillCard({
  occurrence,
  today,
  onSelect,
}: {
  occurrence: OccurrenceView;
  today: string;
  onSelect?: (occurrence: OccurrenceView) => void;
  onPay?: (occurrence: OccurrenceView) => void;
  onEdit?: (occurrence: OccurrenceView) => void;
  onSkip?: (occurrence: OccurrenceView) => void;
  onDelete?: (occurrence: OccurrenceView) => void;
  onCopyUpi?: (upi: string) => void;
}) {
  const cat = category(occurrence.category);
  const Icon = cat.icon;
  const settled = occurrence.isSettled;
  const statusDetails = getStatusDetails(occurrence.dueDate, today, settled);

  return (
    <article
      onClick={() => onSelect?.(occurrence)}
      className="group glass-card flex items-center justify-between gap-3.5 rounded-2xl border border-white/80 p-3.5 sm:p-4 transition-all duration-200 hover:border-blue-300 hover:shadow-md active:scale-[0.99] cursor-pointer"
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
      {/* Category Icon */}
      <div className="flex items-center gap-3 min-w-0">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105"
          style={{ backgroundColor: `${cat.color}14`, color: cat.color }}
        >
          <Icon className="h-5 w-5 stroke-[2.2]" />
        </span>

        {/* Title, Status & Metadata */}
        <div className="min-w-0">
          <h3 className="truncate text-sm sm:text-[15px] font-semibold text-slate-900 group-hover:text-blue-600 transition-colors leading-snug">
            {occurrence.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] border ${statusDetails.className}`}
            >
              {settled ? (
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 stroke-[2.5]" /> Paid
                </span>
              ) : (
                statusDetails.label
              )}
            </span>

            {/* Reminder indicator */}
            {occurrence.reminderTime && !settled && (
              <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 font-medium">
                <Bell className="h-3 w-3 text-slate-400 stroke-[2]" />
                <span>{occurrence.reminderTime.slice(0, 5)}</span>
              </span>
            )}

            {occurrence.isRecurring && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                <Repeat className="h-3 w-3 text-slate-400 stroke-[2]" />
                {REPEAT_LABEL[occurrence.repeatType] ?? "Repeat"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Amount & Right Interaction */}
      <div className="flex items-center gap-2.5 shrink-0 text-right">
        <div>
          <p className="text-sm sm:text-base font-bold tabular-nums text-slate-900">
            {formatAmount(occurrence.amount)}
          </p>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">{cat.label}</p>
        </div>

        <div className="flex items-center text-slate-400 group-hover:text-blue-600 transition-colors pl-1">
          <ChevronRight className="h-4 w-4 stroke-[2.2]" />
        </div>
      </div>
    </article>
  );
}
