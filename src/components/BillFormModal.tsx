import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  IndianRupee,
  Loader2,
  Mail,
  Repeat,
  X,
} from "lucide-react";
import { addDays, toDay } from "@/lib/format";
import { useAuth } from "@/hooks/useAuth";
import type { BillInput } from "@/lib/bills.functions";
import type { Bill } from "@/types/database";

export type { BillInput };

type RepeatOption = "none" | "daily" | "weekly" | "monthly" | "yearly";

const REPEAT_OPTIONS: { label: string; value: RepeatOption }[] = [
  { label: "Does not repeat", value: "none" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

const REMINDER_BEFORE_OPTIONS = [
  { label: "On due date", days: 0 },
  { label: "1 day before", days: 1 },
  { label: "3 days before", days: 3 },
  { label: "7 days before", days: 7 },
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FormErrors {
  title?: string;
  amount?: string;
  dueDate?: string;
  reminderEmail?: string;
}

export function BillFormModal({
  open,
  bill,
  onClose,
  onSubmit,
}: {
  open: boolean;
  bill?: Bill | null;
  onClose: () => void;
  onSubmit: (values: BillInput) => Promise<void>;
}) {
  const { user } = useAuth();
  const isEdit = !!bill;
  const tomorrow = useMemo(() => toDay(addDays(new Date(), 1)), []);

  // Form State
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(tomorrow);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [reminderEmail, setReminderEmail] = useState("");
  const [repeat, setRepeat] = useState<RepeatOption>("none");
  const [reminderDaysBefore, setReminderDaysBefore] = useState(3);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  // Validation & Submission
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Initialize or reset when modal opens or bill changes
  useEffect(() => {
    if (!open) return;
    if (bill) {
      setTitle(bill.title ?? "");
      setAmount(bill.amount ? String(bill.amount) : "");
      setDueDate(bill.due_date ?? tomorrow);
      setReminderTime(bill.reminder_time ? bill.reminder_time.slice(0, 5) : "09:00");
      setReminderEmail(bill.reminder_email ?? user?.email ?? "");

      // Determine repeat option
      if (bill.repeat_type === "custom" && bill.repeat_interval === 1) {
        setRepeat("daily");
      } else if (
        bill.repeat_type === "weekly" ||
        bill.repeat_type === "monthly" ||
        bill.repeat_type === "yearly"
      ) {
        setRepeat(bill.repeat_type);
      } else {
        setRepeat("none");
      }

      setReminderDaysBefore(bill.reminder_days_before ?? 3);
      setNotes(bill.notes ?? "");
      setShowNotes(Boolean(bill.notes));
    } else {
      // New bill defaults
      setTitle("");
      setAmount("");
      setDueDate(tomorrow);
      setReminderTime("09:00");
      setReminderEmail(user?.email ?? "");
      setRepeat("none");
      setReminderDaysBefore(3);
      setNotes("");
      setShowNotes(false);
    }
    setErrors({});
  }, [open, bill, tomorrow, user?.email]);

  if (!open) return null;

  const validateForm = (): boolean => {
    const errs: FormErrors = {};

    if (!title.trim()) {
      errs.title = "Bill name is required";
    }

    const numAmount = Number(amount);
    if (
      !amount.trim() ||
      Number.isNaN(numAmount) ||
      !Number.isFinite(numAmount) ||
      numAmount <= 0
    ) {
      errs.amount = "Enter a valid amount greater than ₹0";
    }

    if (!dueDate) {
      errs.dueDate = "Please select a due date";
    }

    if (reminderEmail.trim() && !EMAIL_REGEX.test(reminderEmail.trim())) {
      errs.reminderEmail = "Enter a valid email address";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Map recurrence option to backend repeat_type & repeat_interval
      let repeatType: "none" | "weekly" | "monthly" | "yearly" | "custom" = "none";
      let repeatInterval = 1;

      if (repeat === "daily") {
        repeatType = "custom";
        repeatInterval = 1;
      } else if (repeat !== "none") {
        repeatType = repeat;
      }

      await onSubmit({
        title: title.trim(),
        amount: Number(amount),
        category: "general",
        due_date: dueDate,
        reminder_time: reminderTime,
        reminder_email: reminderEmail.trim() || null,
        repeat_type: repeatType,
        repeat_interval: repeatInterval,
        reminder_days_before: reminderDaysBefore,
        notes: notes.trim() || null,
        amount_type: "fixed",
      });
      onClose();
    } catch {
      // Errors handled by parent with toast
    } finally {
      setSubmitting(false);
    }
  };

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
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-slate-900 leading-tight">
              {isEdit ? "Edit Bill" : "Add Bill"}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEdit
                ? "Update your bill details and reminder schedule"
                : "Set up a due date and automated email reminder"}
            </p>
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
          {/* 1. Bill Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Bill Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Electricity Bill, Internet, College Fee"
              className={`w-full h-11 px-3.5 rounded-xl border text-sm font-medium bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                errors.title ? "border-rose-400 ring-rose-200" : "border-slate-200"
              }`}
              autoFocus
            />
            {errors.title && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.title}</p>
            )}
          </div>

          {/* 2. Amount (in Indian Rupees) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (₹) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-sm">
                ₹
              </span>
              <input
                type="number"
                step="any"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`w-full h-11 pl-8 pr-3.5 rounded-xl border text-sm font-semibold tabular-nums bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  errors.amount ? "border-rose-400 ring-rose-200" : "border-slate-200"
                }`}
              />
            </div>
            {errors.amount && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.amount}</p>
            )}
          </div>

          {/* 3. Due Date & Reminder Time (Side by Side) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Due Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={`w-full h-11 px-3 rounded-xl border text-xs sm:text-sm font-medium bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    errors.dueDate ? "border-rose-400" : "border-slate-200"
                  }`}
                />
              </div>
              {errors.dueDate && (
                <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.dueDate}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reminder Time
              </label>
              <div className="relative">
                <input
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm font-medium bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>
          </div>

          {/* 4. Reminder Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reminder Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="email"
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
                placeholder="Where should reminders be sent?"
                className={`w-full h-11 pl-10 pr-3.5 rounded-xl border text-sm font-medium bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                  errors.reminderEmail ? "border-rose-400" : "border-slate-200"
                }`}
              />
            </div>
            {errors.reminderEmail && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">{errors.reminderEmail}</p>
            )}
          </div>

          {/* 5. Repeat Recurrence */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Repeat</label>
            <div className="flex flex-wrap gap-1.5">
              {REPEAT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRepeat(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                    repeat === opt.value
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Reminder Before Due Date */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reminder Notification
            </label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {REMINDER_BEFORE_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  type="button"
                  onClick={() => setReminderDaysBefore(opt.days)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all cursor-pointer ${
                    reminderDaysBefore === opt.days
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 7. Collapsible Notes */}
          <div>
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
            >
              <span>{showNotes ? "Hide Notes" : "+ Add Note"}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${showNotes ? "rotate-180" : ""}`}
              />
            </button>
            {showNotes && (
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional payment link, account ID, or reminder notes..."
                rows={2}
                className="mt-2 w-full p-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              />
            )}
          </div>

          {/* Primary Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-md shadow-blue-500/25 transition-all hover:brightness-105 active:scale-[0.99] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Add Bill"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
