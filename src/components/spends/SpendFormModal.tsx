import { useEffect, useState } from "react";
import { Calendar, Loader2, X } from "lucide-react";
import type { Spend } from "@/types/database";
import type { SpendInput } from "@/lib/spends.functions";

interface SpendFormModalProps {
  open: boolean;
  spend?: Spend | null;
  defaultDate: string;
  today: string;
  onClose: () => void;
  onSubmit: (values: SpendInput) => Promise<void>;
}

interface FormErrors {
  name?: string | undefined;
  amount?: string | undefined;
  spendDate?: string | undefined;
}

export function SpendFormModal({
  open,
  spend,
  defaultDate,
  today,
  onClose,
  onSubmit,
}: SpendFormModalProps) {
  const isEdit = !!spend;

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [spendDate, setSpendDate] = useState(defaultDate);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Sync state whenever modal opens or target spend changes
  useEffect(() => {
    if (open) {
      if (spend) {
        setName(spend.name);
        setAmount(String(spend.amount));
        setSpendDate(spend.spend_date);
        setNotes(spend.notes || "");
      } else {
        setName("");
        setAmount("");
        setSpendDate(defaultDate || today);
        setNotes("");
      }
      setErrors({});
      setSubmitting(false);
    }
  }, [open, spend, defaultDate, today]);

  if (!open) return null;

  const validate = (): boolean => {
    const errs: FormErrors = {};

    if (!name.trim()) {
      errs.name = "Spend name is required";
    }

    const numAmount = Number(amount);
    if (
      !amount.trim() ||
      Number.isNaN(numAmount) ||
      !Number.isFinite(numAmount) ||
      numAmount <= 0
    ) {
      errs.amount = "Enter a valid amount > ₹0";
    }

    if (!spendDate) {
      errs.spendDate = "Please select a date";
    } else if (spendDate > today) {
      errs.spendDate = "Future dates are not permitted";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        amount: Number(amount),
        spend_date: spendDate,
        notes: notes.trim() || null,
      });
      onClose();
    } catch {
      // Error handling with sonner is managed by parent caller
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs p-3 pb-6 sm:items-center sm:pb-3 animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-3xl glass-panel bg-white/95 border border-white/90 p-4 sm:p-5 shadow-2xl relative max-h-[90vh] overflow-y-auto animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="spend-form-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-100/60 p-1">
              <img src="/spends-icon.png" alt="Spend" className="h-full w-full object-contain" />
            </div>
            <div>
              <h2
                id="spend-form-title"
                className="text-base sm:text-lg font-bold text-slate-900 leading-tight"
              >
                {isEdit ? "Edit Spend" : "Add Spend"}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {isEdit ? "Update your expense record" : "Record your daily expense"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-3">
          {/* 1. Spend Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Spend Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="e.g. Breakfast, Petrol, Bus fare, Coffee, Shopping"
              className={`w-full h-10 px-3 rounded-xl border text-xs sm:text-sm font-medium bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                errors.name ? "border-rose-400 ring-rose-200" : "border-slate-200"
              }`}
              autoFocus
            />
            {errors.name && (
              <p className="text-[11px] text-rose-600 font-medium mt-0.5">{errors.name}</p>
            )}
          </div>

          {/* 2. Amount & Date (2 Columns) */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Amount (₹) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-semibold text-xs sm:text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    if (errors.amount) setErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  placeholder="0.00"
                  className={`w-full h-10 pl-7 pr-2.5 rounded-xl border text-xs sm:text-sm font-semibold tabular-nums bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    errors.amount ? "border-rose-400 ring-rose-200" : "border-slate-200"
                  }`}
                />
              </div>
              {errors.amount && (
                <p className="text-[11px] text-rose-600 font-medium mt-0.5">{errors.amount}</p>
              )}
            </div>

            {/* Date (strictly NO time field) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={spendDate}
                  max={today}
                  onChange={(e) => {
                    setSpendDate(e.target.value);
                    if (errors.spendDate) setErrors((prev) => ({ ...prev, spendDate: undefined }));
                  }}
                  className={`w-full h-10 px-2.5 rounded-xl border text-xs sm:text-sm font-medium bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all ${
                    errors.spendDate ? "border-rose-400 ring-rose-200" : "border-slate-200"
                  }`}
                />
              </div>
              {errors.spendDate && (
                <p className="text-[11px] text-rose-600 font-medium mt-0.5">{errors.spendDate}</p>
              )}
            </div>
          </div>

          {/* 3. Note (Optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Note <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Paid with UPI, snacks with friends"
              maxLength={200}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs sm:text-sm bg-slate-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white font-bold text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 transition-all duration-200 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>{isEdit ? "Save Changes" : "Add Spend"}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
