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
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type AuthStep = "welcome" | "email" | "otp";

/* ================================================================== *
 * SVG Illustrations matching reference designs                        *
 * ================================================================== */

/**
 * Screen 1: 3D Smartphone illustration with glowing neon orbital ring,
 * live mini dashboard UI, and floating 3D finance cards (Calendar, Wallet, Chart, Receipt).
 */
export function WalletIllustration() {
  return (
    <div className="auth-illustration-container relative w-full flex items-center justify-center py-1 sm:py-2.5 my-0.5">
      <svg
        viewBox="0 0 380 320"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[260px] xs:max-w-[290px] sm:max-w-[340px] max-h-[170px] xs:max-h-[190px] sm:max-h-[220px] h-auto object-contain transition-all duration-200 drop-shadow-[0_16px_32px_rgba(109,40,217,0.18)]"
        aria-hidden="true"
      >
        <defs>
          {/* Orbital Neon Ring Gradients */}
          <linearGradient
            id="walletRingGrad"
            x1="40"
            y1="210"
            x2="340"
            y2="210"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#E9D5FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.4" />
          </linearGradient>
          <radialGradient id="ringGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#DDD6FE" stopOpacity="0" />
          </radialGradient>

          {/* Phone Frame Gradients */}
          <linearGradient
            id="phoneChassis"
            x1="120"
            y1="40"
            x2="260"
            y2="280"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="50%" stopColor="#6D28D9" />
            <stop offset="100%" stopColor="#4F46E5" />
          </linearGradient>
          <linearGradient
            id="phoneScreenGrad"
            x1="125"
            y1="45"
            x2="255"
            y2="275"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="40%" stopColor="#FAF5FF" />
            <stop offset="100%" stopColor="#EDE9FE" />
          </linearGradient>

          {/* Floating Card Shadows */}
          <filter id="floatCardShadow" x="-20%" y="-20%" width="150%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#4C1D95" floodOpacity="0.12" />
          </filter>
          <filter id="phoneShadow" x="-20%" y="-15%" width="140%" height="135%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="14"
              floodColor="#5B21B6"
              floodOpacity="0.25"
            />
          </filter>
        </defs>

        {/* Ambient background bloom */}
        <ellipse cx="190" cy="180" rx="140" ry="80" fill="url(#ringGlow)" />

        {/* Orbital Neon Ring (Back portion) */}
        <path
          d="M 50 195 C 50 155, 330 155, 330 195"
          stroke="url(#walletRingGrad)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.6"
        />

        {/* Floating Top-Left Card: 3D Calendar with Golden Bell & Rays */}
        <g transform="translate(60, 48)" filter="url(#floatCardShadow)">
          {/* Card background */}
          <rect x="0" y="0" width="56" height="56" rx="16" fill="#FFFFFF" />
          {/* Orange rays */}
          <path d="M-4 12 L-10 8" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M-1 4 L-5 -3" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M8 -2 L8 -8" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          {/* Calendar base */}
          <rect x="11" y="14" width="34" height="30" rx="7" fill="#6366F1" />
          <rect x="11" y="14" width="34" height="10" rx="4" fill="#4F46E5" />
          {/* Calendar grid dots */}
          <circle cx="18" cy="30" r="2" fill="#E0E7FF" />
          <circle cx="28" cy="30" r="2" fill="#E0E7FF" />
          <circle cx="38" cy="30" r="2" fill="#E0E7FF" />
          <circle cx="18" cy="37" r="2" fill="#E0E7FF" />
          <circle cx="28" cy="37" r="2" fill="#E0E7FF" />
          {/* Golden Notification Bell */}
          <path
            d="M 37 25 C 37 21, 47 21, 47 25 L 49 32 L 35 32 Z"
            fill="#F59E0B"
            stroke="#D97706"
            strokeWidth="0.8"
          />
          <circle cx="42" cy="33.5" r="2" fill="#B45309" />
        </g>

        {/* Floating Top-Right Card: 3D Bar Chart Tile */}
        <g transform="translate(268, 70)" filter="url(#floatCardShadow)">
          <rect x="0" y="0" width="54" height="54" rx="16" fill="#FFFFFF" />
          {/* Chart bars */}
          <rect x="13" y="27" width="7" height="16" rx="3" fill="#C4B5FD" />
          <rect x="23" y="19" width="7" height="24" rx="3" fill="#8B5CF6" />
          <rect x="33" y="12" width="7" height="31" rx="3" fill="#6D28D9" />
          {/* Sparkle badge */}
          <path
            d="M 12 14 L 14 10 L 16 14 L 20 16 L 16 18 L 14 22 L 12 18 L 8 16 Z"
            fill="#DDD6FE"
          />
        </g>

        {/* Floating Mid-Left Card: 3D ₹ Receipt */}
        <g transform="translate(48, 172)" filter="url(#floatCardShadow)">
          <rect x="0" y="0" width="54" height="60" rx="14" fill="#FFFFFF" />
          <text x="12" y="24" fontSize="16" fontWeight="800" fill="#6366F1">
            ₹
          </text>
          <rect x="12" y="32" width="30" height="3" rx="1.5" fill="#CBD5E1" />
          <rect x="12" y="39" width="24" height="3" rx="1.5" fill="#CBD5E1" />
          <rect x="12" y="46" width="16" height="3" rx="1.5" fill="#CBD5E1" />
        </g>

        {/* Floating Mid-Right Card: 3D Purple Wallet with Golden Clasp & Rays */}
        <g transform="translate(262, 176)" filter="url(#floatCardShadow)">
          <rect x="0" y="0" width="56" height="52" rx="16" fill="#FFFFFF" />
          {/* Rays */}
          <path d="M 52 10 L 59 6" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 57 18 L 64 17" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
          {/* Wallet body */}
          <rect x="9" y="12" width="38" height="28" rx="8" fill="#7C3AED" />
          <path d="M 9 18 C 9 14, 47 14, 47 18 L 47 24 L 9 24 Z" fill="#6D28D9" />
          {/* Golden clasp */}
          <rect x="32" y="22" width="15" height="9" rx="4.5" fill="#FBBF24" />
          <circle cx="36" cy="26.5" r="1.8" fill="#B45309" />
        </g>

        {/* MAIN 3D SMARTPHONE */}
        <g transform="translate(112, 28)" filter="url(#phoneShadow)">
          {/* Outer chassis */}
          <rect x="0" y="0" width="156" height="254" rx="28" fill="url(#phoneChassis)" />
          {/* Inner bezel highlight */}
          <rect
            x="2.5"
            y="2.5"
            width="151"
            height="249"
            rx="26"
            stroke="#A78BFA"
            strokeWidth="1.5"
            fill="none"
            opacity="0.6"
          />
          {/* Screen surface */}
          <rect x="6" y="6" width="144" height="242" rx="22" fill="url(#phoneScreenGrad)" />

          {/* Screen Header Bar: Mascot & Bell */}
          <g transform="translate(16, 16)">
            {/* Mini BillBuddy brand icon */}
            <circle cx="9" cy="9" r="8" fill="#7C3AED" />
            <text x="9" y="12.5" textAnchor="middle" fontSize="9" fontWeight="900" fill="#FFFFFF">
              B
            </text>
            <text x="22" y="12.5" fontSize="8.5" fontWeight="800" fill="#1E1B4B">
              BillBuddy
            </text>
            {/* Bell icon on right */}
            <path
              d="M 120 6 C 120 4, 126 4, 126 6 L 128 11 L 118 11 Z"
              fill="none"
              stroke="#4B5563"
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <circle cx="123" cy="12.5" r="1" fill="#4B5563" />
          </g>

          {/* Balance card section */}
          <g transform="translate(16, 38)">
            <text x="2" y="9" fontSize="7" fontWeight="600" fill="#6B7280">
              Total Balance
            </text>
            <text x="2" y="25" fontSize="16" fontWeight="900" fill="#0F172A">
              ₹24,560
            </text>
            {/* Eye toggle icon */}
            <circle cx="120" cy="19" r="6" fill="#F1F5F9" />
            <circle cx="120" cy="19" r="2.5" fill="#64748B" />
          </g>

          {/* Wavy lavender decorative separator */}
          <path
            d="M 6 86 C 40 76, 80 96, 115 82 C 135 74, 145 80, 150 82 L 150 100 L 6 100 Z"
            fill="#EDE9FE"
            opacity="0.7"
          />

          {/* Two status pills: Income & Spends */}
          <g transform="translate(14, 96)">
            {/* Income pill */}
            <rect
              x="0"
              y="0"
              width="60"
              height="26"
              rx="8"
              fill="#F0FDF4"
              stroke="#DCFCE7"
              strokeWidth="0.8"
            />
            <circle cx="10" cy="13" r="5" fill="#86EFAC" />
            <path
              d="M 10 10 L 10 16 M 8 14 L 10 16 L 12 14"
              stroke="#15803D"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <text x="19" y="10" fontSize="5.5" fontWeight="600" fill="#166534">
              Income
            </text>
            <text x="19" y="20" fontSize="7" fontWeight="800" fill="#14532D">
              ₹40,000
            </text>

            {/* Spends pill */}
            <rect
              x="66"
              y="0"
              width="60"
              height="26"
              rx="8"
              fill="#FEF2F2"
              stroke="#FEE2E2"
              strokeWidth="0.8"
            />
            <circle cx="76" cy="13" r="5" fill="#FCA5A5" />
            <path
              d="M 76 16 L 76 10 M 74 12 L 76 10 L 78 12"
              stroke="#B91C1C"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <text x="85" y="10" fontSize="5.5" fontWeight="600" fill="#991B1B">
              Spends
            </text>
            <text x="85" y="20" fontSize="7" fontWeight="800" fill="#7F1D1D">
              ₹15,440
            </text>
          </g>

          {/* Upcoming Bills Header */}
          <g transform="translate(16, 134)">
            <rect x="0" y="0" width="9" height="9" rx="2" fill="#6366F1" />
            <text x="13" y="7.5" fontSize="7" fontWeight="800" fill="#1E293B">
              Upcoming Bills
            </text>
            <rect x="94" y="0" width="30" height="11" rx="5.5" fill="#EEF2FF" />
            <text x="109" y="8" textAnchor="middle" fontSize="6" fontWeight="700" fill="#4F46E5">
              3 Due
            </text>
          </g>

          {/* Bill Row 1: Mobile Recharge */}
          <g transform="translate(14, 152)">
            <rect
              x="0"
              y="0"
              width="126"
              height="34"
              rx="10"
              fill="#FFFFFF"
              stroke="#F1F5F9"
              strokeWidth="0.8"
            />
            <rect x="7" y="8" width="18" height="18" rx="6" fill="#EEF2FF" />
            <path
              d="M 16 13 L 16 21 M 13 17 L 19 17"
              stroke="#6366F1"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <text x="30" y="17" fontSize="7" fontWeight="700" fill="#1E293B">
              Mobile Recharge
            </text>
            <text x="30" y="24" fontSize="5.5" fontWeight="600" fill="#64748B">
              Due Tomorrow
            </text>
            <text x="119" y="21" textAnchor="end" fontSize="8" fontWeight="800" fill="#0F172A">
              ₹299
            </text>
          </g>

          {/* Bill Row 2: Electricity Bill */}
          <g transform="translate(14, 192)">
            <rect
              x="0"
              y="0"
              width="126"
              height="34"
              rx="10"
              fill="#FFFFFF"
              stroke="#F1F5F9"
              strokeWidth="0.8"
            />
            <rect x="7" y="8" width="18" height="18" rx="6" fill="#FDF4FF" />
            <path d="M 16 12 L 13 18 L 16 18 L 15 23 L 19 17 L 16 17 Z" fill="#A855F7" />
            <text x="30" y="17" fontSize="7" fontWeight="700" fill="#1E293B">
              Electricity Bill
            </text>
            <text x="30" y="24" fontSize="5.5" fontWeight="600" fill="#64748B">
              Due in 3 days
            </text>
            <text x="119" y="21" textAnchor="end" fontSize="8" fontWeight="800" fill="#0F172A">
              ₹1,240
            </text>
          </g>
        </g>

        {/* Orbital Neon Ring (Front portion with glowing gradient) */}
        <path
          d="M 330 195 C 330 235, 50 235, 50 195"
          stroke="url(#walletRingGrad)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Screen 2: 3D Open Purple Envelope with glowing "@" symbol,
 * 3D security shield with checkmark, floating receipt, calendar & glowing orbital ring.
 */
export function EmailIllustration() {
  return (
    <div className="auth-illustration-container relative w-full flex items-center justify-center py-1 sm:py-2.5 my-0.5">
      <svg
        viewBox="0 0 380 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[240px] xs:max-w-[270px] sm:max-w-[310px] max-h-[160px] xs:max-h-[180px] sm:max-h-[210px] h-auto object-contain transition-all duration-200 drop-shadow-[0_16px_32px_rgba(109,40,217,0.16)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="emailRingGrad"
            x1="40"
            y1="190"
            x2="340"
            y2="190"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#E9D5FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient
            id="envBodyGrad"
            x1="120"
            y1="110"
            x2="260"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#8B5CF6" />
            <stop offset="60%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
          <linearGradient
            id="shieldGrad2"
            x1="220"
            y1="150"
            x2="290"
            y2="230"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
          <radialGradient id="emailGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0" />
          </radialGradient>
          <filter id="envShadow" x="-20%" y="-15%" width="140%" height="135%">
            <feDropShadow
              dx="0"
              dy="10"
              stdDeviation="12"
              floodColor="#5B21B6"
              floodOpacity="0.2"
            />
          </filter>
        </defs>

        {/* Ambient bloom */}
        <ellipse cx="190" cy="180" rx="140" ry="70" fill="url(#emailGlow)" />

        {/* Orbital Ring (Back portion) */}
        <path
          d="M 60 185 C 60 145, 320 145, 320 185"
          stroke="url(#emailRingGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Floating Top-Left Card: 3D ₹ Receipt */}
        <g transform="translate(64, 100)" filter="url(#envShadow)">
          <rect x="0" y="0" width="46" height="52" rx="12" fill="#FFFFFF" />
          <text x="10" y="22" fontSize="15" fontWeight="800" fill="#6366F1">
            ₹
          </text>
          <rect x="10" y="28" width="26" height="2.5" rx="1.2" fill="#CBD5E1" />
          <rect x="10" y="34" width="20" height="2.5" rx="1.2" fill="#CBD5E1" />
          <rect x="10" y="40" width="14" height="2.5" rx="1.2" fill="#CBD5E1" />
        </g>

        {/* Floating Top-Right Card: 3D Mini Calendar */}
        <g transform="translate(268, 85)" filter="url(#envShadow)">
          <rect x="0" y="0" width="48" height="48" rx="14" fill="#FFFFFF" />
          <rect x="8" y="10" width="32" height="28" rx="6" fill="#8B5CF6" />
          <rect x="8" y="10" width="32" height="9" rx="3" fill="#7C3AED" />
          <circle cx="15" cy="25" r="1.8" fill="#EDE9FE" />
          <circle cx="24" cy="25" r="1.8" fill="#EDE9FE" />
          <circle cx="33" cy="25" r="1.8" fill="#EDE9FE" />
          <circle cx="15" cy="32" r="1.8" fill="#EDE9FE" />
          <circle cx="24" cy="32" r="1.8" fill="#EDE9FE" />
        </g>

        {/* MAIN 3D OPEN ENVELOPE */}
        <g transform="translate(100, 80)" filter="url(#envShadow)">
          {/* Back flap */}
          <path d="M 20 70 L 90 20 L 160 70 Z" fill="#6D28D9" />

          {/* Letter coming out */}
          <g transform="translate(25, 12)">
            <rect
              x="0"
              y="0"
              width="130"
              height="90"
              rx="12"
              fill="#FFFFFF"
              stroke="#EDE9FE"
              strokeWidth="1.5"
            />
            {/* Big 3D @ Symbol */}
            <circle cx="65" cy="45" r="24" fill="#EEF2FF" />
            <text x="65" y="55" textAnchor="middle" fontSize="30" fontWeight="900" fill="#6366F1">
              @
            </text>
          </g>

          {/* Front Envelope Pocket */}
          <path
            d="M 15 65 L 90 115 L 165 65 L 165 140 C 165 148, 158 155, 150 155 L 30 155 C 22 155, 15 148, 15 140 Z"
            fill="url(#envBodyGrad)"
          />
          {/* Front triangular folds */}
          <path d="M 15 155 L 90 100 L 165 155 Z" fill="#7C3AED" opacity="0.6" />
          <path
            d="M 15 65 L 90 115 L 165 65"
            stroke="#A78BFA"
            strokeWidth="1.5"
            fill="none"
            opacity="0.5"
          />
        </g>

        {/* Floating 3D Security Shield in front-right */}
        <g transform="translate(230, 160)" filter="url(#envShadow)">
          <path
            d="M 28 6 C 38 6, 50 10, 56 16 C 56 36, 46 54, 28 64 C 10 54, 0 36, 0 16 C 6 10, 18 6, 28 6 Z"
            fill="url(#shieldGrad2)"
          />
          <path
            d="M 28 10 C 36 10, 46 14, 51 19 C 51 35, 43 49, 28 58 C 13 49, 5 35, 5 19 C 10 14, 20 10, 28 10 Z"
            stroke="#EDE9FE"
            strokeWidth="1.5"
            fill="none"
            opacity="0.8"
          />
          {/* Checkmark inside shield */}
          <path
            d="M 19 32 L 25 38 L 38 25"
            stroke="#FFFFFF"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>

        {/* Orbital Ring (Front portion) */}
        <path
          d="M 320 185 C 320 225, 60 225, 60 185"
          stroke="url(#emailRingGrad)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Screen 3: 3D Purple Security Shield with Embossed Padlock,
 * Floating envelope, password asterisk card, glowing orbital ring & rays.
 */
export function OTPIllustration() {
  return (
    <div className="auth-illustration-container relative w-full flex items-center justify-center py-1 sm:py-2.5 my-0.5">
      <svg
        viewBox="0 0 380 300"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full max-w-[240px] xs:max-w-[270px] sm:max-w-[310px] max-h-[160px] xs:max-h-[180px] sm:max-h-[210px] h-auto object-contain transition-all duration-200 drop-shadow-[0_16px_32px_rgba(109,40,217,0.18)]"
        aria-hidden="true"
      >
        <defs>
          <linearGradient
            id="otpRingGrad"
            x1="40"
            y1="195"
            x2="340"
            y2="195"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#C084FC" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#E9D5FF" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#818CF8" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient
            id="shieldMainGrad"
            x1="120"
            y1="60"
            x2="260"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#A78BFA" />
            <stop offset="50%" stopColor="#8B5CF6" />
            <stop offset="100%" stopColor="#6D28D9" />
          </linearGradient>
          <linearGradient
            id="shieldRim"
            x1="120"
            y1="60"
            x2="260"
            y2="240"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#DDD6FE" />
            <stop offset="100%" stopColor="#7C3AED" />
          </linearGradient>
          <radialGradient id="otpGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#DDD6FE" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#EDE9FE" stopOpacity="0" />
          </radialGradient>
          <filter id="shieldFullShadow" x="-25%" y="-20%" width="150%" height="145%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="14"
              floodColor="#5B21B6"
              floodOpacity="0.25"
            />
          </filter>
        </defs>

        {/* Ambient background bloom */}
        <ellipse cx="190" cy="180" rx="140" ry="70" fill="url(#otpGlow)" />

        {/* Orbital Ring (Back portion) */}
        <path
          d="M 60 190 C 60 150, 320 150, 320 190"
          stroke="url(#otpRingGrad)"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* Sparkles / Rays at top-left and top-right */}
        <g stroke="#F97316" strokeWidth="2.5" strokeLinecap="round">
          <path d="M 80 80 L 72 74" />
          <path d="M 84 70 L 80 62" />
          <path d="M 94 66 L 96 58" />

          <path d="M 295 72 L 303 66" />
          <path d="M 288 64 L 292 56" />
          <path d="M 278 62 L 277 54" />
        </g>

        {/* Floating Left: Mini White Envelope */}
        <g transform="translate(62, 110)" filter="url(#shieldFullShadow)">
          <rect x="0" y="0" width="56" height="38" rx="8" fill="#FFFFFF" />
          <path
            d="M 4 4 L 28 20 L 52 4"
            stroke="#C4B5FD"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        {/* Floating Right: Password Dots/Asterisks Card */}
        <g transform="translate(258, 122)" filter="url(#shieldFullShadow)">
          <rect x="0" y="0" width="68" height="36" rx="10" fill="#FFFFFF" />
          <g fill="#7C3AED" transform="translate(11, 14)">
            <circle cx="4" cy="4" r="3" />
            <circle cx="15" cy="4" r="3" />
            <circle cx="26" cy="4" r="3" />
            <circle cx="37" cy="4" r="3" />
            <circle cx="48" cy="4" r="3" />
          </g>
        </g>

        {/* MAIN 3D SECURITY SHIELD WITH LOCK */}
        <g transform="translate(125, 45)" filter="url(#shieldFullShadow)">
          {/* Shield Outer Rim */}
          <path
            d="M 65 10 C 90 10, 120 22, 130 36 C 130 85, 105 130, 65 152 C 25 130, 0 85, 0 36 C 10 22, 40 10, 65 10 Z"
            fill="url(#shieldRim)"
          />
          {/* Shield Inner Surface */}
          <path
            d="M 65 18 C 86 18, 112 28, 121 40 C 121 82, 98 121, 65 140 C 32 121, 9 82, 9 40 C 18 28, 44 18, 65 18 Z"
            fill="url(#shieldMainGrad)"
          />
          {/* Glossy inner bevel */}
          <path
            d="M 65 24 C 83 24, 105 32, 113 43 C 113 78, 92 112, 65 128 C 38 112, 17 78, 17 43 C 25 32, 47 24, 65 24 Z"
            stroke="#EDE9FE"
            strokeWidth="1.2"
            fill="none"
            opacity="0.5"
          />

          {/* 3D Glossy White Padlock in Center */}
          <g transform="translate(47, 56)">
            {/* Shackle */}
            <path
              d="M 9 16 L 9 9 C 9 3, 27 3, 27 9 L 27 16"
              stroke="#FFFFFF"
              strokeWidth="5"
              strokeLinecap="round"
              fill="none"
            />
            {/* Padlock Body */}
            <rect x="0" y="14" width="36" height="28" rx="8" fill="#FFFFFF" />
            {/* Keyhole */}
            <circle cx="18" cy="25" r="3.5" fill="#7C3AED" />
            <path d="M 16.5 26 L 19.5 26 L 19 32 L 17 32 Z" fill="#7C3AED" />
          </g>
        </g>

        {/* Orbital Ring (Front portion) */}
        <path
          d="M 320 190 C 320 230, 60 230, 60 190"
          stroke="url(#otpRingGrad)"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

/**
 * Bottom organic lavender wave decoration matching the reference designs.
 */
function BottomWaves() {
  return (
    <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden z-0 leading-none">
      <svg
        viewBox="0 0 1440 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto min-h-[90px] max-h-[140px] object-cover"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0,96 C240,160 480,40 720,110 C960,180 1200,80 1440,128 L1440,220 L0,220 Z"
          fill="#DDD6FE"
          fillOpacity="0.45"
        />
        <path
          d="M0,130 C320,80 640,170 960,110 C1200,70 1360,140 1440,150 L1440,220 L0,220 Z"
          fill="#C4B5FD"
          fillOpacity="0.35"
        />
        <path
          d="M0,160 C360,120 720,200 1080,150 C1260,125 1380,175 1440,180 L1440,220 L0,220 Z"
          fill="#A78BFA"
          fillOpacity="0.2"
        />
      </svg>
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
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      setOtp((prev) => prev.map((d, i) => (i === index ? "" : d)));
      return;
    }
    if (cleaned.length > 1) {
      const next = [...otp];
      for (let i = 0; i < cleaned.length && index + i < 6; i++) {
        next[index + i] = cleaned[i] ?? "";
      }
      setOtp(next);
      const targetIdx = Math.min(index + cleaned.length, 5);
      otpRefs.current[targetIdx]?.focus();
      if (next.every((d) => d !== "") && next.join("").length === 6) {
        void verifyOTP(next.join(""));
      }
      return;
    }
    const digit = cleaned.slice(-1);
    const next = otp.map((d, i) => (i === index ? digit : d));
    setOtp(next);
    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    if (digit && index === 5) {
      const full = next.join("");
      if (full.length === 6) void verifyOTP(full);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otp[index] && index > 0) {
        e.preventDefault();
        const next = [...otp];
        next[index - 1] = "";
        setOtp(next);
        otpRefs.current[index - 1]?.focus();
      } else {
        setOtp((prev) => prev.map((d, i) => (i === index ? "" : d)));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const raw = e.clipboardData.getData("text").trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 6) {
      e.preventDefault();
      const code6 = digits.slice(0, 6).split("");
      setOtp(code6);
      otpRefs.current[5]?.focus();
      setTimeout(() => void verifyOTP(code6.join("")), 100);
    }
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
    setTimeout(() => {
      e.target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 280);
  };

  return (
    <div className="auth-root relative flex flex-col items-center justify-between min-h-[100dvh] bg-[#FAF8FE] dark:bg-slate-950 overflow-hidden">
      {/* Background ambient glows */}
      <div className="auth-bg-glow auth-bg-glow-1" />
      <div className="auth-bg-glow auth-bg-glow-2" />
      <div className="auth-bg-glow auth-bg-glow-3" />

      {/* Main card content container */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full max-w-[420px] mx-auto my-auto px-4 py-2 sm:py-5 flex-1">
        <div className="w-full">
          {/* ============================================================ */}
          {/* SCREEN 1: WELCOME / GET STARTED                              */}
          {/* ============================================================ */}
          {step === "welcome" && (
            <div className="animate-fade-in flex flex-col items-center w-full">
              {/* Top: Centered BillBuddy & Eesub Labs branding */}
              <div className="flex flex-col items-center justify-center mb-2 sm:mb-3">
                <img
                  src="/billbuddy-logo.png"
                  alt="Bill Buddy build by Eesub labs"
                  className="h-10 sm:h-12 w-auto object-contain"
                />
              </div>

              {/* Heading matching reference design */}
              <h1 className="text-center text-[26px] xs:text-[28px] sm:text-[32px] font-extrabold leading-[1.14] tracking-tight text-slate-900 dark:text-white">
                Manage Your
                <br />
                Bills & <span className="text-[#F97316]">Spends</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-1.5 sm:mt-2 text-center text-xs sm:text-[13px] leading-relaxed text-slate-600 dark:text-slate-300 max-w-[320px]">
                Track bills, record spends, set budgets
                <br />
                and never miss a payment.
              </p>

              {/* Hero 3D Illustration */}
              <WalletIllustration />

              {/* Three Feature Cards */}
              <div className="mt-2 sm:mt-3 grid grid-cols-3 gap-2.5 sm:gap-3 w-full max-w-[340px]">
                {/* Feature 1: Track Bills */}
                <div className="flex flex-col items-center text-center p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-purple-100/80 dark:border-slate-800 shadow-[0_4px_12px_rgba(109,40,217,0.06)]">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-purple-100/80 dark:bg-purple-950/60 text-purple-600 mb-1.5">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <rect x="3" y="4" width="18" height="18" rx="4" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                      <circle cx="8" cy="15" r="1" fill="currentColor" />
                      <circle cx="12" cy="15" r="1" fill="currentColor" />
                      <circle cx="16" cy="15" r="1" fill="currentColor" />
                    </svg>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    Track
                    <br />
                    Bills
                  </span>
                </div>

                {/* Feature 2: Auto Spends */}
                <div className="flex flex-col items-center text-center p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-purple-100/80 dark:border-slate-800 shadow-[0_4px_12px_rgba(109,40,217,0.06)]">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-600 mb-1.5">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <rect x="2" y="6" width="20" height="14" rx="4" />
                      <path d="M2 10h20" />
                      <circle cx="16" cy="14" r="1.5" fill="currentColor" />
                    </svg>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    Auto
                    <br />
                    Spends
                  </span>
                </div>

                {/* Feature 3: Budgets & Insights */}
                <div className="flex flex-col items-center text-center p-2 sm:p-2.5 rounded-2xl bg-white/90 dark:bg-slate-900/90 border border-purple-100/80 dark:border-slate-800 shadow-[0_4px_12px_rgba(109,40,217,0.06)]">
                  <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-amber-100/80 dark:bg-amber-950/60 text-amber-500 mb-1.5">
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    >
                      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                      <path d="M22 12A10 10 0 0 0 12 2v10z" fill="currentColor" fillOpacity="0.4" />
                    </svg>
                  </div>
                  <span className="text-[11px] sm:text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    Budgets &<br />
                    Insights
                  </span>
                </div>
              </div>

              {/* Carousel Indicator Dots */}
              <div
                className="mt-3 sm:mt-4 flex items-center justify-center gap-1.5"
                aria-hidden="true"
              >
                <span className="h-2 w-2 rounded-full bg-[#7C3AED]" />
                <span className="h-2 w-2 rounded-full bg-purple-200 dark:bg-slate-700" />
                <span className="h-2 w-2 rounded-full bg-purple-200 dark:bg-slate-700" />
              </div>

              {/* Actions */}
              <div className="mt-3.5 sm:mt-4 w-full space-y-2">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="auth-btn-gradient w-full min-h-[50px] sm:min-h-[54px] text-sm sm:text-base font-bold shadow-lg shadow-purple-600/25 cursor-pointer rounded-full"
                >
                  <span>Get Started</span>
                  <ArrowRight className="h-4.5 w-4.5" />
                </button>

                <p className="text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400 pt-1">
                  Already have an account?{" "}
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="font-bold text-[#6D28D9] dark:text-purple-400 hover:text-purple-700 underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 2: ENTER EMAIL                                        */}
          {/* ============================================================ */}
          {step === "email" && (
            <div className="animate-fade-in flex flex-col items-center w-full">
              {/* Top bar: Circular back button on left, centered BillBuddy branding */}
              <div className="relative flex w-full items-center justify-center mb-1.5 sm:mb-2">
                <button
                  type="button"
                  onClick={() => setStep("welcome")}
                  className="absolute left-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
                  aria-label="Back to welcome"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <img
                  src="/billbuddy-logo.png"
                  alt="Bill Buddy build by Eesub labs"
                  className="h-9 sm:h-11 w-auto object-contain mx-auto"
                />

                {/* Hidden step indicator for screen readers and unit tests */}
                <span className="sr-only">Step 1 of 2</span>
              </div>

              {/* Hero 3D Email Illustration */}
              <EmailIllustration />

              {/* Heading */}
              <h2 className="mt-2 text-center text-2xl xs:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Enter Your <span className="text-[#7C3AED]">Email</span>
              </h2>

              {/* Subtext */}
              <p className="mt-1 text-center text-xs xs:text-sm leading-relaxed text-slate-600 dark:text-slate-300 max-w-[310px]">
                We'll send a 6-digit verification code to your inbox to sign you in securely.
              </p>

              {/* Form */}
              <form onSubmit={sendOTP} className="mt-4 w-full space-y-3.5">
                <div>
                  <label
                    htmlFor="email"
                    className="mb-1.5 block text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-purple-600 dark:text-purple-400" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={handleInputFocus}
                      placeholder="name@example.com"
                      disabled={loading}
                      className="auth-input pl-12 pr-4 text-sm sm:text-base min-h-[50px] sm:min-h-[54px] rounded-2xl border-2 border-purple-400/80 focus:border-purple-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      autoFocus
                    />
                  </div>
                </div>

                {error && (
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 p-2.5 sm:p-3 text-xs sm:text-sm text-rose-700 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !isValidEmail(email)}
                  className="auth-btn-gradient w-full min-h-[50px] sm:min-h-[54px] text-sm sm:text-base font-bold shadow-lg shadow-purple-600/25 cursor-pointer rounded-full"
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

              {/* Passwordless note */}
              <div className="mt-4 flex items-center justify-center gap-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-semibold">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Passwordless OTP · No password required</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* SCREEN 3: ENTER OTP                                          */}
          {/* ============================================================ */}
          {step === "otp" && (
            <div className="animate-fade-in flex flex-col items-center w-full">
              {/* Top bar: Circular back button on left, centered BillBuddy branding */}
              <div className="relative flex w-full items-center justify-center mb-1.5 sm:mb-2">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="absolute left-0 flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer active:scale-95"
                  aria-label="Back to email"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <img
                  src="/billbuddy-logo.png"
                  alt="Bill Buddy build by Eesub labs"
                  className="h-9 sm:h-11 w-auto object-contain mx-auto"
                />

                {/* Hidden step indicator for screen readers and unit tests */}
                <span className="sr-only">Step 2 of 2</span>
              </div>

              {/* Hero 3D OTP Shield Illustration */}
              <OTPIllustration />

              {/* Heading */}
              <h2 className="mt-2 text-center text-2xl xs:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                Enter <span className="text-[#7C3AED]">OTP</span>
              </h2>

              {/* Subtext */}
              <p className="mt-1 text-center text-xs xs:text-sm text-slate-600 dark:text-slate-300">
                We've sent a 6-digit code to
              </p>

              {/* Recipient email pill */}
              <div className="mt-1.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/60 border border-purple-200/80 dark:border-purple-800 text-xs sm:text-sm font-bold text-slate-900 dark:text-purple-100">
                <Mail className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                <span>{email}</span>
              </div>

              {/* OTP Form */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verifyOTP();
                }}
                className="mt-3.5 sm:mt-4 w-full space-y-3"
              >
                {/* 6-digit input boxes */}
                <div className="flex justify-center gap-2 sm:gap-2.5" onPaste={handlePaste}>
                  {otp.map((digit, index) => {
                    const isFilled = digit !== "";
                    return (
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
                        className={`auth-otp-input transition-all ${
                          isFilled
                            ? "border-2 border-purple-600 bg-purple-50/40 text-purple-950 font-extrabold shadow-sm"
                            : "border-1.5 border-purple-200/90 bg-white"
                        }`}
                        aria-label={`Digit ${index + 1}`}
                      />
                    );
                  })}
                </div>

                {/* Verification code status banner matching reference */}
                <div className="pt-0.5">
                  {error ? (
                    <div className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-rose-50 border border-rose-200 text-xs sm:text-sm font-semibold text-rose-700">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                      <span>{error}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-emerald-50 border border-emerald-200 text-xs sm:text-sm font-semibold text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{success || "Verification code sent! Check your inbox."}</span>
                    </div>
                  )}
                </div>

                {/* Verify & Continue Button */}
                <button
                  type="submit"
                  disabled={loading || otp.join("").length !== 6}
                  className="auth-btn-gradient w-full min-h-[50px] sm:min-h-[54px] text-sm sm:text-base font-bold shadow-lg shadow-purple-600/25 cursor-pointer rounded-full"
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

                {/* Resend OTP countdown */}
                <p className="text-center text-xs sm:text-sm text-slate-600 dark:text-slate-400 pt-0.5">
                  {resendCooldown > 0 ? (
                    <>
                      Resend OTP in <span className="font-extrabold text-[#7C3AED]">{mmss}</span>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void handleResendOTP()}
                      disabled={loading}
                      className="font-bold text-[#7C3AED] hover:underline cursor-pointer disabled:text-slate-400"
                    >
                      Didn't receive code? Resend OTP
                    </button>
                  )}
                </p>

                {/* Change email address pill button */}
                <button
                  type="button"
                  onClick={() => {
                    setStep("email");
                    setOtp(["", "", "", "", "", ""]);
                    setError("");
                    setSuccess("");
                  }}
                  className="flex w-full items-center justify-between rounded-2xl bg-white dark:bg-slate-900 border border-purple-100 dark:border-slate-800 px-4 py-3 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 hover:border-purple-300 transition-all cursor-pointer shadow-[0_2px_8px_rgba(109,40,217,0.05)] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5">
                    <Edit3 className="h-4 w-4 text-[#7C3AED]" />
                    <span>Change email address</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Bottom organic wavy lavender gradient decoration */}
      <BottomWaves />
    </div>
  );
}

export default LoginPage;
