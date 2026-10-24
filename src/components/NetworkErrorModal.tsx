import { useEffect, useState } from "react";
import { WifiOff, RotateCcw } from "lucide-react";

/**
 * Global Network Error Modal matching Phase 8 Screen 5.
 * Triggers when the browser goes offline, offering retry or offline mode handoff.
 */
export function NetworkErrorModal() {
  const [isOffline, setIsOffline] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setIsOffline(!navigator.onLine);

    const handleOnline = () => {
      setIsOffline(false);
      setDismissed(false);
    };

    const handleOffline = () => {
      setIsOffline(true);
      setDismissed(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline || dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
      role="alertdialog"
      aria-modal="true"
      aria-label="Connection Lost"
    >
      <div className="w-full max-w-sm rounded-[32px] border border-border-light bg-surface p-7 text-center shadow-2xl animate-scale-in">
        {/* Red Disconnected Wi-Fi Icon matching Phase 8 Screen 5 */}
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-rose-50 text-rose-500 border border-rose-100 shadow-md shadow-rose-500/10 dark:bg-rose-950/30 dark:border-rose-900/40">
          <WifiOff className="h-10 w-10 stroke-[2]" />
        </div>

        <h2 className="text-xl font-bold text-text-primary">Connection lost</h2>
        <p className="mt-2 text-xs text-text-secondary leading-relaxed px-2">
          Looks like you're offline, please check your internet connection.
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary w-full !min-h-12 !rounded-2xl text-xs font-bold shadow-lg shadow-primary/25 cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" /> Try Again
          </button>

          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="btn btn-secondary w-full !min-h-12 !rounded-2xl text-xs font-semibold cursor-pointer"
          >
            Go to Offline Mode
          </button>
        </div>
      </div>
    </div>
  );
}
