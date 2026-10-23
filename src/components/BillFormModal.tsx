import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Check, Loader2, X } from "lucide-react";
import { getProfile } from "@/lib/api";
import { CATEGORY_OPTIONS } from "@/lib/categories";
import { addDays, formatAmount, toDay } from "@/lib/format";
import type { BillInput } from "@/lib/bills.functions";
import type { Bill } from "@/types/database";
import { useModalA11y } from "@/hooks/useModalA11y";

/** Recurrence choices offered in the form; matches the server's repeat types. */
type RepeatChoice = "weekly" | "monthly" | "quarterly" | "yearly";

export type { BillInput };

type Errors = Partial<Record<"title" | "amount" | "due_date" | "upi_id" | "notes", string>>;

const UPI_RE = /^[\w.-]{2,}@[a-zA-Z]{2,}$/;

/** Validates the form and returns field-level messages. */
function validate(values: {
  title: string;
  amount: string;
  due_date: string;
  upi_id: string;
  notes: string;
}): Errors {
  const errors: Errors = {};
  if (!values.title.trim()) errors.title = "This field is required";
  else if (values.title.trim().length > 100) errors.title = "Keep the name under 100 characters";

  const amount = Number(values.amount);
  if (!values.amount.trim()) errors.amount = "This field is required";
  else if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Amount must be greater than 0";

  if (!values.due_date) errors.due_date = "Please select a valid date";
  if (values.upi_id.trim() && !UPI_RE.test(values.upi_id.trim()))
    errors.upi_id = "Use the format name@bank";
  if (values.notes.length > 500) errors.notes = "Notes must be under 500 characters";
  return errors;
}

