import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Mail, Shield, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [expirySeconds, setExpirySeconds] = useState(0);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Already signed in? redirect to home.
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
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email: target,
      });
      if (otpError) throw otpError;

      setOtpSent(true);
      setSuccess("Verification code sent! Check your inbox.");
      setResendCooldown(60);
      setExpirySeconds(300);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
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
      setTimeout(() => navigate({ to: "/", replace: true }), 700);
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

  const handleChangeEmail = () => {
    setOtpSent(false);
    setOtp(["", "", "", "", "", ""]);
    setError("");
    setSuccess("");
    setResendCooldown(0);
    setExpirySeconds(0);
  };

  const mmss = `${String(Math.floor(resendCooldown / 60)).padStart(2, "0")}:${String(
    resendCooldown % 60,
  ).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md">
        {/* Welcome Hero Illustration matching Phase 2 Screen 1 */}
        {!otpSent ? (
          <div className="card p-7 sm:p-8 rounded-[32px] shadow-2xl border border-border-light animate-fade-in">
            {/* Visual Icon Header */}
            <div className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-primary to-indigo-400 text-white shadow-xl shadow-primary/30">
                <Wallet className="h-10 w-10 stroke-[2]" />
              </div>
              <h1 className="text-2xl sm:text-[26px] font-extrabold tracking-tight text-text-primary">
                Take Control of Your Money
              </h1>
              <p className="mt-2 text-sm text-text-secondary leading-relaxed">
                Track bills, manage expenses and achieve your goals effortlessly.
              </p>
            </div>

            <form onSubmit={sendOTP} className="mt-4 space-y-4">
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
                <p className="mt-1.5 text-[11px] text-text-tertiary">
                  We'll send a 6-digit verification code to your inbox
                </p>
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
                    Get Started <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-text-tertiary">
              <ShieldCheck className="h-4 w-4 text-emerald-600" /> Secure OTP sign-in · No password needed
            </p>
          </div>
        ) : (
          /* OTP Screen matching Phase 2 Screen 3 */
          <div className="card p-7 sm:p-8 rounded-[32px] shadow-2xl border border-border-light animate-scale-in">
            <div className="text-center pb-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <Shield className="h-8 w-8 stroke-[2]" />
              </div>
              <h2 className="text-2xl font-bold text-text-primary">Enter OTP</h2>
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
                    ? `Resend OTP (${mmss})`
                    : "Didn't receive code? Resend OTP"}
                </button>
                <div>
                  <button
                    type="button"
                    onClick={handleChangeEmail}
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
