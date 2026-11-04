interface CelebrationMascotProps {
  src: string;
  alt: string;
  isCelebrating: boolean;
  className?: string;
  sizeClassName?: string;
}

/**
 * Animated Celebration Mascot Component for BillBuddy.
 *
 * Preserves the original mascot image and branding during normal state.
 * When `isCelebrating` is active:
 *  - Performs a happy jumping animation (squash & stretch, leap, celebratory bounce)
 *  - Moves hands upward in triumphant celebration (\o/)
 *  - Overlays a subtle happy facial expression (curved smiling eyes & soft rosy blush)
 *  - Bursts golden sparkle stars around the mascot
 *  - Returns cleanly and completely to its original appearance once celebration finishes
 *  - Fully respects prefers-reduced-motion accessibility settings
 */
export function CelebrationMascot({
  src,
  alt,
  isCelebrating,
  className = "",
  sizeClassName = "h-full w-full",
}: CelebrationMascotProps) {
  return (
    <div className={`relative inline-flex items-center justify-center select-none ${className}`}>
      {/* Base Mascot Wrapper — Executes the happy jumping animation */}
      <div
        className={`relative z-10 transition-transform ${sizeClassName} ${
          isCelebrating ? "mascot-celebrating" : "animate-gentle-float hover:scale-105"
        }`}
      >
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-contain select-none"
          loading="lazy"
          decoding="async"
        />

        {/* Celebration Layer: Hands upward, happy expression, and sparkles */}
        {isCelebrating && (
          <div
            className="mascot-celebration-overlay absolute inset-0 pointer-events-none z-20 overflow-visible"
            aria-hidden="true"
          >
            {/* 1. Celebratory Hands Moving Upward */}
            <svg
              viewBox="0 0 100 100"
              className="mascot-hands-celebrate absolute inset-0 w-full h-full pointer-events-none overflow-visible"
              style={{
                animation: "mascot-hands-wave 2.2s cubic-bezier(0.25, 0.9, 0.35, 1) forwards",
              }}
            >
              {/* Left arm reaching up in celebration */}
              <path
                d="M 28 62 C 16 52, 10 36, 14 24"
                fill="none"
                stroke="#0f172a"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              {/* Left hand / mitten waving up */}
              <circle cx="14" cy="22" r="5.5" fill="#0f172a" />
              <circle cx="10" cy="24" r="3" fill="#0f172a" />
              <circle cx="18" cy="19" r="3" fill="#0f172a" />

              {/* Right arm reaching up in celebration */}
              <path
                d="M 72 62 C 84 52, 90 36, 86 24"
                fill="none"
                stroke="#0f172a"
                strokeWidth="4.5"
                strokeLinecap="round"
              />
              {/* Right hand / mitten waving up */}
              <circle cx="86" cy="22" r="5.5" fill="#0f172a" />
              <circle cx="90" cy="24" r="3" fill="#0f172a" />
              <circle cx="82" cy="19" r="3" fill="#0f172a" />
            </svg>

            {/* 2. Subtle Happy Facial Expression Overlay */}
            <div
              className="mascot-happy-expression absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                animation: "mascot-happy-face 2.2s cubic-bezier(0.25, 0.9, 0.35, 1) forwards",
              }}
            >
              <svg viewBox="0 0 100 100" className="w-[62%] h-[62%] pointer-events-none">
                {/* Happy curved squinting eyes (⌒  ⌒) */}
                <path
                  d="M 32 46 Q 39 39 46 46"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <path
                  d="M 54 46 Q 61 39 68 46"
                  fill="none"
                  stroke="#0f172a"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                {/* Cheerful soft rosy cheek blush */}
                <ellipse cx="28" cy="53" rx="5" ry="3" fill="#f43f5e" opacity="0.45" />
                <ellipse cx="72" cy="53" rx="5" ry="3" fill="#f43f5e" opacity="0.45" />
              </svg>
            </div>

            {/* 3. Golden Sparkle Effects */}
            <div className="absolute -inset-4 pointer-events-none overflow-visible">
              {[
                {
                  top: "-10px",
                  right: "-10px",
                  delay: "80ms",
                  dur: "1.4s",
                  size: "w-5 h-5",
                  color: "#fbbf24",
                },
                {
                  top: "-14px",
                  left: "8px",
                  delay: "220ms",
                  dur: "1.3s",
                  size: "w-4 h-4",
                  color: "#f59e0b",
                },
                {
                  bottom: "2px",
                  right: "-8px",
                  delay: "380ms",
                  dur: "1.3s",
                  size: "w-4 h-4",
                  color: "#fbbf24",
                },
                {
                  top: "18px",
                  left: "-12px",
                  delay: "160ms",
                  dur: "1.5s",
                  size: "w-4 h-4",
                  color: "#60a5fa",
                },
                {
                  top: "-18px",
                  left: "44%",
                  delay: "300ms",
                  dur: "1.2s",
                  size: "w-5 h-5",
                  color: "#fef08a",
                },
                {
                  bottom: "-4px",
                  left: "6px",
                  delay: "460ms",
                  dur: "1.3s",
                  size: "w-3.5 h-3.5",
                  color: "#fbbf24",
                },
              ].map((sparkle, idx) => (
                <div
                  key={idx}
                  className={`mascot-sparkle absolute ${sparkle.size} pointer-events-none`}
                  style={{
                    top: sparkle.top,
                    left: sparkle.left,
                    right: sparkle.right,
                    bottom: sparkle.bottom,
                    animation: `sparkle-pop ${sparkle.dur} cubic-bezier(0.25, 0.9, 0.35, 1) ${sparkle.delay} forwards`,
                  }}
                >
                  <svg viewBox="0 0 24 24" className="w-full h-full drop-shadow-sm">
                    <path
                      d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z"
                      fill={sparkle.color}
                    />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
