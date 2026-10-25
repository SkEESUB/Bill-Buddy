import React from "react";
import { Check } from "lucide-react";

export interface PresetAvatar {
  id: string;
  name: string;
  svg: (size?: number) => React.ReactElement;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: "avatar:cosmic-indigo",
    name: "Cosmic Indigo",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <defs>
          <linearGradient id="cosmicBg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="50%" stopColor="#312E81" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient id="cosmicRing" x1="0" y1="20" x2="40" y2="20" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818CF8" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#C084FC" stopOpacity="0.8" />
          </linearGradient>
          <radialGradient id="cosmicGlow" cx="20" cy="20" r="16" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#312E81" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#cosmicBg)" />
        <circle cx="20" cy="20" r="15" fill="url(#cosmicGlow)" />
        {/* Planet ring */}
        <ellipse cx="20" cy="20" rx="17" ry="6" stroke="url(#cosmicRing)" strokeWidth="2" transform="rotate(-25 20 20)" />
        {/* Planet sphere */}
        <circle cx="20" cy="20" r="9" fill="#4F46E5" />
        <circle cx="17" cy="17" r="4" fill="#818CF8" opacity="0.6" />
        {/* Stars */}
        <circle cx="10" cy="11" r="1" fill="#FFFFFF" opacity="0.9" />
        <circle cx="31" cy="29" r="1.2" fill="#E0E7FF" opacity="0.8" />
        <circle cx="29" cy="9" r="0.8" fill="#FFFFFF" opacity="0.7" />
      </svg>
    ),
  },
  {
    id: "avatar:violet-prism",
    name: "Violet Prism",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <defs>
          <linearGradient id="prismBg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#581C87" />
            <stop offset="60%" stopColor="#7E22CE" />
            <stop offset="100%" stopColor="#9333EA" />
          </linearGradient>
          <linearGradient id="facet1" x1="20" y1="7" x2="10" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#DDD6FE" />
            <stop offset="100%" stopColor="#A855F7" />
          </linearGradient>
          <linearGradient id="facet2" x1="20" y1="7" x2="30" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C084FC" />
            <stop offset="100%" stopColor="#7E22CE" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#prismBg)" />
        {/* Diamond gem */}
        <polygon points="20,7 29,15 20,33 11,15" fill="#6B21A8" opacity="0.7" />
        <polygon points="20,7 11,15 20,24" fill="url(#facet1)" />
        <polygon points="20,7 29,15 20,24" fill="url(#facet2)" />
        <polygon points="11,15 20,33 20,24" fill="#9333EA" />
        <polygon points="29,15 20,33 20,24" fill="#7E22CE" />
        {/* Specular sparkle */}
        <polygon points="20,11 21.5,13.5 24,14 21.5,14.5 20,17 18.5,14.5 16,14 18.5,13.5" fill="#FFFFFF" opacity="0.9" />
      </svg>
    ),
  },
  {
    id: "avatar:azure-wave",
    name: "Azure Wave",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <defs>
          <linearGradient id="azureBg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0369A1" />
            <stop offset="50%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#38BDF8" />
          </linearGradient>
          <linearGradient id="waveLight" x1="0" y1="20" x2="40" y2="30" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#azureBg)" />
        {/* Flowing layered waves */}
        <path d="M0 24 C10 18, 16 30, 26 22 C32 16, 36 21, 40 19 L40 40 L0 40 Z" fill="#0C4A6E" opacity="0.6" />
        <path d="M0 27 C8 23, 14 31, 24 25 C32 20, 36 26, 40 23 L40 40 L0 40 Z" fill="#0284C7" />
        <path d="M0 32 C12 28, 20 34, 40 29 L40 40 L0 40 Z" fill="url(#waveLight)" opacity="0.85" />
        {/* Crescent highlight */}
        <circle cx="28" cy="12" r="5" fill="#BAE6FD" opacity="0.8" />
      </svg>
    ),
  },
  {
    id: "avatar:aurora-pastel",
    name: "Aurora Pastel",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <defs>
          <linearGradient id="auroraBg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#C4B5FD" />
            <stop offset="50%" stopColor="#A5B4FC" />
            <stop offset="100%" stopColor="#93C5FD" />
          </linearGradient>
          <radialGradient id="auroraGlow1" cx="12" cy="14" r="14" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#FBCFE8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#FBCFE8" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="auroraGlow2" cx="28" cy="26" r="15" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#auroraBg)" />
        <circle cx="12" cy="14" r="14" fill="url(#auroraGlow1)" />
        <circle cx="28" cy="26" r="15" fill="url(#auroraGlow2)" />
        {/* Soft pastel aura rings */}
        <circle cx="20" cy="20" r="11" stroke="#FFFFFF" strokeWidth="1.5" opacity="0.6" strokeDasharray="2 3" />
        <circle cx="20" cy="20" r="6" fill="#FFFFFF" opacity="0.85" />
      </svg>
    ),
  },
  {
    id: "avatar:cyber-shield",
    name: "Cyber Shield",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <defs>
          <linearGradient id="shieldBg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="50%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient id="shieldGrad" x1="20" y1="7" x2="20" y2="33" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#shieldBg)" />
        {/* Shield contour */}
        <path
          d="M20 8 C25 8, 30 11, 30 16 C30 25, 24 30, 20 33 C16 30, 10 25, 10 16 C10 11, 15 8, 20 8Z"
          fill="url(#shieldGrad)"
          opacity="0.25"
        />
        <path
          d="M20 8 C25 8, 30 11, 30 16 C30 25, 24 30, 20 33 C16 30, 10 25, 10 16 C10 11, 15 8, 20 8Z"
          stroke="url(#shieldGrad)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* Inner circuit node */}
        <circle cx="20" cy="19" r="4" fill="#38BDF8" />
        <circle cx="20" cy="19" r="2" fill="#FFFFFF" />
        <line x1="20" y1="12" x2="20" y2="15" stroke="#38BDF8" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="20" y1="23" x2="20" y2="28" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "avatar:zen-blossom",
    name: "Zen Blossom",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <defs>
          <linearGradient id="zenBg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#EEF2FF" />
            <stop offset="50%" stopColor="#E0E7FF" />
            <stop offset="100%" stopColor="#F5F3FF" />
          </linearGradient>
          <linearGradient id="petalGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#zenBg)" />
        {/* Radial geometric lotus petals */}
        <g transform="translate(20, 20)">
          <ellipse cx="0" cy="-7" rx="3.5" ry="6" fill="url(#petalGrad)" opacity="0.85" />
          <ellipse cx="0" cy="7" rx="3.5" ry="6" fill="url(#petalGrad)" opacity="0.85" />
          <ellipse cx="-7" cy="0" rx="6" ry="3.5" fill="url(#petalGrad)" opacity="0.85" />
          <ellipse cx="7" cy="0" rx="6" ry="3.5" fill="url(#petalGrad)" opacity="0.85" />
          <ellipse cx="-5" cy="-5" rx="3.5" ry="5.5" transform="rotate(-45 -5 -5)" fill="url(#petalGrad)" opacity="0.65" />
          <ellipse cx="5" cy="-5" rx="3.5" ry="5.5" transform="rotate(45 5 -5)" fill="url(#petalGrad)" opacity="0.65" />
          <ellipse cx="-5" cy="5" rx="3.5" ry="5.5" transform="rotate(45 -5 5)" fill="url(#petalGrad)" opacity="0.65" />
          <ellipse cx="5" cy="5" rx="3.5" ry="5.5" transform="rotate(-45 5 5)" fill="url(#petalGrad)" opacity="0.65" />
          <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
          <circle cx="0" cy="0" r="2" fill="#4F46E5" />
        </g>
      </svg>
    ),
  },
];

