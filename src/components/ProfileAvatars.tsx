import React from "react";
import { Check } from "lucide-react";

export interface PresetAvatar {
  id: string;
  name: string;
  svg: (size?: number) => React.ReactElement;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  // ===================================================================
  // 12 Premium Cartoon Character Avatars (Phase 4)
  // ===================================================================
  {
    id: "avatar:cartoon-fox",
    name: "Cute Fox",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#FFF7ED" />
        {/* Outer Ears */}
        <polygon points="10,18 13,6 21,14" fill="#EA580C" />
        <polygon points="30,18 27,6 19,14" fill="#EA580C" />
        {/* Inner Ears */}
        <polygon points="12,16 14,9 19,14" fill="#FFEDD5" />
        <polygon points="28,16 26,9 21,14" fill="#FFEDD5" />
        {/* Head */}
        <path d="M11 18 C11 13 29 13 29 18 C33 22 32 30 20 33 C8 30 7 22 11 18 Z" fill="#F97316" />
        {/* White Cheek Fluff */}
        <path
          d="M11 20 C14 21 16 26 20 28 C24 26 26 21 29 20 C32 26 26 33 20 33 C14 33 8 26 11 20 Z"
          fill="#FFFFFF"
        />
        {/* Cheeks blush */}
        <circle cx="14" cy="24" r="2" fill="#FCA5A5" opacity="0.8" />
        <circle cx="26" cy="24" r="2" fill="#FCA5A5" opacity="0.8" />
        {/* Eyes */}
        <circle cx="16" cy="20" r="2" fill="#1E293B" />
        <circle cx="15.4" cy="19.4" r="0.7" fill="#FFFFFF" />
        <circle cx="24" cy="20" r="2" fill="#1E293B" />
        <circle cx="23.4" cy="19.4" r="0.7" fill="#FFFFFF" />
        {/* Nose */}
        <ellipse cx="20" cy="24.5" rx="2" ry="1.4" fill="#0F172A" />
        {/* Mouth */}
        <path
          d="M19 26 Q20 27.5 21 26"
          stroke="#0F172A"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "avatar:cartoon-cat",
    name: "Kitty Cat",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#EEF2FF" />
        {/* Cat Ears */}
        <polygon points="9,18 12,7 20,13" fill="#818CF8" />
        <polygon points="31,18 28,7 20,13" fill="#818CF8" />
        <polygon points="11,16 13,9 18,13" fill="#F472B6" />
        <polygon points="29,16 27,9 22,13" fill="#F472B6" />
        {/* Head */}
        <circle cx="20" cy="22" r="12" fill="#A5B4FC" />
        {/* Eyes */}
        <ellipse cx="15.5" cy="21" rx="2.5" ry="3" fill="#1E1B4B" />
        <circle cx="15" cy="20" r="1" fill="#FFFFFF" />
        <circle cx="16.5" cy="22.5" r="0.5" fill="#FFFFFF" />
        <ellipse cx="24.5" cy="21" rx="2.5" ry="3" fill="#1E1B4B" />
        <circle cx="24" cy="20" r="1" fill="#FFFFFF" />
        <circle cx="25.5" cy="22.5" r="0.5" fill="#FFFFFF" />
        {/* Nose & Mouth */}
        <polygon points="19,24.5 21,24.5 20,25.8" fill="#EC4899" />
        <path
          d="M18.5 26.5 Q20 28 20 26 Q20 28 21.5 26.5"
          stroke="#4338CA"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
        {/* Whiskers */}
        <line
          x1="8"
          y1="23"
          x2="13"
          y2="23.5"
          stroke="#6366F1"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="8"
          y1="26"
          x2="13"
          y2="25.5"
          stroke="#6366F1"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="23"
          x2="27"
          y2="23.5"
          stroke="#6366F1"
          strokeWidth="1"
          strokeLinecap="round"
        />
        <line
          x1="32"
          y1="26"
          x2="27"
          y2="25.5"
          stroke="#6366F1"
          strokeWidth="1"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "avatar:cartoon-panda",
    name: "Panda Bear",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#ECFDF5" />
        {/* Ears */}
        <circle cx="11" cy="12" r="5" fill="#1E293B" />
        <circle cx="29" cy="12" r="5" fill="#1E293B" />
        {/* Head */}
        <circle cx="20" cy="22" r="12.5" fill="#FFFFFF" />
        {/* Eye Patches */}
        <ellipse
          cx="14.5"
          cy="20.5"
          rx="3.5"
          ry="4"
          transform="rotate(-15 14.5 20.5)"
          fill="#1E293B"
        />
        <ellipse
          cx="25.5"
          cy="20.5"
          rx="3.5"
          ry="4"
          transform="rotate(15 25.5 20.5)"
          fill="#1E293B"
        />
        {/* Eyes */}
        <circle cx="14.5" cy="20.5" r="1.5" fill="#FFFFFF" />
        <circle cx="15" cy="20" r="0.8" fill="#1E293B" />
        <circle cx="25.5" cy="20.5" r="1.5" fill="#FFFFFF" />
        <circle cx="25" cy="20" r="0.8" fill="#1E293B" />
        {/* Nose */}
        <ellipse cx="20" cy="24.5" rx="2" ry="1.3" fill="#1E293B" />
        {/* Mouth */}
        <path
          d="M18.5 26.5 Q20 28 21.5 26.5"
          stroke="#1E293B"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Blush */}
        <circle cx="10.5" cy="24.5" r="2" fill="#FCA5A5" opacity="0.6" />
        <circle cx="29.5" cy="24.5" r="2" fill="#FCA5A5" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: "avatar:cartoon-dog",
    name: "Happy Pup",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#FEF3C7" />
        {/* Floppy Ears */}
        <ellipse cx="9" cy="20" rx="4" ry="8" transform="rotate(-10 9 20)" fill="#B45309" />
        <ellipse cx="31" cy="20" rx="4" ry="8" transform="rotate(10 31 20)" fill="#B45309" />
        {/* Head */}
        <circle cx="20" cy="20" r="12" fill="#F59E0B" />
        {/* White Muzzle */}
        <ellipse cx="20" cy="24" rx="6.5" ry="4.5" fill="#FFFBEB" />
        {/* Eyes */}
        <circle cx="15" cy="18" r="2" fill="#1E293B" />
        <circle cx="14.3" cy="17.3" r="0.7" fill="#FFFFFF" />
        <circle cx="25" cy="18" r="2" fill="#1E293B" />
        <circle cx="24.3" cy="17.3" r="0.7" fill="#FFFFFF" />
        {/* Button Nose */}
        <ellipse cx="20" cy="22" rx="2.4" ry="1.6" fill="#1E293B" />
        {/* Tongue */}
        <path d="M19.5 25 Q20 28 21.5 27.5 Q22.5 25.5 21 24.5 Z" fill="#FB7185" />
        {/* Mouth */}
        <path
          d="M17.5 23.5 Q20 25.5 22.5 23.5"
          stroke="#1E293B"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "avatar:cartoon-astronaut",
    name: "Astro Buddy",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#0F172A" />
        {/* Stars */}
        <circle cx="7" cy="10" r="0.8" fill="#FFFFFF" opacity="0.8" />
        <circle cx="33" cy="12" r="1" fill="#FDE047" opacity="0.9" />
        <circle cx="31" cy="30" r="0.7" fill="#FFFFFF" opacity="0.7" />
        <circle cx="9" cy="28" r="0.6" fill="#FFFFFF" opacity="0.8" />
        {/* Helmet Base & Antenna */}
        <line
          x1="20"
          y1="5"
          x2="20"
          y2="8"
          stroke="#E2E8F0"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="20" cy="5" r="2" fill="#EF4444" />
        {/* Helmet Shell */}
        <circle cx="20" cy="21" r="13" fill="#F8FAFC" />
        {/* Visor Outer */}
        <ellipse cx="20" cy="21" rx="9.5" ry="7.5" fill="#1E1B4B" />
        {/* Visor Gradient Screen */}
        <ellipse cx="20" cy="21" rx="8.5" ry="6.5" fill="#3B82F6" />
        {/* Visor Specular Reflection */}
        <path
          d="M14 17 Q20 15 25 18"
          stroke="#93C5FD"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="15" cy="22" r="1" fill="#FFFFFF" opacity="0.8" />
        <circle cx="24" cy="22" r="1" fill="#FFFFFF" opacity="0.8" />
      </svg>
    ),
  },
  {
    id: "avatar:cartoon-robot",
    name: "Beep Bot",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#E0F2FE" />
        {/* Antenna */}
        <line
          x1="20"
          y1="7"
          x2="20"
          y2="11"
          stroke="#0284C7"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="20" cy="6" r="2.5" fill="#FACC15" />
        {/* Side Ear Bolts */}
        <rect x="5.5" y="18" width="3" height="6" rx="1.5" fill="#0284C7" />
        <rect x="31.5" y="18" width="3" height="6" rx="1.5" fill="#0284C7" />
        {/* Robot Head */}
        <rect x="8" y="11" width="24" height="20" rx="6" fill="#38BDF8" />
        {/* Dark Visor Screen */}
        <rect x="11" y="14" width="18" height="12" rx="3" fill="#0F172A" />
        {/* Glowing Eyes */}
        <circle cx="15" cy="19" r="2.2" fill="#22D3EE" />
        <circle cx="14.3" cy="18.3" r="0.7" fill="#FFFFFF" />
        <circle cx="25" cy="19" r="2.2" fill="#22D3EE" />
        <circle cx="24.3" cy="18.3" r="0.7" fill="#FFFFFF" />
        {/* Digital Mouth */}
        <rect x="17" y="22.5" width="6" height="1.5" rx="0.75" fill="#4ADE80" />
      </svg>
    ),
  },
  {
    id: "avatar:nature-leaf",
    name: "Sprout Leaf",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#F0FDF4" />
        {/* Sprout Leaves on top */}
        <path d="M20 12 C18 6 12 7 13 11 C14 13 18 12 20 12 Z" fill="#22C55E" />
        <path d="M20 12 C22 5 28 6 27 10 C26 13 22 12 20 12 Z" fill="#4ADE80" />
        {/* Main Body */}
        <circle cx="20" cy="23" r="11" fill="#86EFAC" />
        {/* Eyes (Cute anime smiling arcs) */}
        <path
          d="M14 21 Q16 19 18 21"
          stroke="#14532D"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M22 21 Q24 19 26 21"
          stroke="#14532D"
          strokeWidth="1.8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Pink Rosy Cheeks */}
        <circle cx="14" cy="24.5" r="2.2" fill="#F87171" opacity="0.6" />
        <circle cx="26" cy="24.5" r="2.2" fill="#F87171" opacity="0.6" />
        {/* Little mouth */}
        <path
          d="M19 25.5 Q20 27.5 21 25.5"
          stroke="#14532D"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "avatar:mountain-explorer",
    name: "Explorer",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#FEF9C3" />
        {/* Bear ears */}
        <circle cx="11" cy="14" r="3.5" fill="#92400E" />
        <circle cx="29" cy="14" r="3.5" fill="#92400E" />
        {/* Explorer Hat */}
        <path d="M10 16 Q20 11 30 16 Z" fill="#15803D" />
        <ellipse cx="20" cy="16" rx="12" ry="2.5" fill="#166534" />
        {/* Bear Head */}
        <circle cx="20" cy="23" r="10" fill="#B45309" />
        {/* Muzzle */}
        <ellipse cx="20" cy="26" rx="5" ry="3.5" fill="#FDE68A" />
        {/* Eyes */}
        <circle cx="16" cy="22" r="1.6" fill="#1E293B" />
        <circle cx="15.5" cy="21.5" r="0.6" fill="#FFFFFF" />
        <circle cx="24" cy="22" r="1.6" fill="#1E293B" />
        <circle cx="23.5" cy="21.5" r="0.6" fill="#FFFFFF" />
        {/* Nose */}
        <polygon points="18.5,24.5 21.5,24.5 20,26" fill="#1E293B" />
        {/* Smile */}
        <path
          d="M19 27.5 Q20 28.5 21 27.5"
          stroke="#1E293B"
          strokeWidth="1"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "avatar:ocean-wave",
    name: "Aqua Wave",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#E0F2FE" />
        {/* Droplet Crest */}
        <path d="M20 5 C17 10 23 10 20 5 Z" fill="#0284C7" />
        {/* Wave Head */}
        <circle cx="20" cy="21" r="12" fill="#06B6D4" />
        {/* Wave Splash Cheeks */}
        <path
          d="M8 21 C12 25 16 18 20 22 C24 18 28 25 32 21 C32 29 26 33 20 33 C14 33 8 29 8 21 Z"
          fill="#22D3EE"
          opacity="0.8"
        />
        {/* Eyes */}
        <circle cx="15" cy="19" r="2.2" fill="#083344" />
        <circle cx="14.3" cy="18.3" r="0.8" fill="#FFFFFF" />
        <circle cx="25" cy="19" r="2.2" fill="#083344" />
        <circle cx="24.3" cy="18.3" r="0.8" fill="#FFFFFF" />
        {/* Cheeks */}
        <circle cx="13" cy="23" r="2" fill="#67E8F9" />
        <circle cx="27" cy="23" r="2" fill="#67E8F9" />
        {/* Happy smile */}
        <path
          d="M18 23 Q20 26 22 23"
          stroke="#083344"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "avatar:sunflower",
    name: "Sunny Bloom",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#FFFBEB" />
        {/* Yellow Petals Ring */}
        <g transform="translate(20, 20)">
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <ellipse
              key={angle}
              cx="0"
              cy="-13"
              rx="3.5"
              ry="5"
              fill="#F59E0B"
              transform={`rotate(${angle})`}
            />
          ))}
        </g>
        {/* Flower Center Face */}
        <circle cx="20" cy="20" r="10.5" fill="#78350F" />
        {/* Eyes */}
        <circle cx="16" cy="19" r="1.8" fill="#FEF3C7" />
        <circle cx="16.5" cy="18.5" r="0.8" fill="#78350F" />
        <circle cx="24" cy="19" r="1.8" fill="#FEF3C7" />
        <circle cx="23.5" cy="18.5" r="0.8" fill="#78350F" />
        {/* Rosy Cheeks */}
        <circle cx="14" cy="22" r="1.8" fill="#F87171" opacity="0.8" />
        <circle cx="26" cy="22" r="1.8" fill="#F87171" opacity="0.8" />
        {/* Smile */}
        <path
          d="M18.5 22.5 Q20 24.5 21.5 22.5"
          stroke="#FEF3C7"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "avatar:cartoon-planet",
    name: "Cosmo Planet",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#1E1B4B" />
        {/* Little Background Stars */}
        <circle cx="8" cy="9" r="0.9" fill="#FDE047" />
        <circle cx="32" cy="11" r="0.8" fill="#FFFFFF" />
        <circle cx="10" cy="31" r="0.7" fill="#FFFFFF" />
        {/* Back of ring */}
        <ellipse
          cx="20"
          cy="20"
          rx="16"
          ry="5.5"
          stroke="#C084FC"
          strokeWidth="2.5"
          opacity="0.6"
          transform="rotate(-20 20 20)"
        />
        {/* Planet Sphere */}
        <circle cx="20" cy="20" r="11" fill="#818CF8" />
        {/* Front of ring */}
        <path
          d="M7 25 C12 29 28 23 33 15"
          stroke="#E9D5FF"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        {/* Face */}
        <circle cx="16" cy="19.5" r="1.8" fill="#1E1B4B" />
        <circle cx="15.5" cy="19" r="0.6" fill="#FFFFFF" />
        <circle cx="24" cy="19.5" r="1.8" fill="#1E1B4B" />
        <circle cx="23.5" cy="19" r="0.6" fill="#FFFFFF" />
        {/* Blushing Stars/Cheeks */}
        <circle cx="13" cy="22" r="1.5" fill="#F472B6" />
        <circle cx="27" cy="22" r="1.5" fill="#F472B6" />
        <path
          d="M18.5 22.5 Q20 24 21.5 22.5"
          stroke="#1E1B4B"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },
  {
    id: "avatar:fantasy-creature",
    name: "Baby Dragon",
    svg: (size = 40) => (
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 rounded-full"
      >
        <circle cx="20" cy="20" r="20" fill="#F5F3FF" />
        {/* Little Golden Horns */}
        <polygon points="12,14 14,7 17,13" fill="#F59E0B" />
        <polygon points="28,14 26,7 23,13" fill="#F59E0B" />
        {/* Dragon Head */}
        <circle cx="20" cy="22" r="12" fill="#A855F7" />
        {/* Snout */}
        <ellipse cx="20" cy="26" rx="6" ry="4" fill="#C084FC" />
        {/* Tiny nostril dots */}
        <circle cx="18.5" cy="25" r="0.7" fill="#581C87" />
        <circle cx="21.5" cy="25" r="0.7" fill="#581C87" />
        {/* Eyes */}
        <circle cx="15" cy="19" r="2.2" fill="#3B0764" />
        <circle cx="14.3" cy="18.3" r="0.8" fill="#FFFFFF" />
        <circle cx="25" cy="19" r="2.2" fill="#3B0764" />
        <circle cx="24.3" cy="18.3" r="0.8" fill="#FFFFFF" />
        {/* Pink cheeks */}
        <circle cx="11.5" cy="23.5" r="2" fill="#F472B6" opacity="0.7" />
        <circle cx="28.5" cy="23.5" r="2" fill="#F472B6" opacity="0.7" />
        {/* Cute Smile */}
        <path
          d="M18 28 Q20 30 22 28"
          stroke="#581C87"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    ),
  },

  // ===================================================================
  // Coordinated Classic Avatars (Preserved for compatibility)
  // ===================================================================
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
          <linearGradient
            id="cosmicBg"
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#1E1B4B" />
            <stop offset="50%" stopColor="#312E81" />
            <stop offset="100%" stopColor="#4338CA" />
          </linearGradient>
          <linearGradient
            id="cosmicRing"
            x1="0"
            y1="20"
            x2="40"
            y2="20"
            gradientUnits="userSpaceOnUse"
          >
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
        <ellipse
          cx="20"
          cy="20"
          rx="17"
          ry="6"
          stroke="url(#cosmicRing)"
          strokeWidth="2"
          transform="rotate(-25 20 20)"
        />
        <circle cx="20" cy="20" r="9" fill="#4F46E5" />
        <circle cx="17" cy="17" r="4" fill="#818CF8" opacity="0.6" />
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
        <polygon points="20,7 29,15 20,33 11,15" fill="#6B21A8" opacity="0.7" />
        <polygon points="20,7 11,15 20,24" fill="url(#facet1)" />
        <polygon points="20,7 29,15 20,24" fill="url(#facet2)" />
        <polygon points="11,15 20,33 20,24" fill="#9333EA" />
        <polygon points="29,15 20,33 20,24" fill="#7E22CE" />
        <polygon
          points="20,11 21.5,13.5 24,14 21.5,14.5 20,17 18.5,14.5 16,14 18.5,13.5"
          fill="#FFFFFF"
          opacity="0.9"
        />
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
          <linearGradient
            id="waveLight"
            x1="0"
            y1="20"
            x2="40"
            y2="30"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#E0F2FE" />
            <stop offset="100%" stopColor="#7DD3FC" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#azureBg)" />
        <path
          d="M0 24 C10 18, 16 30, 26 22 C32 16, 36 21, 40 19 L40 40 L0 40 Z"
          fill="#0C4A6E"
          opacity="0.6"
        />
        <path d="M0 27 C8 23, 14 31, 24 25 C32 20, 36 26, 40 23 L40 40 L0 40 Z" fill="#0284C7" />
        <path d="M0 32 C12 28, 20 34, 40 29 L40 40 L0 40 Z" fill="url(#waveLight)" opacity="0.85" />
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
          <linearGradient
            id="auroraBg"
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
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
        <circle
          cx="20"
          cy="20"
          r="11"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          opacity="0.6"
          strokeDasharray="2 3"
        />
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
          <linearGradient
            id="shieldBg"
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="50%" stopColor="#1E1B4B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <linearGradient
            id="shieldGrad"
            x1="20"
            y1="7"
            x2="20"
            y2="33"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#shieldBg)" />
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
        <circle cx="20" cy="19" r="4" fill="#38BDF8" />
        <circle cx="20" cy="19" r="2" fill="#FFFFFF" />
        <line
          x1="20"
          y1="12"
          x2="20"
          y2="15"
          stroke="#38BDF8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="20"
          y1="23"
          x2="20"
          y2="28"
          stroke="#818CF8"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
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
          <linearGradient
            id="petalGrad"
            x1="0"
            y1="0"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#818CF8" />
            <stop offset="100%" stopColor="#C084FC" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="20" fill="url(#zenBg)" />
        <g transform="translate(20, 20)">
          <ellipse cx="0" cy="-7" rx="3.5" ry="6" fill="url(#petalGrad)" opacity="0.85" />
          <ellipse cx="0" cy="7" rx="3.5" ry="6" fill="url(#petalGrad)" opacity="0.85" />
          <ellipse cx="-7" cy="0" rx="6" ry="3.5" fill="url(#petalGrad)" opacity="0.85" />
          <ellipse cx="7" cy="0" rx="6" ry="3.5" fill="url(#petalGrad)" opacity="0.85" />
          <ellipse
            cx="-5"
            cy="-5"
            rx="3.5"
            ry="5.5"
            transform="rotate(-45 -5 -5)"
            fill="url(#petalGrad)"
            opacity="0.65"
          />
          <ellipse
            cx="5"
            cy="-5"
            rx="3.5"
            ry="5.5"
            transform="rotate(45 5 -5)"
            fill="url(#petalGrad)"
            opacity="0.65"
          />
          <ellipse
            cx="-5"
            cy="5"
            rx="3.5"
            ry="5.5"
            transform="rotate(45 -5 5)"
            fill="url(#petalGrad)"
            opacity="0.65"
          />
          <ellipse
            cx="5"
            cy="5"
            rx="3.5"
            ry="5.5"
            transform="rotate(-45 5 5)"
            fill="url(#petalGrad)"
            opacity="0.65"
          />
          <circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
          <circle cx="0" cy="0" r="2" fill="#4F46E5" />
        </g>
      </svg>
    ),
  },
];

