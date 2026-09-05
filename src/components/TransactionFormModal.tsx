import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Paperclip, X } from "lucide-react";
import { ArrowLeftRight, Banknote, PiggyBank, Wallet } from "lucide-react";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type CategoryOption } from "@/lib/categories";
import { formatAmount, toDay } from "@/lib/format";
import {
  METHOD_LABELS,
  PAYMENT_METHODS,
  type ManualType,
  type PaymentMethod,
} from "@/lib/transactions";
import type { Transaction } from "@/types/database";
import { useModalA11y } from "@/hooks/useModalA11y";

/** Only user-entered money movements; bill payments are written by the bill engine. */
export type EntryType = ManualType;

export type TransactionInput = {
  type: EntryType;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  payment_method: PaymentMethod;
  notes: string | null;
  client_request_id: string;
  file?: File | null;
};

const TRANSFER_CATEGORIES: CategoryOption[] = [
  { key: "bank_to_cash", label: "Bank → Cash", icon: Banknote, color: "#5E3A70" },
  { key: "cash_to_bank", label: "Cash → Bank", icon: Wallet, color: "#4B1D3F" },
  { key: "wallet_topup", label: "Wallet", icon: Wallet, color: "#8E6FA8" },
  { key: "savings", label: "Savings", icon: PiggyBank, color: "#3F5E52" },
  { key: "other_transfer", label: "Other", icon: ArrowLeftRight, color: "#6E5B69" },
];

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/png", "image/jpeg", "image/webp", "image/heic", "application/pdf"];

const TYPE_TABS: { key: EntryType; label: string; bg: string; color: string }[] = [
  { key: "expense", label: "Expense", bg: "#FCEAED", color: "#A73A4C" },
  { key: "income", label: "Income", bg: "#E7F5EF", color: "#1F7053" },
  { key: "transfer", label: "Transfer", bg: "#EEE5F5", color: "#4B1D3F" },
];

type Errors = Partial<Record<"amount" | "date" | "description" | "file", string>>;

type Draft = { amount: string; date: string; description: string; file: File | null };

function validate(values: Draft): Errors {
  const errors: Errors = {};
  const amount = Number(values.amount);
  if (!values.amount.trim()) errors.amount = "This field is required";
  else if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Amount must be greater than 0";
  if (!values.date) errors.date = "Please select a valid date";
  else if (values.date > toDay(new Date())) errors.date = "Date can't be in the future";
  if (values.description.length > 200) errors.description = "Keep it under 200 characters";
  if (values.file) {
    if (!ALLOWED_MIME.includes(values.file.type)) errors.file = "Use a PNG, JPG, WEBP or PDF file";
    else if (values.file.size > MAX_FILE_BYTES) errors.file = "File must be under 5 MB";
  }
  return errors;
}

function categoriesFor(type: EntryType) {
  if (type === "income" || type === "refund") return INCOME_CATEGORIES;
  if (type === "transfer") return TRANSFER_CATEGORIES;
  return EXPENSE_CATEGORIES;
}

