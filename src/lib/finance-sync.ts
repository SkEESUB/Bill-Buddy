/**
 * Tiny broadcast channel so every mounted screen refetches after any screen
 * performs a financial mutation. Prevents one tab/page showing stale money.
 */
import { useEffect } from "react";

type Listener = (sourceId?: string) => void;
const listeners = new Map<string, Listener>();

/** Notify subscribers that server-side financial state changed. */
export function bumpFinance(sourceId?: string): void {
  for (const [id, listener] of listeners) {
    if (sourceId && id === sourceId) continue;
    listener(sourceId);
  }
}

/** Subscribe a refresh callback for the lifetime of the component. */
export function useFinanceSync(onChange: () => void, subscriberId?: string): void {
  useEffect(() => {
    const id = subscriberId || Math.random().toString(36).slice(2);
    listeners.set(id, () => onChange());
    return () => {
      listeners.delete(id);
    };
  }, [onChange, subscriberId]);
}
