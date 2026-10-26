import type { ReactNode } from "react";
import { NetworkErrorModal } from "./NetworkErrorModal";

/**
 * Single-Screen Application Shell for BillBuddy.
 *
 * Provides the soft icy-blue Smart Home ambient background,
 * centered responsive column (optimized for 360px-430px mobile,
 * beautifully centered on desktop viewports), and mobile safe area insets.
 */
export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f2f7fd] via-[#ebf3fc] to-[#e2edf9] text-text-primary antialiased relative overflow-x-hidden flex flex-col items-center selection:bg-blue-200">
      {/* Ambient background glowing accents */}
      <div
        className="pointer-events-none fixed -top-40 left-1/2 -translate-x-1/2 w-[720px] h-[480px] rounded-full ambient-glow opacity-80 blur-3xl z-0"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed top-1/3 -right-40 w-96 h-96 rounded-full bg-sky-200/30 blur-3xl z-0"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed bottom-10 -left-40 w-96 h-96 rounded-full bg-blue-100/40 blur-3xl z-0"
        aria-hidden="true"
      />

      {/* Main Centered Application Frame with Android Safe Area Insets */}
      <div
        className="relative z-10 w-full max-w-lg min-h-screen flex flex-col px-4 sm:px-6"
        style={{
          paddingTop: "max(0.75rem, env(safe-area-inset-top, 0px))",
          paddingBottom: "max(7rem, calc(5.5rem + env(safe-area-inset-bottom, 0px)))",
        }}
      >
        {children}
      </div>

      {/* Network Error Modal */}
      <NetworkErrorModal />
    </div>
  );
}