/** Lookup preset avatar by id */
export function getPresetAvatar(avatarId: string | null | undefined): PresetAvatar | null {
  if (!avatarId) return null;
  return PRESET_AVATARS.find((a) => a.id === avatarId) ?? null;
}

/**
 * Avatar Selector Grid Component
 * Compact, tactile grid of premium illustrated avatars for the User Menu.
 */
export function AvatarPicker({
  selectedId,
  onSelect,
  disabled = false,
}: {
  selectedId: string | null | undefined;
  onSelect: (avatarId: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1">
      {PRESET_AVATARS.map((avatar) => {
        const isSelected = selectedId === avatar.id;
        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onSelect(avatar.id)}
            disabled={disabled}
            className={`group relative flex flex-col items-center justify-center p-1.5 rounded-xl border transition-all cursor-pointer ${
              isSelected
                ? "border-blue-600 bg-blue-50/70 shadow-sm ring-2 ring-blue-500/30"
                : "border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/60"
            }`}
            title={avatar.name}
            aria-label={`Select ${avatar.name} avatar`}
            aria-pressed={isSelected}
          >
            <div className="relative">
              {avatar.svg(38)}
              {isSelected && (
                <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm ring-1 ring-white">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              )}
            </div>
            <span className="mt-1 text-[10px] font-semibold text-slate-700 truncate max-w-full leading-tight">
              {avatar.name.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
