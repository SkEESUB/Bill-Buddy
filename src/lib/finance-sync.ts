/**
 * Tiny broadcast channel so every mounted screen refetches after any screen
 * performs a financial mutation. Prevents one tab/page showing stale money.
 */
import { useEffect } from "react";

type Listener = () => void;
const listeners = new Set<Listener>();

/** Notify all subscribers that server-side financial state changed. */
export function bumpFinance(): void {
  for (const listener of [...listeners]) listener();
}

/** Subscribe a refresh callback for the lifetime of the component. */
export function useFinanceSync(onChange: () => void): void {
  useEffect(() => {
    const listener = () => onChange();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [onChange]);
}