/** Add / edit bill sheet. Slides up from the bottom over a blurred backdrop. */
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
  const isEdit = !!bill;
  const tomorrow = useMemo(() => toDay(addDays(new Date(), 1)), []);
  const todayStr = useMemo(() => toDay(new Date()), []);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categoryKey, setCategoryKey] = useState(CATEGORY_OPTIONS[0]!.key);
  const [dueDate, setDueDate] = useState(tomorrow);
  const [recurring, setRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<RepeatChoice>("monthly");
  const [reminderDays, setReminderDays] = useState(3);
  const [upiId, setUpiId] = useState("");
  const [notes, setNotes] = useState("");

  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // New bills inherit the profile's default UPI ID so payments work out of the box.
  const [defaultUpi, setDefaultUpi] = useState("");
  const dialogRef = useModalA11y<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    let active = true;
    void getProfile()
      .then((p) => active && setDefaultUpi(p.default_upi_id ?? ""))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [open]);

  // Reset / prefill whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    setTitle(bill?.title ?? "");
    setAmount(bill ? String(bill.amount) : "");
    setCategoryKey(bill?.category ?? CATEGORY_OPTIONS[0]!.key);
    setDueDate(bill?.due_date ?? tomorrow);
    const repeat = (bill?.repeat_type ?? (bill?.recurring_type as RepeatChoice | undefined)) ?? "none";
    setRecurring(repeat !== "none" && !!bill);
    setRecurringType(repeat === "none" ? "monthly" : (repeat as RepeatChoice));
    setReminderDays(bill?.reminder_days_before ?? 3);
    setUpiId(bill?.upi_id ?? defaultUpi);
    setNotes(bill?.notes ?? "");
    setErrors({});
    setTouched({});
    setFormError(null);
    setDone(false);
    setSubmitting(false);
    const id = window.setTimeout(() => firstFieldRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open, bill, tomorrow, defaultUpi]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const current = { title, amount, due_date: dueDate, upi_id: upiId, notes };
  const liveErrors = validate(current);
  const canSubmit = Object.keys(liveErrors).length === 0 && !submitting;

  const blur = (field: keyof Errors) => {
    setTouched((t) => ({ ...t, [field]: true }));
    setErrors(validate(current));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const found = validate(current);
    setErrors(found);
    setTouched({ title: true, amount: true, due_date: true, upi_id: true, notes: true });
    if (Object.keys(found).length > 0) {
      document
        .querySelector<HTMLElement>("[data-field-error='true']")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const values: BillInput = {
        title: title.trim(),
        amount: Number(amount),
        category: categoryKey,
        due_date: dueDate,
        repeat_type: recurring ? recurringType : "none",
        repeat_interval: 1,
        repeat_end_date: null,
        reminder_days_before: reminderDays,
        amount_type: "fixed",
        upi_id: upiId.trim() ? upiId.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
      };
      await onSubmit(values);
      setDone(true);
      window.setTimeout(onClose, 1000);
    } catch (error) {
      console.error("[BillFormModal] Error saving bill:", error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message: unknown }).message)
          : "Failed to save bill. Please try again.";
      setFormError(message);
      setSubmitting(false);
    }
  };

  const err = (field: keyof Errors) => (touched[field] ? errors[field] : undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#281522]/35 backdrop-blur-[4px] sm:items-center"
      role="presentation"
      onClick={() => !submitting && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? "Edit bill" : "Add new bill"}
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up flex max-h-[92vh] w-full max-w-[500px] flex-col rounded-t-[28px] bg-surface shadow-[0_-8px_60px_-12px_rgba(75,29,63,0.28)] sm:rounded-[28px]"
      >
        {done ? (
          <div className="flex flex-col items-center px-6 py-16">
            <span className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-full bg-[#E7F5EF]">
              <Check className="h-10 w-10 text-success" strokeWidth={3} />
            </span>
            <p className="mt-4 text-lg font-bold text-text-primary">
              {isEdit ? "Changes saved" : "Bill added"}
            </p>
          </div>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="mx-auto mt-3 h-1.5 w-10 rounded-full bg-border-strong sm:hidden"
            />
            <header className="flex items-center justify-between border-b border-border-light px-6 py-5">
              <h2 className="text-xl font-bold text-text-primary">
                {isEdit ? "Edit Bill" : "Add New Bill"}
              </h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-text-secondary transition-colors hover:text-text-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col" noValidate>
              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                <Field label="Bill Name *" error={err("title")}>
                  <input
                    ref={firstFieldRef}
                    className="input-field !min-h-[52px]"
                    placeholder="e.g., Netflix Premium"
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={() => blur("title")}
                    aria-invalid={!!err("title")}
                  />
                </Field>

                <Field
                  label="Amount *"
                  error={err("amount")}
                  hint={
                    Number(amount) > 0
                      ? `Will be saved as ${formatAmount(Number(amount))}`
                      : undefined
                  }
                >
                  <div className="flex items-stretch gap-2">
                    <span className="flex w-12 items-center justify-center rounded-2xl bg-primary text-lg font-bold text-primary-foreground">
                      ₹
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="input-field !min-h-[52px] flex-1"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onBlur={() => blur("amount")}
                      aria-invalid={!!err("amount")}
                    />
                  </div>
                </Field>

                <fieldset className="mt-4">
                  <legend className="mb-2 text-sm font-semibold text-text-primary">
                    Category *
                  </legend>
                  <div className="grid grid-cols-5 gap-2">
                    {CATEGORY_OPTIONS.map((cat) => {
                      const selected = cat.key === categoryKey;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          aria-pressed={selected}
                          aria-label={cat.label}
                          title={cat.label}
                          onClick={() => setCategoryKey(cat.key)}
                          className="neu-press flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border transition-all duration-150"
                          style={
                            selected
                              ? {
                                  backgroundColor: "var(--soft-blue)",
                                  borderColor: "var(--primary)",
                                  color: "var(--primary)",
                                }
                              : {
                                  backgroundColor: "var(--surface)",
                                  borderColor: "var(--border-light)",
                                  color: "var(--text-secondary)",
                                  boxShadow: "var(--neu-raised)",
                                }
                          }
                        >
                          <cat.icon
                            className="h-[18px] w-[18px]"
                            strokeWidth={2}
                            aria-hidden="true"
                          />
                          <span className="w-full truncate px-1 text-[11px] font-semibold">
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <Field label="Due Date *" error={err("due_date")}>
                  <div className="relative">
                    <input
                      type="date"
                      className="input-field !min-h-[52px] pr-11"
                      value={dueDate}
                      min={isEdit ? undefined : todayStr}
                      onChange={(e) => setDueDate(e.target.value)}
                      onBlur={() => blur("due_date")}
                      aria-invalid={!!err("due_date")}
                    />
                    <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                  </div>
                </Field>

                <div className="mt-4 flex items-center justify-between rounded-2xl bg-soft-plum px-4 py-3">
                  <span className="text-sm font-semibold text-text-primary">Recurring bill</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={recurring}
                    aria-label="Recurring bill"
                    onClick={() => setRecurring((v) => !v)}
                    className="relative h-7 w-12 rounded-full transition-colors duration-200"
                    style={{
                      backgroundColor: recurring ? "var(--primary)" : "var(--border-strong)",
                    }}
                  >
                    <span
                      className="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all duration-200"
                      style={{ left: recurring ? "26px" : "4px" }}
                    />
                  </button>
                </div>

                <Field label="Remind me before" hint="Days ahead of the due date">
                  <select
                    className="input-field !min-h-[52px]"
                    value={reminderDays}
                    onChange={(e) => setReminderDays(Number(e.target.value))}
                  >
                    <option value={0}>On the due date</option>
                    <option value={1}>1 day before</option>
                    <option value={3}>3 days before</option>
                    <option value={7}>1 week before</option>
                  </select>
                </Field>

                {recurring ? (
                  <Field label="Repeat every">
                    <select
                      className="input-field !min-h-[52px]"
                      value={recurringType}
                      onChange={(e) => setRecurringType(e.target.value as RepeatChoice)}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="weekly">Weekly</option>
                      <option value="quarterly">Every 3 months</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </Field>
                ) : null}

                <Field label="UPI ID (Optional)" error={err("upi_id")} hint="For quick payments">
                  <input
                    className="input-field !min-h-[52px]"
                    placeholder="merchant@upi"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    onBlur={() => blur("upi_id")}
                    aria-invalid={!!err("upi_id")}
                  />
                </Field>

                <Field
                  label="Notes (Optional)"
                  error={err("notes")}
                  hint={`${notes.length}/500 characters`}
                >
                  <textarea
                    rows={3}
                    maxLength={500}
                    className="input-field !min-h-[92px] resize-none py-3"
                    placeholder="Any additional details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={() => blur("notes")}
                  />
                </Field>

                {formError ? (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl bg-[#FCEAED] p-3 text-sm text-[#A73A4C]"
                  >
                    {formError}
                  </p>
                ) : null}
              </div>

              <div
                className="sticky bottom-0 z-10 flex gap-3 border-t border-border-light bg-surface px-6 pt-4"
                style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
              >
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="btn min-h-[54px] flex-1 rounded-2xl border border-border-light bg-surface text-base font-semibold text-text-primary disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn btn-primary min-h-[54px] flex-[1.6] !rounded-2xl !text-base"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : isEdit ? (
                    "Save Changes"
                  ) : (
                    "Save Bill"
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-4 block" data-field-error={error ? "true" : "false"}>
      <span className="mb-1.5 block text-sm font-semibold text-text-primary">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-error">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-text-tertiary">{hint}</span>
      ) : null}
    </label>
  );
}
