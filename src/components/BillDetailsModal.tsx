import { useState } from "react";
import {
  Calendar,
  Clock,
  Copy,
  CreditCard,
  FileText,
  Pencil,
  Repeat,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { category } from "@/lib/categories";
import { formatAmount, formatDue } from "@/lib/format";
import { STATUS_BADGES, type OccurrenceView } from "@/lib/occurrences";
import type { Bill } from "@/types/database";

export function BillDetailsModal({
  open,
  occurrence,
  bill,
  today,
  onClose,
  onPay,
  onEdit,
  onDelete,
  onSkip,
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

  const cat = category(occurrence.category);
  const Icon = cat.icon;
  const badge = STATUS_BADGES[occurrence.status];
  const isPaid = occurrence.isSettled || occurrence.storedStatus === "paid";

  const copyUpi = (upi: string) => {
    void navigator.clipboard?.writeText(upi);
    toast.success("UPI ID copied to clipboard");
  };

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
        aria-label="Bill Details"
      >
        {/* Header with Category Icon and Close button */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ backgroundColor: `${cat.color}20`, color: cat.color }}
            >
              <Icon className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-text-primary leading-tight">
                {occurrence.title}
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">{cat.label}</p>
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

        {/* Big Amount & Status Badge matching Phase 3 Screen 7 */}
        <div className="mt-4 rounded-2xl bg-muted/60 p-4 text-center border border-border-light/60">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold mb-2"
            style={{ backgroundColor: badge.bg, color: badge.color }}
          >
            {isPaid ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
            {badge.label}
          </span>
          <p className="text-3xl font-extrabold text-text-primary tabular-nums tracking-tight">
            {formatAmount(occurrence.amount)}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            {formatDue(occurrence.dueDate, today)} · Due on {occurrence.dueDate}
          </p>
        </div>

        {/* Details List */}
        <div className="mt-5 space-y-3 divide-y divide-border-light/60 text-xs">
          {/* Due Date */}
          <div className="flex items-center justify-between pt-2">
            <span className="flex items-center gap-2 text-text-secondary font-medium">
              <Calendar className="h-4 w-4 text-text-tertiary" /> Due Date
            </span>
            <span className="font-semibold text-text-primary tabular-nums">
              {occurrence.dueDate}
            </span>
          </div>

          {/* Recurrence */}
          <div className="flex items-center justify-between pt-2.5">
            <span className="flex items-center gap-2 text-text-secondary font-medium">
              <Repeat className="h-4 w-4 text-text-tertiary" /> Frequency
            </span>
            <span className="font-semibold text-text-primary capitalize">
              {occurrence.isRecurring ? occurrence.repeatType : "One-time"}
            </span>
          </div>

          {/* Reminder */}
          <div className="flex items-center justify-between pt-2.5">
            <span className="flex items-center gap-2 text-text-secondary font-medium">
              <Clock className="h-4 w-4 text-text-tertiary" /> Reminder
            </span>
            <span className="font-semibold text-text-primary">
              {bill?.reminder_days_before ? `${bill.reminder_days_before} days before` : "1 day before"}
            </span>
          </div>

          {/* UPI ID if available */}
          {occurrence.upiId && (
            <div className="flex items-center justify-between pt-2.5">
              <span className="flex items-center gap-2 text-text-secondary font-medium">
                <CreditCard className="h-4 w-4 text-text-tertiary" /> UPI ID
              </span>
              <button
                type="button"
                onClick={() => copyUpi(occurrence.upiId!)}
                className="flex items-center gap-1.5 font-semibold text-primary hover:underline cursor-pointer"
              >
                <span>{occurrence.upiId}</span>
                <Copy className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Notes if available */}
          {occurrence.notes && (
            <div className="pt-2.5">
              <span className="flex items-center gap-2 text-text-secondary font-medium mb-1">
                <FileText className="h-4 w-4 text-text-tertiary" /> Notes
              </span>
              <p className="text-text-primary bg-background/60 p-2.5 rounded-xl border border-border-light/60">
                {occurrence.notes}
              </p>
            </div>
          )}
        </div>

        {/* Primary & Secondary Action Buttons matching Phase 3 Screen 7 */}
        <div className="mt-6 space-y-2.5">
          {!isPaid ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onPay(occurrence);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#4F46E5] to-[#6366F1] py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
            >
              <CreditCard className="h-4 w-4 stroke-[2.2]" />
              <span>Pay Now</span>
            </button>
          ) : (
            <div className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 py-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>Bill Paid in Full</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (bill) {
                  onClose();
                  onEdit(bill);
                }
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-border-light bg-surface py-2.5 text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-muted transition-colors cursor-pointer"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Bill</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onDelete(occurrence);
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/30 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-100 transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
