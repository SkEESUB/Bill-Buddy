import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Loader2,
  Receipt,
  Sparkles,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile, updateSettings } from "@/lib/api";
import { useFinance } from "@/hooks/useFinance";
import { displayName, toDay } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee (INR)" },
  { code: "USD", symbol: "$", name: "US Dollar (USD)" },
  { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  { code: "GBP", symbol: "£", name: "British Pound (GBP)" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar (CAD)" },
  { code: "AUD", symbol: "$", name: "Australian Dollar (AUD)" },
];

export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const finance = useFinance();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Personal
  const [name, setName] = useState(displayName(user?.email));

  // Step 2: Financial basics
  const [currency, setCurrency] = useState("INR");
  const [monthlyIncome, setMonthlyIncome] = useState("50000");

  // Step 3: First bill (optional)
  const [billTitle, setBillTitle] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [billDate, setBillDate] = useState(toDay(new Date()));

  const handleFinish = async (skipBill = false) => {
    setSubmitting(true);
    try {
      // 1. Update Profile (name + mark onboarding completed)
      await updateProfile({
        full_name: name.trim() || displayName(user?.email),
        onboarding_completed: true,
        onboarding_step: 3,
      });

      // 2. Update Settings (currency + income)
      const incomeVal = Number(monthlyIncome) || 0;
      await updateSettings({
        currency,
        monthly_income: Math.max(0, incomeVal),
      });

      // 3. Optional first bill
      if (!skipBill && billTitle.trim() && Number(billAmount) > 0) {
        await finance.actions.createBill({
          title: billTitle.trim(),
          amount: Number(billAmount),
          due_date: billDate,
          category: "utilities",
          repeat_type: "monthly",
          repeat_interval: 1,
          repeat_end_date: null,
          reminder_days_before: 2,
          amount_type: "fixed",
          upi_id: null,
          notes: "Created during onboarding",
        });
      }

      toast.success("Welcome to BillBuddy!");
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg card p-6 sm:p-8 shadow-xl border border-border-light">
        {/* Brand header */}
        <div className="flex items-center justify-between pb-6 border-b border-border-light">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Receipt className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-text-primary">
              BillBuddy
            </span>
          </div>

          {/* Stepper indicator */}
          <div className="flex items-center gap-1.5 text-xs font-semibold text-text-tertiary">
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center ${
                step >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-text-secondary"
              }`}
            >
              1
            </span>
            <span className="h-0.5 w-3 bg-border-light" />
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center ${
                step >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-text-secondary"
              }`}
            >
              2
            </span>
            <span className="h-0.5 w-3 bg-border-light" />
            <span
              className={`h-6 w-6 rounded-full flex items-center justify-center ${
                step >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-text-secondary"
              }`}
            >
              3
            </span>
          </div>
        </div>

        {/* STEP 1: WELCOME & NAME */}
        {step === 1 && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-lilac/40 px-3 py-1 text-xs font-semibold text-primary mb-2">
                <Sparkles className="h-3.5 w-3.5" /> Step 1 of 3
              </div>
              <h1 className="text-xl font-bold text-text-primary">Welcome to BillBuddy!</h1>
              <p className="text-xs text-text-secondary mt-1">
                Let's get your account set up in under a minute. What should we call you?
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <User className="h-3.5 w-3.5" /> Your Full Name
              </span>
              <input
                className="input-field"
                value={name}
                placeholder="Enter your name"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!name.trim()}
                className="btn btn-primary cursor-pointer"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: FINANCIAL BASICS */}
        {step === 2 && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-lilac/40 px-3 py-1 text-xs font-semibold text-primary mb-2">
                <Wallet className="h-3.5 w-3.5" /> Step 2 of 3
              </div>
              <h1 className="text-xl font-bold text-text-primary">Currency & Monthly Income</h1>
              <p className="text-xs text-text-secondary mt-1">
                BillBuddy calculates your daily "Safe to Spend" allowance using your currency and baseline monthly income.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <DollarSign className="h-3.5 w-3.5" /> Preferred Currency
              </span>
              <select
                className="input-field cursor-pointer"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Wallet className="h-3.5 w-3.5" /> Estimated Monthly Income
              </span>
              <input
                type="number"
                min={0}
                className="input-field"
                value={monthlyIncome}
                placeholder="e.g. 50000"
                onChange={(e) => setMonthlyIncome(e.target.value)}
              />
              <span className="mt-1 block text-[11px] text-text-tertiary">
                You can change this anytime from Settings.
              </span>
            </label>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-secondary !min-h-9 !text-xs cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn btn-primary cursor-pointer"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: FIRST BILL / QUICK START */}
        {step === 3 && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-lilac/40 px-3 py-1 text-xs font-semibold text-primary mb-2">
                <CheckCircle2 className="h-3.5 w-3.5" /> Step 3 of 3
              </div>
              <h1 className="text-xl font-bold text-text-primary">Add Your First Bill</h1>
              <p className="text-xs text-text-secondary mt-1">
                Have a rent, Wi-Fi, Netflix or utility bill due soon? Add it now, or skip to start exploring.
              </p>
            </div>

            <div className="rounded-2xl border border-border-light bg-muted/40 p-4 space-y-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-text-secondary">
                  Bill Name
                </span>
                <input
                  className="input-field !bg-surface"
                  placeholder="e.g. High-speed Wi-Fi, Electricity, Rent"
                  value={billTitle}
                  onChange={(e) => setBillTitle(e.target.value)}
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">
                    Amount
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="input-field !bg-surface"
                    placeholder="e.g. 999"
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-text-secondary">
                    Due Date
                  </span>
                  <input
                    type="date"
                    className="input-field !bg-surface"
                    value={billDate}
                    onChange={(e) => setBillDate(e.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="pt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => void handleFinish(true)}
                disabled={submitting}
                className="text-xs font-semibold text-text-secondary hover:text-text-primary underline cursor-pointer"
              >
                Skip for now
              </button>

              <button
                type="button"
                onClick={() => void handleFinish(false)}
                disabled={submitting}
                className="btn btn-primary cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Setting up…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" /> Get Started
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
