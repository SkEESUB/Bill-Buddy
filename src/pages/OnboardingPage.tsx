import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowRight,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Globe,
  Loader2,
  PieChart,
  Receipt,
  Sparkles,
  Target,
  Trophy,
  User,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { updateProfile, updateSettings } from "@/lib/api";
import { displayName } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";

const CURRENCIES = [
  { code: "INR", symbol: "₹", name: "Indian Rupee (INR)" },
  { code: "USD", symbol: "$", name: "US Dollar (USD)" },
  { code: "EUR", symbol: "€", name: "Euro (EUR)" },
  { code: "GBP", symbol: "£", name: "British Pound (GBP)" },
  { code: "CAD", symbol: "$", name: "Canadian Dollar (CAD)" },
  { code: "AUD", symbol: "$", name: "Australian Dollar (AUD)" },
];

const TIMEZONES = [
  "Asia/Kolkata (GMT+5:30)",
  "UTC (GMT+0:00)",
  "America/New_York (EST)",
  "America/Los_Angeles (PST)",
  "Europe/London (GMT)",
  "Asia/Dubai (GST)",
  "Asia/Singapore (SGT)",
];

export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Personal Profile
  const [name, setName] = useState(displayName(user?.email));
  const [upiId, setUpiId] = useState("");

  // Step 2: Currency & Timezone
  const [currency, setCurrency] = useState("INR");
  const [timezone, setTimezone] = useState("Asia/Kolkata (GMT+5:30)");
  const [monthlyIncome, setMonthlyIncome] = useState("50000");

  // Step 3: Tracking preferences (Phase 2 Screen 8)
  const [selectedTrackers, setSelectedTrackers] = useState<string[]>([
    "bills",
    "expenses",
    "budgets",
    "goals",
  ]);

  // Step 4: Notification Permissions
  const [enableNotifications, setEnableNotifications] = useState(true);

  const toggleTracker = (key: string) => {
    if (selectedTrackers.includes(key)) {
      if (selectedTrackers.length > 1) {
        setSelectedTrackers(selectedTrackers.filter((k) => k !== key));
      }
    } else {
      setSelectedTrackers([...selectedTrackers, key]);
    }
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      // 1. Update Profile
      await updateProfile({
        full_name: name.trim() || displayName(user?.email),
        default_upi_id: upiId.trim() || null,
        onboarding_completed: true,
        onboarding_step: 4,
      });

      // 2. Update Settings
      const incomeVal = Number(monthlyIncome) || 0;
      await updateSettings({
        currency,
        timezone: timezone.split(" ")[0],
        monthly_income: Math.max(0, incomeVal),
        notify_bill_reminders: enableNotifications,
        notify_overdue: enableNotifications,
      });

      toast.success("Welcome to BillBuddy! Setup complete.");
      void navigate({ to: "/" });
    } catch (err) {
      toast.error(toUserMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg card p-6 sm:p-8 shadow-2xl border border-border-light rounded-[32px]">
        {/* Brand Header */}
        <div className="flex items-center justify-between pb-5 border-b border-border-light">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <Receipt className="h-5 w-5" />
            </span>
            <div>
              <span className="text-base font-extrabold tracking-tight text-text-primary">
                BillBuddy
              </span>
              <p className="text-[11px] text-text-secondary">Setup your experience</p>
            </div>
          </div>

          {/* Stepper Dots */}
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4].map((s) => (
              <span
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step
                    ? "w-6 bg-primary"
                    : s < step
                    ? "w-2 bg-primary/50"
                    : "w-2 bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        {/* STEP 1: WELCOME & PROFILE */}
        {step === 1 && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
                <Sparkles className="h-3.5 w-3.5" /> Step 1 of 4: Profile
              </div>
              <h1 className="text-xl font-bold text-text-primary">Welcome to BillBuddy!</h1>
              <p className="text-xs text-text-secondary mt-1">
                Take control of your money and bills. What should we call you?
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <User className="h-3.5 w-3.5" /> Full Name
              </span>
              <input
                className="input-field"
                value={name}
                placeholder="Enter your name"
                autoFocus
                onChange={(e) => setName(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <Wallet className="h-3.5 w-3.5" /> Default UPI ID (Optional)
              </span>
              <input
                className="input-field"
                value={upiId}
                placeholder="e.g. yourname@okhdfcbank"
                onChange={(e) => setUpiId(e.target.value)}
              />
              <span className="mt-1 block text-[11px] text-text-tertiary">
                Used to autofill bill payments and quick settlements.
              </span>
            </label>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!name.trim()}
                className="btn btn-primary cursor-pointer w-full sm:w-auto"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: CURRENCY & TIMEZONE */}
        {step === 2 && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
                <DollarSign className="h-3.5 w-3.5" /> Step 2 of 4: Currency & Timezone
              </div>
              <h1 className="text-xl font-bold text-text-primary">Regional Settings</h1>
              <p className="text-xs text-text-secondary mt-1">
                Customize your base currency and timezone for scheduled payment reminders.
              </p>
            </div>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                <DollarSign className="h-3.5 w-3.5" /> Currency
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
                <Globe className="h-3.5 w-3.5" /> Timezone
              </span>
              <select
                className="input-field cursor-pointer"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
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
            </label>

            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn btn-secondary cursor-pointer"
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

        {/* STEP 3: ONBOARDING PREFERENCES (Phase 2 Screen 8) */}
        {step === 3 && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div className="text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary mb-2">
                <Sparkles className="h-3.5 w-3.5" /> Step 3 of 4: Preferences
              </div>
              <h1 className="text-xl font-bold text-text-primary">What do you want to track?</h1>
              <p className="text-xs text-text-secondary mt-1">
                Select the financial modules you want to focus on (select one or more).
              </p>
            </div>

            {/* 2x2 Grid directly matching Phase 2 Screen 8 */}
            <div className="grid grid-cols-2 gap-3.5 pt-2">
              {/* Bills */}
              <button
                type="button"
                onClick={() => toggleTracker("bills")}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 p-5 text-center transition-all cursor-pointer ${
                  selectedTrackers.includes("bills")
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border-light bg-surface hover:border-border"
                }`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    selectedTrackers.includes("bills")
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-text-secondary"
                  }`}
                >
                  <Calendar className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Bills</p>
                  <p className="text-[11px] text-text-tertiary">Due dates & utilities</p>
                </div>
                {selectedTrackers.includes("bills") && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </button>

              {/* Expenses */}
              <button
                type="button"
                onClick={() => toggleTracker("expenses")}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 p-5 text-center transition-all cursor-pointer ${
                  selectedTrackers.includes("expenses")
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border-light bg-surface hover:border-border"
                }`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    selectedTrackers.includes("expenses")
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-text-secondary"
                  }`}
                >
                  <CreditCard className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Expenses</p>
                  <p className="text-[11px] text-text-tertiary">Daily transactions</p>
                </div>
                {selectedTrackers.includes("expenses") && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </button>

              {/* Budgets */}
              <button
                type="button"
                onClick={() => toggleTracker("budgets")}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 p-5 text-center transition-all cursor-pointer ${
                  selectedTrackers.includes("budgets")
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border-light bg-surface hover:border-border"
                }`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    selectedTrackers.includes("budgets")
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-text-secondary"
                  }`}
                >
                  <PieChart className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Budgets</p>
                  <p className="text-[11px] text-text-tertiary">Category limits</p>
                </div>
                {selectedTrackers.includes("budgets") && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </button>

              {/* Goals */}
              <button
                type="button"
                onClick={() => toggleTracker("goals")}
                className={`relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 p-5 text-center transition-all cursor-pointer ${
                  selectedTrackers.includes("goals")
                    ? "border-primary bg-primary/5 shadow-md shadow-primary/10"
                    : "border-border-light bg-surface hover:border-border"
                }`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                    selectedTrackers.includes("goals")
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-text-secondary"
                  }`}
                >
                  <Trophy className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-sm font-bold text-text-primary">Goals</p>
                  <p className="text-[11px] text-text-tertiary">Savings milestones</p>
                </div>
                {selectedTrackers.includes("goals") && (
                  <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </span>
                )}
              </button>
            </div>

            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="btn btn-secondary cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="btn btn-primary cursor-pointer"
              >
                Continue <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: NOTIFICATIONS & COMPLETION */}
        {step === 4 && (
          <div className="mt-6 space-y-5 animate-fade-in">
            <div className="text-center py-2">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <Bell className="h-8 w-8" />
              </div>
              <h1 className="text-xl font-bold text-text-primary">Stay Notified</h1>
              <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
                Get timely reminders before bills become overdue so you never incur late penalties.
              </p>
            </div>

            <div className="rounded-2xl border border-border-light bg-muted/30 p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-text-primary">In-App & Email Reminders</p>
                <p className="text-xs text-text-tertiary">Alerts 3 days before any bill due date</p>
              </div>
              <input
                type="checkbox"
                checked={enableNotifications}
                onChange={(e) => setEnableNotifications(e.target.checked)}
                className="h-5 w-5 rounded-md text-primary accent-primary cursor-pointer"
              />
            </div>

            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="btn btn-secondary cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleFinish}
                disabled={submitting}
                className="btn btn-primary cursor-pointer flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" /> Get Started
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
