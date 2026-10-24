import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { category } from "@/lib/categories";
import { formatAmount, formatDate } from "@/lib/format";
import { buildUpiUri, canHandoffUpi, isMobileRuntime, isValidUpiId, openUpiApp } from "@/lib/upi";
import { classifyError, UNKNOWN_RESULT_MESSAGE } from "@/lib/errors";
import type { OccurrenceView } from "@/lib/occurrences";
import type { PaymentInput } from "@/lib/bills.functions";
import { useCheckout } from "@/hooks/useCheckout";
import { useAuth } from "@/hooks/useAuth";
import { useModalA11y } from "@/hooks/useModalA11y";

const METHODS = ["upi", "cash", "card", "netbanking", "other"] as const;
export type PaymentMethod = (typeof METHODS)[number];

type Phase = "choose" | "handed_off" | "recording" | "recorded" | "unknown";

/**
 * Payment sheet.
 *
 * It builds a real UPI deep link when the bill has a valid VPA, hands it to the
 * OS, then asks the user to confirm the outcome. The app never contacts a bank,
 * never verifies a payment, and only records what the user confirms. Settlement
 * itself is written by the server, which refuses to settle the same instalment
 * twice.
 */
export function PaymentModal({
  occurrence,
  safeToSpend,
  today,
  onClose,
  onConfirm,
  onCopyUpi,
  onSettled,
}: {
  occurrence: OccurrenceView | null;
  safeToSpend: number;
  today: string;
  onClose: () => void;
  onConfirm: (input: PaymentInput) => Promise<unknown>;
  onCopyUpi: (upi: string) => void;
  onSettled?: () => void | Promise<unknown>;
}) {
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [amountText, setAmountText] = useState("");
  const [reference, setReference] = useState("");
  const [phase, setPhase] = useState<Phase>("choose");
  const [error, setError] = useState<string | null>(null);
  const [mobile, setMobile] = useState(false);
  const [androidLike, setAndroidLike] = useState(false);
  const { user } = useAuth();
  const checkout = useCheckout({ onSettled });
  const online = checkout.state;
  const onlineBusy =
    online.phase === "creating" ||
    online.phase === "opening" ||
    online.phase === "processing" ||
    online.phase === "verifying";

  const dialogRef = useModalA11y<HTMLDivElement>(!!occurrence);

  useEffect(() => {
    setMobile(isMobileRuntime());
    setAndroidLike(canHandoffUpi());
  }, []);

  useEffect(() => {
    if (!occurrence) return;
    setMethod(occurrence.upiId ? "upi" : "cash");
    setAmountText(String(occurrence.amount));
    setReference("");
    setPhase("choose");
    setError(null);
    checkout.reset();
    // Resetting on a new bill only; checkout identity is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occurrence]);

  const busy = phase === "recording" || onlineBusy;

  useEffect(() => {
    if (!occurrence) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [occurrence, busy, onClose]);

  if (!occurrence) return null;

  const cat = category(occurrence.category);
  const Icon = cat.icon;
  const amount = Number(amountText);
  const amountValid = Number.isFinite(amount) && amount > 0;
  const leftAfter = safeToSpend - (amountValid ? amount : 0);
  const upiValid = isValidUpiId(occurrence.upiId);
  const upiUri = upiValid
    ? buildUpiUri({
        payeeVpa: occurrence.upiId!,
        payeeName: occurrence.title,
        amount: amountValid ? amount : occurrence.amount,
        note: `Bill: ${occurrence.title}`,
        reference: occurrence.id,
      })
    : null;

  /** Ask the server to settle this instalment. Never optimistic. */
  const record = async (m: PaymentMethod) => {
    if (!amountValid) {
      setError("Enter the amount you actually paid.");
      return;
    }
    setPhase("recording");
    setError(null);
    try {
      await onConfirm({
        occurrence_id: occurrence.id,
        amount,
        paid_on: today,
        payment_method: m,
        external_reference: reference.trim() || null,
      });
      setPhase("recorded");
      window.setTimeout(onClose, 1200);
    } catch (e) {
      const classified = classifyError(e);
      if (classified.kind === "network") {
        // The write may or may not have reached the server — say so plainly.
        setPhase("unknown");
        setError(UNKNOWN_RESULT_MESSAGE);
      } else {
        setPhase(upiUri ? "handed_off" : "choose");
        setError(classified.message);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#281522]/40 backdrop-blur-[3px] sm:items-center"
      role="presentation"
      onClick={() => !busy && onClose()}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Pay bill"
        onClick={(e) => e.stopPropagation()}
        className="animate-slide-up safe-bottom max-h-[92vh] w-full max-w-[500px] overflow-y-auto rounded-t-[28px] bg-surface p-6 shadow-[0_-8px_48px_-12px_rgba(75,29,63,0.24)] sm:rounded-[28px]"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />

        {phase === "recorded" || (online.phase as string) === "paid" ? (
          <div className="flex flex-col items-center py-8 text-center animate-scale-in">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/25 mb-4">
              <Check className="h-10 w-10 stroke-[3]" />
            </span>
            <h2 className="text-2xl font-extrabold text-text-primary">Payment Successful!</h2>
            <div className="mt-4 mb-6 rounded-2xl bg-muted/40 border border-border-light/70 p-4 w-full">
              <p className="text-3xl font-extrabold text-text-primary tabular-nums">
                {formatAmount(amount)}
              </p>
              <p className="mt-1 text-sm font-semibold text-text-secondary">{occurrence.title}</p>
              <p className="text-xs text-text-tertiary mt-1">
                {formatDate(today)}, {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <div className="w-full space-y-2.5">
              <button
                type="button"
                className="btn btn-primary w-full !min-h-12 !rounded-2xl text-sm font-bold shadow-md cursor-pointer"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : phase === "unknown" ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-soft-orange">
              <AlertTriangle className="h-8 w-8 text-[#9C6318]" />
            </span>
            <p className="mt-4 text-lg font-semibold text-text-primary">We're not sure</p>
            <p className="mt-1 text-sm text-text-secondary">{UNKNOWN_RESULT_MESSAGE}</p>
            <button type="button" className="btn btn-secondary mt-5 w-full" onClick={onClose}>
              Close and refresh
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold text-text-primary">Pay bill</h2>

            <div className="mt-4 flex items-center gap-3 rounded-[20px] border border-border-light bg-elevated p-4">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${cat.color}14`, color: cat.color }}
              >
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text-primary">{occurrence.title}</p>
                <p className="text-[13px] text-text-secondary">
                  Due {formatDate(occurrence.dueDate)}
                </p>
                {occurrence.upiId ? (
                  <p className="mt-0.5 truncate text-[13px] font-medium text-primary">
                    {occurrence.upiId}
                  </p>
                ) : null}
              </div>
              <p className="shrink-0 text-[18px] font-bold tabular-nums text-text-primary">
                {formatAmount(occurrence.amount)}
              </p>
            </div>

            {/* ---------- Real provider checkout ---------- */}
            {checkout.available && (online.phase as string) !== "paid" ? (
              <div className="mt-4 rounded-[20px] border border-border-light bg-elevated p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold text-text-primary">Pay online</p>
                  {checkout.sandbox ? (
                    <span className="rounded-full bg-soft-orange px-2.5 py-1 text-[11px] font-semibold text-[#9C6318]">
                      Test mode
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-text-secondary">
                  UPI, card or netbanking through our payment provider. The bill is marked paid only
                  after the provider confirms the money moved.
                </p>

                {online.message ? (
                  <p
                    role="alert"
                    className={`mt-3 rounded-xl p-3 text-[13px] ${
                      online.phase === "pending"
                        ? "bg-soft-orange text-[#9C6318]"
                        : "bg-soft-red text-[#A73A4C]"
                    }`}
                  >
                    {online.message}
                  </p>
                ) : null}

                <button
                  type="button"
                  className="btn btn-primary mt-3 w-full"
                  disabled={busy || occurrence.status === "paid"}
                  onClick={() =>
                    void checkout.pay({
                      occurrenceId: occurrence.id,
                      title: occurrence.title,
                      email: user?.email ?? null,
                    })
                  }
                >
                  {onlineBusy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {online.phase === "verifying"
                        ? "Confirming with provider…"
                        : online.phase === "processing"
                          ? "Waiting for payment…"
                          : "Starting secure checkout…"}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-[18px] w-[18px] " />
                      Pay {formatAmount(occurrence.amount)} securely
                    </>
                  )}
                </button>

                {online.orderId && (online.phase === "pending" || online.phase === "failed") ? (
                  <button
                    type="button"
                    className="btn btn-secondary mt-2 w-full !min-h-11 !text-[13px]"
                    disabled={busy}
                    onClick={() => void checkout.checkStatus()}
                  >
                    <RefreshCw className="h-4 w-4" /> Check payment status
                  </button>
                ) : null}
              </div>
            ) : null}

            {(online.phase as string) === "paid" ? (
              <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-soft-green p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface">
                  <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
                </span>
                <div>
                  <p className="text-[15px] font-semibold text-text-primary">Payment confirmed</p>
                  <p className="text-[13px] text-text-secondary">
                    The provider confirmed this payment and the bill is settled.
                  </p>
                </div>
              </div>
            ) : null}

            {/* ---------- UPI handoff ---------- */}
            {upiUri ? (
              <div className="mt-4">
                {phase === "handed_off" ? (
                  <div className="rounded-[20px] border border-border-light bg-soft-blue p-4">
                    <p className="text-[15px] font-semibold text-text-primary">
                      Did you complete the payment?
                    </p>
                    <p className="mt-1 text-[13px] text-text-secondary">
                      We can&apos;t verify this with your bank. Only confirm if your UPI app showed
                      the payment as successful.
                    </p>
                    <label className="mt-3 block text-[13px] font-medium text-text-secondary">
                      UPI reference (optional)
                      <input
                        className="input-field mt-1 !min-h-11 !text-sm"
                        placeholder="12-digit UTR"
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                      />
                    </label>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary flex-1 !min-h-12 !text-sm"
                        disabled={busy}
                        onClick={() => setPhase("choose")}
                      >
                        Not yet
                      </button>
                      <button
                        type="button"
                        className="btn btn-success flex-1 !min-h-12 !text-sm"
                        disabled={busy}
                        onClick={() => void record("upi")}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, mark paid"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="btn btn-primary w-full"
                      onClick={() => {
                        setPhase("handed_off");
                        openUpiApp(upiUri);
                      }}
                    >
                      <Smartphone className="h-[18px] w-[18px]" /> Choose UPI app
                    </button>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary flex-1 !min-h-11 !text-[13px]"
                        onClick={() => onCopyUpi(occurrence.upiId!)}
                      >
                        <Copy className="h-4 w-4" /> Copy UPI ID
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary flex-1 !min-h-11 !text-[13px]"
                        onClick={() => setPhase("handed_off")}
                      >
                        Already paid
                      </button>
                    </div>
                    <p className="mt-2 flex items-start gap-1.5 text-[13px] text-text-secondary">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      {androidLike
                        ? "Android will show every UPI app installed on this phone."
                        : mobile
                          ? "Your device may not be able to open a UPI app from the browser."
                          : "UPI apps only open on a mobile device — copy the UPI ID to pay elsewhere."}
                    </p>
                  </>
                )}
              </div>
            ) : occurrence.upiId ? (
              <p className="mt-4 rounded-2xl bg-soft-orange p-3 text-[13px] text-[#9C6318]">
                “{occurrence.upiId}” isn&apos;t a valid UPI ID, so we can&apos;t open a UPI app. Edit
                the bill to fix it, or record the payment manually below.
              </p>
            ) : null}

            {/* ---------- Impact ---------- */}
            <div className="mt-4 rounded-[20px] border border-border-light bg-elevated p-4">
              <p className="text-[15px] font-semibold text-text-primary">After this payment</p>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-text-secondary">Safe to spend left</span>
                <span className="font-semibold tabular-nums text-text-primary">
                  {formatAmount(leftAfter)}
                </span>
              </div>
              <p
                className="mt-3 rounded-xl px-3 py-2 text-[13px] font-medium"
                style={
                  leftAfter >= 0
                    ? { backgroundColor: "var(--soft-green)", color: "#1F7053" }
                    : { backgroundColor: "var(--soft-orange)", color: "#9C6318" }
                }
              >
                {leftAfter >= 0
                  ? "This fits within your safe-to-spend."
                  : `This puts you ${formatAmount(Math.abs(leftAfter))} short of your commitments.`}
              </p>
            </div>

            {/* ---------- Manual record ---------- */}
            {phase === "handed_off" ? null : (
              <>
                <label className="mt-4 block text-[15px] font-semibold text-text-primary">
                  Amount paid
                  <input
                    className="input-field mt-2 !min-h-[52px]"
                    inputMode="decimal"
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    aria-invalid={!amountValid}
                  />
                </label>
                {!amountValid ? (
                  <p className="mt-1 text-[13px] text-error">Enter the amount you actually paid.</p>
                ) : null}

                <fieldset className="mt-4">
                  <legend className="mb-2 text-[15px] font-semibold text-text-primary">
                    Record payment as
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {METHODS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        aria-pressed={method === m}
                        onClick={() => setMethod(m)}
                        className={`rounded-full border px-4 py-2 text-[13px] font-medium capitalize transition-colors ${
                          method === m
                            ? "border-primary bg-soft-blue text-primary"
                            : "border-border-light bg-surface text-text-secondary"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="mt-5 flex gap-3">
                  <button
                    type="button"
                    className="btn btn-secondary flex-1"
                    disabled={busy}
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-success flex-[2]"
                    disabled={busy || !amountValid}
                    onClick={() => void record(method)}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Recording…
                      </>
                    ) : (
                      "Mark as paid"
                    )}
                  </button>
                </div>
              </>
            )}

            {error ? (
              <p role="alert" className="mt-4 rounded-xl bg-soft-red p-3 text-sm text-[#A73A4C]">
                {error}
              </p>
            ) : null}

            <p className="mt-4 flex items-start gap-1.5 text-[13px] text-text-tertiary">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              We never ask for your UPI PIN, card CVV or bank password. Marking a bill paid is your
              confirmation, not bank verification.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
