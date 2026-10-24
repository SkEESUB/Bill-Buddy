import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Loader2,
  Mail,
  Shield,
  ShieldCheck,
  Sparkles,
  Wallet,
  PieChart,
  BellRing,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthStep = "welcome" | "email" | "otp";

export function LoginPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<AuthStep>("welcome");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Already signed in? Redirect to home.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        navigate({ to: "/", replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (expirySeconds <= 0) return;
    const t = setTimeout(() => setExpirySeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [expirySeconds]);

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const sendOTP = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setSuccess("");

    if (!email) return setError("Please enter your email address");
    if (!isValidEmail(email)) return setError("Please enter a valid email address");

    setLoading(true);
    const target = email.trim().toLowerCase();

    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: target,
      });
      if (otpError) throw otpError;

      setStep("otp");
      setSuccess("Verification code sent! Check your inbox.");
      setResendCooldown(60);
      setExpirySeconds(300);
      setTimeout(() => otpRefs.current[0]?.focus(), 150);
    } catch (err) {
      console.error("[LoginPage] Send OTP failed:", err);
      const message = err instanceof Error ? err.message : "";
      setError(
        message.toLowerCase().includes("rate")
          ? "Too many requests. Please wait a minute and try again."
          : message || "Failed to send verification code. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async (otpCode?: string) => {
    const code = otpCode ?? otp.join("");
    setError("");
    setSuccess("");

    if (code.length !== 6) return setError("Please enter all 6 digits");
    if (!/^\d{6}$/.test(code)) return setError("Code must contain only numbers");

    setLoading(true);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("No session created. Please try again.");

      setSuccess("Verified! Welcome to BillBuddy.");
      setTimeout(() => navigate({ to: "/", replace: true }), 600);
    } catch (err) {
      console.error("[LoginPage] Verify OTP failed:", err);
      const message = (err instanceof Error ? err.message : "").toLowerCase();
      setError(
        message.includes("expired")
          ? "Code expired. Please request a new code."
          : "Invalid code. Please check and try again.",
      );
      setOtp(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;
    const next = otp.map((d, i) => (i === index ? value : d));
    setOtp(next);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (value && index === 5) {
      const full = next.join("");
      if (full.length === 6) void verifyOTP(full);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Backspace") return;
    if (!otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else {
      setOtp((prev) => prev.map((d, i) => (i === index ? "" : d)));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").trim();
    if (!/^\d{6}$/.test(pasted)) return;
    e.preventDefault();
    setOtp(pasted.split(""));
    otpRefs.current[5]?.focus();
    setTimeout(() => void verifyOTP(pasted), 100);
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    await sendOTP();
  };

  const mmss = `${String(Math.floor(resendCooldown / 60)).padStart(2, "0")}:${String(
    resendCooldown % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* STEP 1: WELCOME SCREEN (media_1792824194145.jpg Phase 2 Screen 1) */}
        {step === "welcome" && (
          <div className="card p-7 sm:p-8 rounded-[36px] shadow-2xl border border-border-light/80 animate-fade-in flex flex-col items-center text-center">
            {/* 3D Fintech Graphic Container */}
            <div className="relative my-4 flex h-36 w-36 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 via-primary to-purple-500 shadow-2xl shadow-primary/40">
              <div className="absolute inset-2 rounded-full border border-white/20 backdrop-blur-xs flex items-center justify-center">
                <Wallet className="h-16 w-16 text-white stroke-[1.8]" />
              </div>
              {/* Floating feature pills */}
              <span className="absolute -top-1 -right-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-400 text-slate-950 shadow-md">
                <Sparkles className="h-5 w-5" />
              </span>
              <span className="absolute -bottom-1 -left-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-400 text-slate-950 shadow-md">
                <PieChart className="h-5 w-5" />
              </span>
            </div>

            <h1 className="mt-4 text-2xl sm:text-[28px] font-extrabold tracking-tight text-text-primary leading-tight">
              Take Control of Your Money
            </h1>
            <p className="mt-2.5 text-sm text-text-secondary leading-relaxed max-w-xs">
              Track bills, manage budgets and achieve your financial goals effortlessly.
            </p>

            {/* Pagination Carousel Dots */}
            <div className="mt-6 flex items-center gap-2" aria-hidden="true">
              <span className="h-2 w-7 rounded-full bg-primary" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
              <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Action Buttons */}
            <div className="mt-8 w-full space-y-3">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="btn btn-primary w-full !min-h-12 !rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 cursor-pointer flex items-center justify-center gap-2"
              >
                Get Started <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Already have an account? <span className="text-primary font-bold">Sign In</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: EMAIL ENTRY SCREEN (Phase 2 Screen 2) */}
        {step === "email" && (
          <div className="card p-7 sm:p-8 rounded-[36px] shadow-2xl border border-border-light/80 animate-fade-in">
            {/* Top Back Navigation */}
            <div className="flex items-center justify-between pb-3">
              <button
                type="button"
                onClick={() => setStep("welcome")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                aria-label="Back to welcome"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
              <span className="text-xs font-bold text-text-tertiary">Step 1 of 2</span>
            </div>

            <div className="pt-2 pb-4">
              <h2 className="text-2xl font-extrabold tracking-tight text-text-primary">
                Enter Your Email
              </h2>
              <p className="mt-1.5 text-xs text-text-secondary leading-relaxed">
                We'll send a 6-digit verification code to your inbox to sign you in securely.
              </p>
            </div>

            <form onSubmit={sendOTP} className="mt-2 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1.5 block text-xs font-semibold text-text-secondary"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-text-tertiary" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    disabled={loading}
                    className="input-field pl-11"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
                  <span className="font-bold">!</span>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isValidEmail(email)}
                className="btn btn-primary w-full !min-h-12 !rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    Continue <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-text-tertiary">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Passwordless OTP · No password required
            </p>
          </div>
        )}

        {/* STEP 3: OTP VERIFICATION SCREEN (Phase 2 Screen 3) */}
        {step === "otp" && (
          <div className="card p-7 sm:p-8 rounded-[36px] shadow-2xl border border-border-light/80 animate-scale-in">
            {/* Top Back Navigation */}
            <div className="flex items-center justify-between pb-3">
              <button
                type="button"
                onClick={() => setStep("email")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                aria-label="Back to email"
              >
                <ArrowLeft className="h-4.5 w-4.5" />
              </button>
              <span className="text-xs font-bold text-text-tertiary">Step 2 of 2</span>
            </div>

            <div className="text-center pt-2 pb-4">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <Shield className="h-8 w-8 stroke-[2]" />
              </div>
              <h2 className="text-2xl font-extrabold tracking-tight text-text-primary">
                Enter OTP
              </h2>
              <p className="mt-1.5 text-xs text-text-secondary">
                We've sent a 6-digit code to
                <br />
                <span className="font-semibold text-text-primary">{email}</span>
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verifyOTP();
              }}
              className="mt-2 space-y-4"
            >
              <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      otpRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    disabled={loading}
                    className="h-13 w-11 sm:h-14 sm:w-12 rounded-2xl border-2 border-border-light bg-surface text-center text-xl font-bold text-text-primary outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/15 disabled:opacity-50"
                  />
                ))}
              </div>

              {error && (
                <div className="rounded-2xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 flex items-start gap-2">
                  <span className="font-bold">!</span>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.join("").length !== 6}
                className="btn btn-primary w-full !min-h-12 !rounded-2xl text-sm font-bold shadow-lg shadow-primary/25 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify & Continue"
                )}
              </button>

              <div className="space-y-2.5 text-center pt-2">
                <button
                  type="button"
                  onClick={() => void handleResendOTP()}
                  disabled={resendCooldown > 0 || loading}
                  className="text-xs font-semibold text-primary hover:underline disabled:text-text-tertiary disabled:no-underline cursor-pointer"
                >
                  {resendCooldown > 0
                    ? `Resend OTP in ${mmss}`
                    : "Didn't receive code? Resend OTP"}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setStep("email");
                      setOtp(["", "", "", "", "", ""]);
                    }}
                    className="text-xs text-text-secondary hover:text-text-primary cursor-pointer"
                  >
                    Change email address
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
