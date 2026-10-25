import {
  AlertCircle,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Mail,
  Pencil,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import { formatAmount } from "@/lib/format";
import type { OccurrenceView } from "@/lib/occurrences";
import type { Bill } from "@/types/database";

const REPEAT_LABEL: Record<string, string> = {
  none: "Does not repeat",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Every 3 months",
  yearly: "Yearly",
  custom: "Custom",
};

export function BillDetailsModal({
  open,
  occurrence,
  bill,
  today,
  onClose,
  onPay,
  onEdit,
  onDelete,
}: {
  open: boolean;
  occurrence: OccurrenceView | null;
  bill?: Bill | null | undefined;
  today: string;
  onClose: () => void;
  onPay: (occurrence: OccurrenceView) => void;
  onEdit: (bill: Bill) => void;
  onDelete: (occurrence: OccurrenceView) => void;
  onSkip?: (occurrence: OccurrenceView) => void;
}) {
  if (!open || !occurrence) return null;

  const isCompleted = occurrence.isSettled || occurrence.storedStatus === "paid";
  const repeatText =
    bill?.repeat_type === "custom" && bill?.repeat_interval === 1
      ? "Daily"
      : (REPEAT_LABEL[bill?.repeat_type ?? occurrence.repeatType] ?? "Does not repeat");

  const reminderDays = bill?.reminder_days_before ?? occurrence.reminderDaysBefore ?? 3;
  const reminderTime = bill?.reminder_time?.slice(0, 5) ?? occurrence.reminderTime ?? "09:00";
  const reminderEmail = bill?.reminder_email ?? occurrence.reminderEmail;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-3 pb-6 sm:items-center sm:pb-3 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl glass-panel bg-white/95 border border-white/90 p-5 sm:p-6 shadow-2xl relative max-h-[92vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="details-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="min-w-0 pr-2">
            <h2
              id="details-title"
              className="text-lg font-bold text-slate-900 truncate leading-tight"
            >
              {occurrence.title}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Bill Details & Settings</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Amount & Status Card */}
        <div className="mt-4 rounded-2xl bg-gradient-to-br from-blue-50/80 to-indigo-50/50 p-4 text-center border border-blue-100/80">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold mb-1.5 border ${
              isCompleted
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : occurrence.status === "overdue"
                  ? "bg-rose-50 text-rose-700 border-rose-200 font-bold animate-pulse-soft"
                  : "bg-amber-50 text-amber-700 border-amber-200"
            }`}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" /> Completed
              </>
            ) : occurrence.status === "overdue" ? (
              <>
                <AlertCircle className="h-3.5 w-3.5" /> Overdue
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5" /> Due Soon
              </>
            )}
          </span>
          <p className="text-3xl font-extrabold text-slate-900 tabular-nums tracking-tight">
            {formatAmount(occurrence.amount)}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">Due on {occurrence.dueDate}</p>
        </div>

        {/* Configuration Details List */}
        <div className="mt-4 space-y-2.5 divide-y divide-slate-100 text-xs">
          {/* Due Date */}
          <div className="flex items-center justify-between pt-1">
            <span className="flex items-center gap-2 text-slate-500 font-medium">
              <Calendar className="h-4 w-4 text-slate-400" /> Payment Deadline
            </span>
            <span className="font-semibold text-slate-900 tabular-nums">{occurrence.dueDate}</span>
          </div>

          {/* Recurrence */}
          <div className="flex items-center justify-between pt-2.5">
            <span className="flex items-center gap-2 text-slate-500 font-medium">
              <Repeat className="h-4 w-4 text-slate-400" /> Recurrence
            </span>
            <span className="font-semibold text-slate-900">{repeatText}</span>
          </div>

          {/* Reminder Timing */}
          <div className="flex items-center justify-between pt-2.5">
            <span className="flex items-center gap-2 text-slate-500 font-medium">
              <Bell className="h-4 w-4 text-slate-400" /> Reminder Notice
            </span>
            <span className="font-semibold text-slate-900">
              {reminderDays === 0 ? "On due date" : `${reminderDays} days before`} at {reminderTime}
            </span>
          </div>

          {/* Reminder Email */}
          {reminderEmail && (
            <div className="flex items-center justify-between pt-2.5">
              <span className="flex items-center gap-2 text-slate-500 font-medium">
                <Mail className="h-4 w-4 text-slate-400" /> Reminder Email
              </span>
              <span className="font-semibold text-slate-900 truncate max-w-[200px]">
                {reminderEmail}
              </span>
            </div>
          )}

          {/* Notes */}
          {occurrence.notes && (
            <div className="pt-2.5">
              <span className="text-slate-500 font-medium block mb-1">Notes</span>
              <p className="text-slate-800 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                {occurrence.notes}
              </p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col gap-2">
          {/* Mark as Completed Button */}
          {!isCompleted ? (
            <button
              type="button"
              onClick={() => onPay(occurrence)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
            >
              <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
              <span>Mark as Completed</span>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 py-2.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
              <span>Completed</span>
            </div>
          )}

          {/* Edit & Delete Actions */}
          <div className="grid grid-cols-2 gap-2 mt-1">
            <button
              type="button"
              onClick={() => {
                if (bill) onEdit(bill);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5 text-slate-500" />
              <span>Edit Bill</span>
            </button>

            <button
              type="button"
              onClick={() => onDelete(occurrence)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50/50 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-500" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
