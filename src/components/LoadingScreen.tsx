export function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white px-6 antialiased select-none"
      role="status"
      aria-live="polite"
      aria-label="Loading BillBuddy"
    >
      {/* Subtle ambient light glow */}
      <div
        className="pointer-events-none absolute h-72 w-72 rounded-full bg-gradient-to-tr from-orange-100/40 via-blue-50/50 to-indigo-100/40 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center">
        {/* Official BillBuddy Logo with full artwork and wordmark */}
        <div className="animate-fade-in flex items-center justify-center">
          <img
            src="/billbuddy-logo.png"
            alt="BillBuddy — build by Eesub labs"
            className="w-[280px] sm:w-[340px] max-w-[85vw] h-auto object-contain drop-shadow-sm"
            loading="eager"
            decoding="async"
          />
        </div>

        {/* Lightweight indeterminate progress indicator */}
        <div className="mt-8 flex flex-col items-center gap-2.5">
          <div className="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full w-1/3 rounded-full bg-gradient-to-r from-orange-500 via-indigo-600 to-blue-500 animate-pulse"
              style={{
                animation: "shimmerSlide 1.4s ease-in-out infinite",
              }}
            />
          </div>
          <span className="text-xs font-medium text-slate-400 tracking-wide">{message}</span>
        </div>
      </div>
    </div>
  );
}
