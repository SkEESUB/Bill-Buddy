import { useEffect } from "react";
import { useModalA11y } from "@/hooks/useModalA11y";

/** Accessible confirmation dialog used for destructive actions. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useModalA11y<HTMLDivElement>(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#281522]/35 p-4 backdrop-blur-[4px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="animate-scale-in w-full max-w-sm rounded-[28px] bg-surface p-6 shadow-[0_24px_60px_-12px_rgba(75,29,63,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        <p className="mt-2 text-sm text-text-secondary">{message}</p>
        <div className="mt-6 flex gap-3">
          <button type="button" className="btn btn-secondary flex-1" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn flex-1 text-white"
            style={{ backgroundColor: destructive ? "var(--status-error)" : "var(--primary)" }}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
