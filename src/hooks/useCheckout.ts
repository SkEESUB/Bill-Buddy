import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  cancelPaymentOrder,
  createPaymentOrder,
  getPaymentConfig,
  markCheckoutOpened,
  reconcilePayment,
  submitCheckoutResult,
} from "@/lib/payments.functions";
import { loadCheckoutScript, openCheckout } from "@/lib/payments/checkout";
import { paymentErrorCode } from "@/lib/payments/status";
import { classifyError } from "@/lib/errors";

export type CheckoutPhase =
  | "idle"
  | "creating"
  | "opening"
  | "processing"
  | "verifying"
  | "paid"
  | "pending"
  | "failed"
  | "cancelled";

export type CheckoutState = {
  phase: CheckoutPhase;
  message: string | null;
  orderId: string | null;
};

const IDLE: CheckoutState = { phase: "idle", message: null, orderId: null };

const MESSAGES: Record<string, string> = {
  PAYMENT_NOT_CONFIGURED: "Online payments aren't switched on for this app yet.",
  OCCURRENCE_ALREADY_SETTLED: "This bill is already paid.",
  PAYMENT_ALREADY_IN_PROGRESS:
    "A payment for this bill is already in progress. Check its status before trying again.",
  OCCURRENCE_NOT_PAYABLE: "This instalment can no longer be paid.",
  OCCURRENCE_NOT_FOUND: "We couldn't find this bill instalment.",
  PAYMENT_ORDER_NOT_FOUND: "We couldn't find that payment.",
  PAYMENT_ORDER_MISMATCH: "That payment doesn't match this bill. Nothing was charged.",
  INVALID_PAYMENT_SIGNATURE:
    "We couldn't verify the payment result, so we haven't marked this bill paid.",
  PAYMENT_PROVIDER_ERROR: "The payment provider didn't respond. No money has moved.",
  INVALID_AMOUNT: "This bill has an invalid amount.",
};

function messageFor(error: unknown): string {
  const code = paymentErrorCode(error);
  if (code) return MESSAGES[code]!;
  return classifyError(error).message;
}

/**
 * Drives a real provider checkout.
 *
 * The browser never decides the outcome: it hands the provider's response to
 * the server, which verifies the signature and re-reads the payment from the
 * provider before any bill is marked paid. If we can't reach a conclusion, the
 * UI says "pending", never "paid".
 */
export function useCheckout(options: { onSettled?: (() => void | Promise<unknown>) | undefined } = {}) {
  const { onSettled } = options;
  const create = useServerFn(createPaymentOrder);
  const opened = useServerFn(markCheckoutOpened);
  const submit = useServerFn(submitCheckoutResult);
  const cancel = useServerFn(cancelPaymentOrder);
  const reconcile = useServerFn(reconcilePayment);
  const readConfig = useServerFn(getPaymentConfig);

  const [available, setAvailable] = useState<boolean | null>(null);
  const [sandbox, setSandbox] = useState(false);
  const [state, setState] = useState<CheckoutState>(IDLE);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void readConfig({} as never)
      .then((config) => {
        if (cancelled) return;
        setAvailable(config.configured);
        setSandbox(!!config.sandbox);
      })
      .catch(() => !cancelled && setAvailable(false));
    return () => {
      cancelled = true;
    };
  }, [readConfig]);

  const reset = useCallback(() => setState(IDLE), []);

  const applyStatus = useCallback(
    async (orderId: string, result: { state: string; failureMessage: string | null }) => {
      if (result.state === "CAPTURED") {
        setState({ phase: "paid", message: null, orderId });
        await onSettled?.();
        return;
      }
      if (result.state === "FAILED" || result.state === "CANCELLED") {
        setState({
          phase: result.state === "CANCELLED" ? "cancelled" : "failed",
          message:
            result.failureMessage ??
            (result.state === "CANCELLED"
              ? "Payment cancelled. Nothing was charged."
              : "The payment didn't go through. You haven't been charged."),
          orderId,
        });
        return;
      }
      setState({
        phase: "pending",
        message:
          "Your payment is still being confirmed. We'll mark the bill paid as soon as the provider confirms it.",
        orderId,
      });
    },
    [onSettled],
  );

  /** Ask the server for the authoritative state of an in-flight payment. */
  const checkStatus = useCallback(
    async (orderId?: string) => {
      const id = orderId ?? state.orderId;
      if (!id) return;
      setState((s) => ({ ...s, phase: "verifying" }));
      try {
        const result = await reconcile({ data: { payment_order_id: id } });
        await applyStatus(id, result);
      } catch (e) {
        setState({ phase: "pending", message: messageFor(e), orderId: id });
      }
    },
    [applyStatus, reconcile, state.orderId],
  );

  const pay = useCallback(
    async (input: { occurrenceId: string; title: string; email?: string | null }) => {
      setState({ phase: "creating", message: null, orderId: null });

      const scriptReady = await loadCheckoutScript();
      if (!scriptReady) {
        setState({
          phase: "failed",
          message: "We couldn't load the secure checkout. Check your connection and try again.",
          orderId: null,
        });
        return;
      }

      let session;
      try {
        session = await create({
          data: {
            occurrence_id: input.occurrenceId,
            // Stable per attempt: a double click reuses the same order.
            client_token: `${input.occurrenceId}-${Date.now()}`.slice(-40),
          },
        });
      } catch (e) {
        setState({ phase: "failed", message: messageFor(e), orderId: null });
        return;
      }

      setState({ phase: "opening", message: null, orderId: session.paymentOrderId });

      const result = await openCheckout({
        key: session.publishableKey,
        orderId: session.providerOrderId,
        amountMinor: session.amountMinor,
        currency: session.currency,
        name: "PocketPilot",
        description: session.billTitle,
        prefillEmail: input.email ?? null,
        onOpened: () => {
          void opened({ data: { payment_order_id: session!.paymentOrderId } }).catch(() => {});
          if (alive.current) {
            setState({ phase: "processing", message: null, orderId: session!.paymentOrderId });
          }
        },
      });

      if (!alive.current) return;

      if (result.kind === "submitted") {
        setState({ phase: "verifying", message: null, orderId: session.paymentOrderId });
        try {
          const status = await submit({
            data: { payment_order_id: session.paymentOrderId, ...result.handoff },
          });
          await applyStatus(session.paymentOrderId, status);
        } catch (e) {
          // Verification failed or the network dropped: never claim success.
          setState({ phase: "pending", message: messageFor(e), orderId: session.paymentOrderId });
          void checkStatus(session.paymentOrderId);
        }
        return;
      }

      if (result.kind === "failed") {
        setState({ phase: "verifying", message: null, orderId: session.paymentOrderId });
        try {
          const status = await reconcile({
            data: { payment_order_id: session.paymentOrderId },
          });
          await applyStatus(session.paymentOrderId, status);
        } catch {
          setState({ phase: "failed", message: result.message, orderId: session.paymentOrderId });
        }
        return;
      }

      // Dismissed — the server re-checks with the provider before cancelling.
      setState({ phase: "verifying", message: null, orderId: session.paymentOrderId });
      try {
        const status = await cancel({ data: { payment_order_id: session.paymentOrderId } });
        await applyStatus(session.paymentOrderId, status);
      } catch (e) {
        setState({ phase: "pending", message: messageFor(e), orderId: session.paymentOrderId });
      }
    },
    [applyStatus, cancel, checkStatus, create, opened, reconcile, submit],
  );

  return { available, sandbox, state, pay, checkStatus, reset };
}