/** Default preset avatar when none is chosen */
export const DEFAULT_AVATAR_ID = "avatar:cartoon-fox";

/** Lookup preset avatar by id */
export function getPresetAvatar(avatarId: string | null | undefined): PresetAvatar | null {
  if (!avatarId) return null;
  return PRESET_AVATARS.find((a) => a.id === avatarId) ?? null;
}

/**
 * Avatar Selector Grid Component
 * Compact, tactile responsive grid of premium illustrated cartoon avatars for the User Menu.
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
    <div
      className="grid grid-cols-4 gap-2 py-1 max-h-60 overflow-y-auto px-0.5"
      role="radiogroup"
      aria-label="Choose profile avatar"
    >
      {PRESET_AVATARS.map((avatar) => {
        const isSelected = selectedId === avatar.id;
        return (
          <button
            key={avatar.id}
            type="button"
            onClick={() => onSelect(avatar.id)}
            disabled={disabled}
            className={`group relative flex flex-col items-center justify-center p-1.5 rounded-2xl border transition-all cursor-pointer ${
              isSelected
                ? "border-blue-600 bg-blue-50/80 shadow-md ring-2 ring-blue-500/30 scale-102"
                : "border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80 hover:scale-102"
            }`}
            title={avatar.name}
            aria-label={`Select ${avatar.name} avatar`}
            aria-pressed={isSelected}
            role="radio"
            aria-checked={isSelected}
          >
            <div className="relative">
              {avatar.svg(38)}
              {isSelected && (
                <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm ring-1 ring-white">
                  <Check className="h-2.5 w-2.5 stroke-[3]" />
                </div>
              )}
            </div>
            <span className="mt-1 text-[9.5px] font-bold text-slate-700 truncate max-w-full leading-tight text-center">
              {avatar.name.split(" ")[0]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
