import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Loader2,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthStep = "welcome" | "email" | "otp";

/* ================================================================== *
 * SVG Illustrations                                                   *
 * ================================================================== */

/** Screen 1: Premium 3D wallet with floating finance cards & coins */
function WalletIllustration() {
  return (
    <div className="auth-illustration-container relative w-full flex items-center justify-center py-0.5 sm:py-2">
      <svg
        viewBox="0 0 380 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[190px] xs:max-w-[210px] sm:max-w-[260px] max-h-[115px] sm:max-h-[165px] h-auto object-contain transition-all duration-200"
        aria-hidden="true"
      >
        {/* Ambient glow ring */}
        <ellipse cx="190" cy="220" rx="140" ry="35" fill="url(#walletRingGrad)" opacity="0.5" />
        {/* Wallet body - dark blue gradient with leather texture feel */}
        <rect x="110" y="110" width="160" height="110" rx="18" fill="url(#walletBodyGrad)" />
        {/* Wallet clasp line */}
        <rect x="130" y="146" width="120" height="2" rx="1" fill="rgba(255,255,255,0.15)" />
        {/* Wallet flap */}
        <path
          d="M110 128 C110 110, 128 100, 190 100 C252 100, 270 110, 270 128 L270 140 L110 140 Z"
          fill="url(#walletFlapGrad)"
        />
        {/* Clasp button */}
        <circle cx="190" cy="165" r="10" fill="url(#claspGrad)" />
        <circle cx="190" cy="165" r="6" fill="url(#claspInnerGrad)" />
        {/* Belt/strap */}
        <rect
          x="107"
          y="155"
          width="166"
          height="20"
          rx="10"
          fill="url(#strapGrad)"
          opacity="0.7"
        />

        {/* Floating card — Track Expenses (top-center, light card) */}
        <g transform="translate(160, 55) rotate(-8)">
          <rect width="90" height="60" rx="12" fill="white" filter="url(#cardShadow)" />
          <rect width="90" height="60" rx="12" fill="url(#cardOverlay)" opacity="0.5" />
          {/* Chart bars */}
          <rect x="20" y="30" width="10" height="18" rx="3" fill="#818CF8" />
          <rect x="35" y="22" width="10" height="26" rx="3" fill="#6366F1" />
          <rect x="50" y="16" width="10" height="32" rx="3" fill="#4F46E5" />
          <text x="45" y="15" textAnchor="middle" fontSize="7" fontWeight="600" fill="#4F46E5">
            Track
          </text>
          <text x="45" y="55" textAnchor="middle" fontSize="6" fill="#6B7280">
            Expenses
          </text>
        </g>

        {/* Floating card — Pay Bills (right, salmon/orange) */}
        <g transform="translate(275, 105) rotate(5)">
          <rect width="72" height="60" rx="12" fill="#FFF7ED" filter="url(#cardShadow)" />
          <rect x="20" y="14" width="32" height="22" rx="6" fill="#FB923C" />
          <rect x="26" y="18" width="8" height="3" rx="1" fill="white" />
          <rect x="26" y="24" width="14" height="3" rx="1" fill="white" opacity="0.7" />
          <text x="36" y="50" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#EA580C">
            Pay Bills
          </text>
        </g>

        {/* Floating card — Achieve Goals (left, green) */}
        <g transform="translate(25, 120) rotate(-5)">
          <rect width="82" height="72" rx="14" fill="#ECFDF5" filter="url(#cardShadow)" />
          <circle cx="41" cy="30" r="15" fill="#D1FAE5" />
          <path
            d="M33 30 L39 36 L49 24"
            stroke="#059669"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <text x="41" y="58" textAnchor="middle" fontSize="6.5" fontWeight="600" fill="#059669">
            Achieve
          </text>
          <text x="41" y="66" textAnchor="middle" fontSize="6" fill="#6B7280">
            Goals
          </text>
        </g>

        {/* Floating coin — top-left (₹) */}
        <g transform="translate(90, 80)">
          <circle r="14" fill="url(#coinGrad)" filter="url(#coinShadow)" />
          <text textAnchor="middle" dy="5" fontSize="12" fontWeight="700" fill="#92400E">
            ₹
          </text>
        </g>

        {/* Floating coin — bottom-right */}
        <g transform="translate(305, 195)">
          <circle r="12" fill="url(#coinGrad)" filter="url(#coinShadow)" />
          <text textAnchor="middle" dy="4" fontSize="10" fontWeight="700" fill="#92400E">
            ₹
          </text>
        </g>

        {/* Arrow icon — purple circle bottom-right of wallet */}
        <g transform="translate(275, 180)">
          <circle r="14" fill="#7C3AED" />
          <path
            d="M-5 0 L5 0 M2 -4 L6 0 L2 4"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </g>

        {/* Sparkle decorations */}
        <g transform="translate(130, 72)" opacity="0.7">
          <path d="M0 -4 L1 0 L0 4 L-1 0 Z" fill="#FCD34D" />
          <path d="M-4 0 L0 1 L4 0 L0 -1 Z" fill="#FCD34D" />
        </g>

        <defs>
          <linearGradient
            id="walletBodyGrad"
            x1="110"
            y1="100"
            x2="270"
            y2="230"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#4338CA" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <linearGradient
            id="walletFlapGrad"
            x1="110"
            y1="95"
            x2="270"
            y2="145"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
          <linearGradient
            id="strapGrad"
            x1="107"
            y1="155"
            x2="273"
            y2="175"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#312E81" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
          <radialGradient id="claspGrad">
            <stop offset="0%" stopColor="#E5E7EB" />
            <stop offset="100%" stopColor="#9CA3AF" />
          </radialGradient>
          <radialGradient id="claspInnerGrad">
            <stop offset="0%" stopColor="#F9FAFB" />
            <stop offset="100%" stopColor="#D1D5DB" />
          </radialGradient>
          <radialGradient id="walletRingGrad">
            <stop offset="0%" stopColor="#C7D2FE" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#C7D2FE" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id="coinGrad"
            x1="-14"
            y1="-14"
            x2="14"
            y2="14"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FDE68A" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
          <linearGradient
            id="cardOverlay"
            x1="0"
            y1="0"
            x2="90"
            y2="60"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#EEF2FF" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#F5F3FF" stopOpacity="0" />
          </linearGradient>
          <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#0f2742" floodOpacity="0.08" />
          </filter>
          <filter id="coinShadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#92400E" floodOpacity="0.2" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

/** Screen 2: Premium 3D envelope with @ symbol and floating elements */
function EmailIllustration() {
  return (
    <div className="auth-illustration-container relative w-full flex items-center justify-center py-0.5 sm:py-2">
      <svg
        viewBox="0 0 380 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[170px] xs:max-w-[190px] sm:max-w-[240px] max-h-[95px] sm:max-h-[145px] h-auto object-contain transition-all duration-200"
        aria-hidden="true"
      >
        {/* Ambient glow ring */}
        <ellipse cx="190" cy="200" rx="130" ry="30" fill="url(#emailRingGrad)" opacity="0.4" />

        {/* Envelope body */}
        <rect x="100" y="100" width="180" height="120" rx="16" fill="url(#envelopeBodyGrad)" />
        {/* Envelope flap */}
        <path
          d="M100 116 C100 104, 112 100, 190 100 C268 100, 280 104, 280 116 L190 170 Z"
          fill="url(#envelopeFlapGrad)"
        />
        {/* Envelope inner line */}
        <path
          d="M105 112 L190 164 L275 112"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1.5"
          fill="none"
        />

        {/* @ symbol in purple hexagon */}
        <g transform="translate(190, 80)">
          <circle r="32" fill="url(#atBgGrad)" filter="url(#emailHeroShadow)" />
          <circle r="28" fill="url(#atBgInnerGrad)" opacity="0.6" />
          <text
            textAnchor="middle"
            dy="10"
            fontSize="30"
            fontWeight="700"
            fill="white"
            opacity="0.95"
          >
            @
          </text>
        </g>

        {/* Floating lock icon — right */}
        <g transform="translate(310, 150)">
          <rect
            x="-22"
            y="-22"
            width="44"
            height="44"
            rx="10"
            fill="white"
            filter="url(#emailCardShadow)"
          />
          <rect x="-12" y="-2" width="24" height="16" rx="4" fill="url(#lockBodyGrad)" />
          <path
            d="M-6 -2 L-6 -8 C-6 -14, 6 -14, 6 -8 L6 -2"
            stroke="#7C3AED"
            strokeWidth="2.5"
            fill="none"
            strokeLinecap="round"
          />
        </g>

        {/* Floating send icon — left */}
        <g transform="translate(68, 160)">
          <circle r="18" fill="url(#sendBgGrad)" filter="url(#emailCardShadow)" />
          <path d="M-7 2 L8 -6 L-3 8 L-2 1 Z" fill="white" />
        </g>

        {/* Floating purple sphere — top-right */}
        <circle cx="310" cy="80" r="8" fill="url(#sphereGrad)" opacity="0.7" />

        {/* Floating small sphere — left */}
        <circle cx="80" cy="100" r="5" fill="#A5B4FC" opacity="0.6" />

        <defs>
          <linearGradient
            id="envelopeBodyGrad"
            x1="100"
            y1="100"
            x2="280"
            y2="220"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#E0E7FF" />
            <stop offset="100%" stopColor="#EDE9FE" />
          </linearGradient>
          <linearGradient
            id="envelopeFlapGrad"
            x1="100"
            y1="100"
            x2="280"
            y2="170"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#C7D2FE" />
            <stop offset="50%" stopColor="#DDD6FE" />
            <stop offset="100%" stopColor="#E9D5FF" />
          </linearGradient>
          <linearGradient
            id="atBgGrad"
            x1="-32"
            y1="-32"
            x2="32"
            y2="32"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <radialGradient id="atBgInnerGrad">
            <stop offset="0%" stopColor="#A78BFA" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#7C3AED" stopOpacity="0" />
          </radialGradient>
          <linearGradient
            id="lockBodyGrad"
            x1="-12"
            y1="-2"
            x2="12"
            y2="14"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient
            id="sendBgGrad"
            x1="-18"
            y1="-18"
            x2="18"
            y2="18"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient
            id="sphereGrad"
            x1="-8"
            y1="-8"
            x2="8"
            y2="8"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <radialGradient id="emailRingGrad">
            <stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#DDD6FE" stopOpacity="0" />
          </radialGradient>
          <filter id="emailHeroShadow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="10"
              floodColor="#4F46E5"
              floodOpacity="0.25"
            />
          </filter>
          <filter id="emailCardShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0f2742" floodOpacity="0.08" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

/** Screen 3: Premium 3D shield with lock, envelope, and OTP elements */
function OTPIllustration() {
  return (
    <div className="auth-illustration-container relative w-full flex items-center justify-center py-0.5 sm:py-2">
      <svg
        viewBox="0 0 380 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[170px] xs:max-w-[190px] sm:max-w-[240px] max-h-[95px] sm:max-h-[145px] h-auto object-contain transition-all duration-200"
        aria-hidden="true"
      >
        {/* Ambient glow */}
        <ellipse cx="190" cy="200" rx="130" ry="30" fill="url(#otpRingGrad)" opacity="0.4" />

        {/* Shield shape */}
        <path
          d="M190 40 C220 40, 260 55, 280 70 C280 140, 260 190, 190 220 C120 190, 100 140, 100 70 C120 55, 160 40, 190 40Z"
          fill="url(#shieldGrad)"
          filter="url(#shieldShadow)"
        />
        <path
          d="M190 50 C216 50, 250 63, 268 76 C268 138, 252 182, 190 210 C128 182, 112 138, 112 76 C130 63, 164 50, 190 50Z"
          fill="url(#shieldInnerGrad)"
          opacity="0.5"
        />

        {/* Lock icon in center */}
        <g transform="translate(190, 115)">
          <rect x="-18" y="-4" width="36" height="28" rx="6" fill="white" opacity="0.9" />
          <path
            d="M-8 -4 L-8 -14 C-8 -22, 8 -22, 8 -14 L8 -4"
            stroke="white"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            opacity="0.7"
          />
          <rect x="-16" y="-2" width="32" height="24" rx="5" fill="url(#otpLockGrad)" />
          <circle cx="0" cy="8" r="4" fill="white" opacity="0.9" />
          <rect x="-1.5" y="10" width="3" height="6" rx="1.5" fill="white" opacity="0.7" />
        </g>

        {/* Floating envelope — bottom-left */}
        <g transform="translate(80, 170) rotate(-12)">
          <rect
            x="-28"
            y="-18"
            width="56"
            height="36"
            rx="6"
            fill="white"
            filter="url(#otpCardShadow)"
          />
          <path d="M-24 -14 L0 2 L24 -14" stroke="#C7D2FE" strokeWidth="1.5" fill="none" />
          <circle cx="14" cy="-22" r="6" fill="#F87171" />
        </g>

        {/* Floating OTP code card — right */}
        <g transform="translate(300, 150) rotate(8)">
          <rect
            x="-32"
            y="-18"
            width="64"
            height="36"
            rx="8"
            fill="white"
            filter="url(#otpCardShadow)"
          />
          <text
            x="0"
            y="4"
            textAnchor="middle"
            fontSize="14"
            fontWeight="700"
            fill="#A78BFA"
            letterSpacing="3"
          >
            ***
          </text>
        </g>

        {/* Floating purple sphere — top-right */}
        <circle cx="300" cy="60" r="10" fill="url(#otpSphereGrad)" opacity="0.6" />
        {/* Small sphere — left */}
        <circle cx="85" cy="85" r="6" fill="#A5B4FC" opacity="0.5" />
        {/* Tiny sphere — bottom */}
        <circle cx="240" cy="210" r="5" fill="#C4B5FD" opacity="0.4" />

        <defs>
          <linearGradient
            id="shieldGrad"
            x1="100"
            y1="40"
            x2="280"
            y2="220"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#C7D2FE" />
            <stop offset="50%" stopColor="#DDD6FE" />
            <stop offset="100%" stopColor="#E9D5FF" />
          </linearGradient>
          <linearGradient
            id="shieldInnerGrad"
            x1="112"
            y1="50"
            x2="268"
            y2="210"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#EEF2FF" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#F5F3FF" stopOpacity="0.2" />
          </linearGradient>
          <linearGradient
            id="otpLockGrad"
            x1="-16"
            y1="-2"
            x2="16"
            y2="22"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient
            id="otpSphereGrad"
            x1="-10"
            y1="-10"
            x2="10"
            y2="10"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6366F1" />
          </linearGradient>
          <radialGradient id="otpRingGrad">
            <stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#DDD6FE" stopOpacity="0" />
          </radialGradient>
          <filter id="shieldShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="6"
              stdDeviation="12"
              floodColor="#4F46E5"
              floodOpacity="0.15"
            />
          </filter>
          <filter id="otpCardShadow" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#0f2742" floodOpacity="0.08" />
          </filter>
        </defs>
      </svg>
    </div>
  );
}

/* ================================================================== *
 * Feature icon components for onboarding                              *
 * ================================================================== */

function FeatureIcon({
  icon,
  bgColor,
  iconColor,
}: {
  icon: React.ReactNode;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <div
      className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl sm:rounded-2xl transition-transform"
      style={{ backgroundColor: bgColor }}
    >
      <div style={{ color: iconColor }}>{icon}</div>
    </div>
  );
}

/* ================================================================== *
 * Main LoginPage component                                            *
 * ================================================================== */

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

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    // Delay slightly to let virtual keyboard complete transition on mobile devices
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 280);
  };

  return (
    <div className="auth-root relative flex flex-col items-center justify-start sm:justify-center">
      {/* Ambient background gradients */}
      <div className="auth-bg-glow auth-bg-glow-1" />
      <div className="auth-bg-glow auth-bg-glow-2" />
      <div className="auth-bg-glow auth-bg-glow-3" />

      <div className="relative z-10 flex flex-col items-center w-full max-w-[420px] mx-auto my-auto py-1 sm:py-3">
        <div className="w-full">
          {/* ============================================================ */}
          {/* SCREEN 1: ONBOARDING / WELCOME                               */}
          {/* ============================================================ */}
          {step === "welcome" && (
            <div className="animate-fade-in flex flex-col items-center w-full my-auto">
              {/* Top bar: Logo & Skip */}
              <div className="flex w-full items-center justify-between mb-1 sm:mb-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 shadow-md">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <rect x="2" y="6" width="20" height="14" rx="3" />
                      <path d="M2 10h20" />
                    </svg>
                  </div>
                  <span className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
                    BillBuddy
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="flex items-center gap-0.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors cursor-pointer"
                >
                  Skip <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Hero illustration */}
              <WalletIllustration />

              {/* Heading */}
              <h1 className="mt-1 sm:mt-2 text-center text-[20px] xs:text-[22px] sm:text-[28px] font-extrabold leading-[1.18] tracking-tight text-slate-900">
                Take Control of
                <br />
                <span className="auth-gradient-text">Your Money</span>
              </h1>

              {/* Subtext */}
              <p className="mt-1 sm:mt-1.5 text-center text-xs sm:text-sm leading-relaxed text-slate-500 max-w-[280px]">
                Track bills, manage budgets and achieve your financial goals effortlessly.
              </p>

              {/* Feature row */}
              <div className="mt-2 sm:mt-3.5 flex w-full items-start justify-center gap-2 xs:gap-3.5 sm:gap-6 px-1">
                <div className="flex flex-col items-center text-center max-w-[78px] xs:max-w-[86px] sm:max-w-[92px]">
                  <FeatureIcon
                    bgColor="#EDE9FE"
                    iconColor="#7C3AED"
                    icon={
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="3" />
                        <path d="M7 8h10M7 12h6" />
                      </svg>
                    }
                  />
                  <span className="mt-1.5 text-[10px] xs:text-[11px] sm:text-xs font-bold text-slate-800">
                    Track Bills
                  </span>
                  <span className="text-[8.5px] xs:text-[9.5px] sm:text-[10px] text-slate-500 leading-tight">
                    Never miss a payment
                  </span>
                </div>
                <div className="flex flex-col items-center text-center max-w-[78px] xs:max-w-[86px] sm:max-w-[92px]">
                  <FeatureIcon
                    bgColor="#FEE2E2"
                    iconColor="#EF4444"
                    icon={
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <path d="M6 20V8M12 20V4M18 20V12" />
                      </svg>
                    }
                  />
                  <span className="mt-1.5 text-[10px] xs:text-[11px] sm:text-xs font-bold text-slate-800">
                    Manage Budgets
                  </span>
                  <span className="text-[8.5px] xs:text-[9.5px] sm:text-[10px] text-slate-500 leading-tight">
                    Stay on top of spending
                  </span>
                </div>
                <div className="flex flex-col items-center text-center max-w-[78px] xs:max-w-[86px] sm:max-w-[92px]">
                  <FeatureIcon
                    bgColor="#DCFCE7"
                    iconColor="#16A34A"
                    icon={
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M8 12l3 3 5-5" />
                      </svg>
                    }
                  />
                  <span className="mt-1.5 text-[10px] xs:text-[11px] sm:text-xs font-bold text-slate-800">
                    Achieve Goals
                  </span>
                  <span className="text-[8.5px] xs:text-[9.5px] sm:text-[10px] text-slate-500 leading-tight">
                    Build a better future
                  </span>
                </div>
              </div>

              {/* Page indicators */}
              <div className="mt-2.5 sm:mt-3.5 flex items-center gap-1.5" aria-hidden="true">
                <span className="h-1.5 w-6 rounded-full bg-indigo-600" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
              </div>

              {/* Actions */}
              <div className="mt-3.5 sm:mt-5 w-full space-y-2 sm:space-y-2.5">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="auth-btn-gradient w-full min-h-[46px] sm:min-h-[52px] py-2 text-sm sm:text-base cursor-pointer"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4.5 w-4.5" />
                </button>

                <p className="text-center text-xs sm:text-sm text-slate-500">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="font-bold text-slate-800 hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 2: EMAIL ENTRY                                        */}
          {/* ============================================================ */}
          {step === "email" && (
            <div className="animate-fade-in flex flex-col items-center w-full my-auto">
              {/* Top bar */}
              <div className="flex w-full items-center justify-between mb-1 sm:mb-2">
                <button
                  type="button"
                  onClick={() => setStep("welcome")}
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer"
                  aria-label="Back to welcome"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                    Step 1 of 2
                  </span>
                  <div className="h-1 w-16 sm:w-20 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full w-1/2 rounded-full bg-indigo-600" />
                  </div>
                </div>
              </div>

              {/* Illustration */}
              <EmailIllustration />

              {/* Heading */}
              <h2 className="mt-1 sm:mt-2 text-center text-[20px] xs:text-[22px] sm:text-[28px] font-extrabold leading-[1.18] tracking-tight text-slate-900">
                Enter Your <span className="auth-gradient-text">Email</span>
              </h2>

              {/* Subtext */}
              <p className="mt-1 sm:mt-1.5 text-center text-xs sm:text-sm leading-relaxed text-slate-500 max-w-[280px]">
                We'll send a 6-digit verification code to your inbox to sign you in securely.
              </p>

              {/* Form */}
              <form onSubmit={sendOTP} className="mt-2.5 sm:mt-4 w-full space-y-2.5 sm:space-y-3">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block text-xs sm:text-sm font-semibold text-slate-800"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={handleInputFocus}
                      placeholder="name@example.com"
                      disabled={loading}
                      className="auth-input pl-10 text-xs sm:text-sm min-h-[44px] sm:min-h-[50px]"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 p-2.5 text-xs text-rose-700 flex items-start gap-1.5">
                    <span className="font-bold shrink-0">!</span>
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !isValidEmail(email)}
                  className="auth-btn-gradient w-full min-h-[46px] sm:min-h-[52px] py-2 text-sm sm:text-base cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4.5 w-4.5 animate-spin" />
                      <span>Sending Code...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="h-4.5 w-4.5" />
                    </>
                  )}
                </button>
              </form>

              {/* OR divider */}
              <div className="mt-2.5 sm:mt-3.5 flex w-full items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[11px] sm:text-xs font-medium text-slate-400">OR</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Social sign-in buttons */}
              <div className="mt-2 sm:mt-3 flex w-full gap-2.5">
                <button
                  type="button"
                  disabled
                  className="auth-social-btn flex-1 min-h-[40px] sm:min-h-[46px] py-1.5 sm:py-2"
                  title="Google sign-in not configured"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-700 leading-tight">
                    Continue with Google
                  </span>
                </button>
                <button
                  type="button"
                  disabled
                  className="auth-social-btn flex-1 min-h-[40px] sm:min-h-[46px] py-1.5 sm:py-2"
                  title="Apple sign-in not configured"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-slate-900"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.52-3.23 0-1.44.62-2.2.44-3.06-.4C3.79 16.17 4.36 9.04 8.93 8.78c1.27.07 2.15.72 2.91.78.97-.2 1.9-.75 2.96-.68 1.25.1 2.19.6 2.82 1.5-2.57 1.54-1.97 4.92.58 5.87-.48 1.27-.69 1.83-1.15 3.03zM12.02 8.7c-.14-2.32 1.81-4.31 4-4.5.27 2.59-2.34 4.57-4 4.5z" />
                  </svg>
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-700 leading-tight">
                    Continue with Apple
                  </span>
                </button>
              </div>

              {/* Passwordless note */}
              <p className="mt-2.5 sm:mt-3.5 flex items-center justify-center gap-1.5 text-[11px] sm:text-xs text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                Passwordless OTP · No password required
              </p>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 3: OTP VERIFICATION                                   */}
          {/* ============================================================ */}
          {step === "otp" && (
            <div className="animate-scale-in flex flex-col items-center w-full my-auto">
              {/* Top bar */}
              <div className="flex w-full items-center justify-between mb-1 sm:mb-2">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow-sm text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all cursor-pointer"
                  aria-label="Back to email"
                >
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-[11px] sm:text-xs font-semibold text-slate-500">
                    Step 2 of 2
                  </span>
                  <div className="h-1 w-16 sm:w-20 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full w-full rounded-full bg-indigo-600" />
                  </div>
                </div>
              </div>

              {/* Illustration */}
              <OTPIllustration />

              {/* Heading */}
              <h2 className="mt-1 sm:mt-2 text-center text-[20px] xs:text-[22px] sm:text-[28px] font-extrabold leading-[1.18] tracking-tight text-slate-900">
                Enter <span className="auth-gradient-text">OTP</span>
              </h2>

              {/* Email display */}
              <p className="mt-1 text-center text-xs sm:text-sm text-slate-500">
                We've sent a 6-digit code to
              </p>
              <p className="text-center text-xs sm:text-sm font-bold text-slate-900">{email}</p>

              {/* OTP input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verifyOTP();
                }}
                className="mt-3 sm:mt-4 w-full"
              >
                <div className="flex justify-center gap-1.5 xs:gap-2 sm:gap-2.5" onPaste={handlePaste}>
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
                      onFocus={handleInputFocus}
                      disabled={loading}
                      className="auth-otp-input"
                      aria-label={`Digit ${index + 1}`}
                    />
                  ))}
                </div>

                {/* Status messages */}
                <div className="mt-2.5 sm:mt-3 space-y-1.5">
                  {error && (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-2 text-xs text-rose-700 flex items-start gap-1.5">
                      <span className="font-bold shrink-0">!</span>
                      <span>{error}</span>
                    </div>
                  )}
                  {success && (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-700 flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{success}</span>
                    </div>
                  )}
                </div>

                {/* Verify button */}
                <div className="mt-3 sm:mt-3.5">
                  <button
                    type="submit"
                    disabled={loading || otp.join("").length !== 6}
                    className="auth-btn-gradient w-full min-h-[46px] sm:min-h-[52px] py-2 text-sm sm:text-base cursor-pointer"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Verify & Continue</span>
                        <ArrowRight className="h-4.5 w-4.5" />
                      </>
                    )}
                  </button>
                </div>

                {/* Resend countdown */}
                <p className="mt-2.5 sm:mt-3 text-center text-xs sm:text-sm text-slate-500">
                  {resendCooldown > 0 ? (
                    <>
                      Resend OTP in <span className="font-bold text-indigo-600">{mmss}</span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleResendOTP()}
                      disabled={loading}
                      className="font-semibold text-indigo-600 hover:underline cursor-pointer disabled:text-slate-400 disabled:no-underline"
                    >
                      Didn't receive code? Resend OTP
                    </button>
                  )}
                </p>

                {/* OR divider */}
                <div className="mt-2.5 sm:mt-3 flex w-full items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span className="text-[11px] sm:text-xs font-medium text-slate-400">OR</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                {/* Change email */}
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp(["", "", "", "", "", ""]);
                    setError("");
                    setSuccess("");
                  }}
                  className="mt-2.5 sm:mt-3 flex w-full items-center gap-2.5 rounded-xl bg-white border border-slate-200 px-3.5 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-sm"
                >
                  <Edit3 className="h-4 w-4 text-indigo-500" />
                  <span className="flex-1 text-left">Change email address</span>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
