import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Check, Loader2, Mail, ShieldCheck, Wallet } from "lucide-react";
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

  // Already signed in? go home.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        console.log("✅ User already logged in, redirecting...");
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
    console.log("📧 Sending OTP to:", target);

    try {
      const { data, error: otpError } = await supabase.auth.signInWithOtp({
        email: target,
        options: {
          shouldCreateUser: true,
          ...(typeof window !== "undefined" && window.location.origin
            ? { emailRedirectTo: window.location.origin }
            : {}),
        },
      });
      console.log("📨 Backend response:", { data, error: otpError });
      if (otpError) throw otpError;

      setOtpSent(true);
      setSuccess("Verification code sent! Check your email.");
      setResendCooldown(60);
      setExpirySeconds(300);
      console.log("✅ OTP sent successfully to:", target);
      console.log("📬 Check your inbox (and spam folder)");
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      console.error("❌ Send OTP failed:", err);
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
    console.log("🔐 Verifying OTP:", code);

    try {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: "email",
      });
      console.log("🔍 Verify response:", { data, error: verifyError });
      if (verifyError) throw verifyError;
      if (!data.session) throw new Error("No session created. Please try again.");

      console.log("✅ Verified! User:", data.user?.email);
      setSuccess("Verified! Redirecting...");
      setTimeout(() => navigate({ to: "/", replace: true }), 800);
    } catch (err) {
      console.error("❌ Verify OTP failed:", err);
      const message = (err instanceof Error ? err.message : "").toLowerCase();
      setError(
        message.includes("expired")
          ? "Code expired. Please request a new one."
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

  const mmss = `${Math.floor(expirySeconds / 60)}:${String(expirySeconds % 60).padStart(2, "0")}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-[20px] bg-primary shadow-[0_12px_32px_-12px_rgba(75,29,63,0.55)]">
            <Wallet className="h-7 w-7 text-white" strokeWidth={1.75} />
          </div>
          <h1 className="mb-1.5 text-[28px] font-bold tracking-tight text-text-primary">
            BillBuddy
          </h1>
          <p className="text-[15px] text-text-secondary">Never miss a payment again</p>
        </div>

        <div className="card p-7">
          {!otpSent ? (
            <form onSubmit={sendOTP}>
              <div className="mb-6">
                <label
                  htmlFor="email"
                  className="mb-2 block text-[13px] font-medium text-text-secondary"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-text-tertiary" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={loading}
                    className="input-field pl-11"
                  />
                </div>
                <p className="mt-2 text-[13px] text-text-tertiary">
                  We&apos;ll send you a 6-digit verification code
                </p>
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl bg-soft-red p-3 text-sm text-[#A73A4C]">
                  <span className="font-semibold">!</span>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl bg-soft-green p-3 text-sm text-[#1F7053]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !isValidEmail(email)}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verifyOTP();
              }}
            >
              <div className="mb-6 text-center">
                <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-soft-blue">
                  <Mail className="h-6 w-6 text-primary" strokeWidth={1.75} />
                </div>
                <h2 className="mb-2 text-[22px] font-semibold text-text-primary">
                  Check Your Email
                </h2>
                <p className="text-sm text-text-secondary">
                  We sent a 6-digit code to
                  <br />
                  <strong className="text-text-primary">{email}</strong>
                </p>
              </div>

              <div className="mb-4 flex justify-center gap-2" onPaste={handlePaste}>
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
                    className="h-14 w-12 rounded-2xl border border-border-light bg-elevated text-center text-[22px] font-semibold text-text-primary outline-none transition focus:border-primary focus:bg-surface focus:ring-4 focus:ring-[rgba(49,87,246,0.12)] disabled:opacity-50"
                  />
                ))}
              </div>

              <p className="mb-6 text-center text-[13px] text-text-tertiary">
                {expirySeconds > 0 ? `Code expires in ${mmss}` : "Code expired — request a new one"}
              </p>

              {error && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl bg-soft-red p-3 text-sm text-[#A73A4C]">
                  <span className="font-semibold">!</span>
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl bg-soft-green p-3 text-sm text-[#1F7053]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.join("").length !== 6}
                className="btn btn-primary mb-4 w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </button>

              <div className="space-y-3 text-center">
                <button
                  type="button"
                  onClick={() => void handleResendOTP()}
                  disabled={resendCooldown > 0 || loading}
                  className="text-sm font-medium text-primary hover:underline disabled:text-text-tertiary disabled:no-underline"
                >
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive code? Resend"}
                </button>
                <br />
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  className="text-sm text-text-secondary hover:text-text-primary"
                >
                  Change email address
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-[13px] text-text-tertiary">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure sign-in · No password to remember
        </p>
      </div>
    </div>
  );
}

export default LoginPage;