/** Add / edit a manual money entry (income, expense or transfer). */
export function TransactionFormModal({
  open,
  transaction,
  initialType = "expense",
  allowAttachment = true,
  onClose,
  onSubmit,
}: {
  open: boolean;
  transaction?: Transaction | null;
  initialType?: EntryType;
  allowAttachment?: boolean;
  onClose: () => void;
  onSubmit: (values: TransactionInput) => Promise<void>;
}) {
  const isEdit = !!transaction;
  const today = useMemo(() => toDay(new Date()), []);

  const [type, setType] = useState<EntryType>(initialType);
  const [amount, setAmount] = useState("");
  const [categoryKey, setCategoryKey] = useState(EXPENSE_CATEGORIES[0]!.key);
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("manual");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  /** Stable per-open key so a double submit can never create two records. */
  const requestId = useRef<string>("");

  const dialogRef = useModalA11y<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const stored = transaction?.type;
    const next: EntryType = stored && stored !== "bill_payment" ? (stored as EntryType) : initialType;
    setType(next);
    setAmount(transaction ? String(Math.abs(Number(transaction.amount))) : "");
    setCategoryKey(transaction?.category ?? categoriesFor(next)[0]!.key);
    setDate(transaction?.date ?? today);
    setDescription(transaction?.description ?? "");
    setMethod((transaction?.payment_method as PaymentMethod | null) ?? "manual");
    setNotes(transaction?.notes ?? "");
    setFile(null);
    setErrors({});
    setTouched({});
    setFormError(null);
    setDone(false);
    setSubmitting(false);
    requestId.current = crypto.randomUUID();
    const id = window.setTimeout(() => amountRef.current?.focus(), 80);
    return () => window.clearTimeout(id);
  }, [open, transaction, today, initialType]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !submitting && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  if (!open) return null;

  const options = categoriesFor(type);
  const current: Draft = { amount, date, description, file };
  const liveErrors = validate(current);
  const canSubmit = Object.keys(liveErrors).length === 0 && !submitting;

  const switchType = (next: EntryType) => {
    setType(next);
    const list = categoriesFor(next);
    if (!list.some((c) => c.key === categoryKey)) setCategoryKey(list[0]!.key);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    const found = validate(current);
    setErrors(found);
    setTouched({ amount: true, date: true, description: true, file: true });
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit({
        type,
        amount: Number(amount),
        category: categoryKey,
        date,
        description: description.trim() || null,
        payment_method: method,
        notes: notes.trim() || null,
        client_request_id: requestId.current,
        file,
      });
      setDone(true);
      window.setTimeout(onClose, 900);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save entry. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const err = (field: keyof Errors) => (touched[field] ? errors[field] : undefined);
  const accent = type === "income" ? "#278A63" : type === "transfer" ? "#5E3A70" : "#C94F62";

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
        aria-label={isEdit ? "Edit entry" : "Add money entry"}
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up flex max-h-[92vh] w-full max-w-[500px] flex-col rounded-t-[28px] bg-surface shadow-[0_-8px_60px_-12px_rgba(75,29,63,0.28)] sm:rounded-[28px]"
      >
        {done ? (
          <div className="flex flex-col items-center px-6 py-16">
            <span className="animate-scale-in flex h-20 w-20 items-center justify-center rounded-full bg-[#E7F5EF]">
              <Check className="h-10 w-10 text-success" strokeWidth={3} />
            </span>
            <p className="mt-4 text-lg font-bold text-text-primary">
              {isEdit ? "Changes saved" : "Saved to your ledger"}
            </p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between border-b border-border-light px-6 py-5">
              <h2 className="text-xl font-bold text-text-primary">
                {isEdit ? "Edit entry" : "Add entry"}
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
                {isEdit ? null : (
                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-1.5">
                    {TYPE_TABS.map((tab) => {
                      const selected = tab.key === type;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => switchType(tab.key)}
                          className="min-h-11 rounded-xl text-sm font-bold transition-all"
                          style={
                            selected
                              ? { backgroundColor: tab.bg, color: tab.color }
                              : { color: "var(--text-secondary)" }
                          }
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Amount *
                  </span>
                  <div className="flex items-stretch gap-2">
                    <span
                      className="flex w-12 items-center justify-center rounded-xl text-lg font-bold text-white"
                      style={{ backgroundColor: accent }}
                      aria-hidden="true"
                    >
                      ₹
                    </span>
                    <input
                      ref={amountRef}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="input-field !min-h-[52px] flex-1"
                      placeholder="0.00"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      onBlur={() => {
                        setTouched((t) => ({ ...t, amount: true }));
                        setErrors(validate(current));
                      }}
                      aria-invalid={!!err("amount")}
                    />
                  </div>
                  {err("amount") ? (
                    <span className="mt-1 block text-xs font-medium text-error">
                      {err("amount")}
                    </span>
                  ) : Number(amount) > 0 ? (
                    <span className="mt-1 block text-xs text-text-tertiary">
                      Will be saved as {formatAmount(Number(amount))}
                    </span>
                  ) : null}
                </label>

                <fieldset className="mt-4">
                  <legend className="mb-2 text-sm font-semibold text-text-primary">
                    {type === "transfer" ? "Movement *" : type === "income" ? "Source *" : "Category *"}
                  </legend>
                  <div className="grid grid-cols-4 gap-2">
                    {options.map((cat) => {
                      const selected = cat.key === categoryKey;
                      const Icon = cat.icon;
                      return (
                        <button
                          key={cat.key}
                          type="button"
                          aria-pressed={selected}
                          title={cat.label}
                          onClick={() => setCategoryKey(cat.key)}
                          className="flex h-[68px] flex-col items-center justify-center gap-1 rounded-2xl border px-1 transition-all duration-150"
                          style={
                            selected
                              ? {
                                  backgroundColor: `${cat.color}14`,
                                  borderColor: cat.color,
                                  color: cat.color,
                                }
                              : {
                                  backgroundColor: "var(--surface)",
                                  borderColor: "var(--border-light)",
                                  color: "var(--text-secondary)",
                                }
                          }
                        >
                          {Icon ? (
                            <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
                          ) : null}
                          <span className="w-full truncate text-[11px] font-medium text-text-secondary">
                            {cat.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-text-primary">
                      Date *
                    </span>
                    <input
                      type="date"
                      className="input-field !min-h-[52px]"
                      value={date}
                      max={today}
                      onChange={(e) => setDate(e.target.value)}
                      onBlur={() => setTouched((t) => ({ ...t, date: true }))}
                      aria-invalid={!!err("date")}
                    />
                    {err("date") ? (
                      <span className="mt-1 block text-xs font-medium text-error">
                        {err("date")}
                      </span>
                    ) : null}
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-sm font-semibold text-text-primary">
                      Payment method
                    </span>
                    <select
                      className="input-field !min-h-[52px]"
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    >
                      {PAYMENT_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {METHOD_LABELS[m]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Description
                  </span>
                  <input
                    className="input-field !min-h-[52px]"
                    placeholder={type === "income" ? "e.g., August salary" : "e.g., Lunch with team"}
                    maxLength={200}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, description: true }))}
                  />
                  {err("description") ? (
                    <span className="mt-1 block text-xs font-medium text-error">
                      {err("description")}
                    </span>
                  ) : null}
                </label>

                <label className="mt-4 block">
                  <span className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Notes
                  </span>
                  <textarea
                    className="input-field min-h-[80px] py-3"
                    placeholder="Anything you want to remember about this entry"
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>

                {allowAttachment && !isEdit ? (
                  <label className="mt-4 block">
                    <span className="mb-1.5 block text-sm font-semibold text-text-primary">
                      Receipt (optional)
                    </span>
                    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border-light px-4 py-3">
                      <Paperclip className="h-4 w-4 text-text-tertiary" aria-hidden="true" />
                      <input
                        type="file"
                        accept={ALLOWED_MIME.join(",")}
                        className="w-full text-xs text-text-secondary"
                        onChange={(e) => {
                          const picked = e.target.files?.[0] ?? null;
                          setFile(picked);
                          setTouched((t) => ({ ...t, file: true }));
                          setErrors(validate({ ...current, file: picked }));
                        }}
                      />
                    </div>
                    {err("file") ? (
                      <span className="mt-1 block text-xs font-medium text-error">
                        {err("file")}
                      </span>
                    ) : (
                      <span className="mt-1 block text-xs text-text-tertiary">
                        PNG, JPG, WEBP or PDF up to 5 MB. Stored privately.
                      </span>
                    )}
                  </label>
                ) : null}

                {formError ? (
                  <p role="alert" className="mt-4 text-sm font-medium text-error">
                    {formError}
                  </p>
                ) : null}
              </div>

              <footer className="flex gap-3 border-t border-border-light px-6 py-4">
                <button
                  type="button"
                  className="btn btn-secondary flex-1"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={!canSubmit}>
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving…
                    </>
                  ) : isEdit ? (
                    "Save changes"
                  ) : (
                    "Add entry"
                  )}
                </button>
              </footer>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
