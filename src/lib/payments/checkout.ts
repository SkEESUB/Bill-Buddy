/**
 * Browser-side Razorpay Checkout loader.
 *
 * Nothing here decides whether a payment succeeded — it only collects the
 * provider's handoff result and passes it to the server for verification.
 */

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

export type CheckoutHandoff = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type CheckoutResult =
  | { kind: "submitted"; handoff: CheckoutHandoff }
  | { kind: "dismissed" }
  | { kind: "failed"; code: string | null; message: string };

type RazorpayInstance = { open: () => void; close: () => void };
type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let scriptPromise: Promise<boolean> | null = null;

/** Load checkout.js once. Resolves false when the network blocks it. */
export function loadCheckoutScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.addEventListener("load", () => resolve(!!window.Razorpay));
    script.addEventListener("error", () => {
      scriptPromise = null;
      resolve(false);
    });
    if (!existing) document.body.appendChild(script);
  });
  return scriptPromise;
}

/** Open the provider sheet and resolve once the user leaves it. */
export function openCheckout(options: {
  key: string;
  orderId: string;
  amountMinor: number;
  currency: string;
  name: string;
  description: string;
  prefillEmail?: string | null;
  prefillContact?: string | null;
  onOpened?: () => void;
}): Promise<CheckoutResult> {
  return new Promise<CheckoutResult>((resolve) => {
    const Ctor = window.Razorpay;
    if (!Ctor) {
      resolve({ kind: "failed", code: "SCRIPT_UNAVAILABLE", message: "Checkout could not load." });
      return;
    }
    let settled = false;
    const finish = (result: CheckoutResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const instance = new Ctor({
      key: options.key,
      order_id: options.orderId,
      amount: options.amountMinor,
      currency: options.currency,
      name: options.name,
      description: options.description,
      prefill: {
        ...(options.prefillEmail ? { email: options.prefillEmail } : {}),
        ...(options.prefillContact ? { contact: options.prefillContact } : {}),
      },
      theme: { color: "#4B1D3F" },
      retry: { enabled: false },
      modal: {
        escape: false,
        ondismiss: () => finish({ kind: "dismissed" }),
      },
      handler: (response: Partial<CheckoutHandoff>) => {
        if (
          response.razorpay_order_id &&
          response.razorpay_payment_id &&
          response.razorpay_signature
        ) {
          finish({ kind: "submitted", handoff: response as CheckoutHandoff });
        } else {
          finish({
            kind: "failed",
            code: "INCOMPLETE_HANDOFF",
            message: "Checkout returned an incomplete result.",
          });
        }
      },
    });

    // Razorpay surfaces terminal failures through this event.
    const withOn = instance as RazorpayInstance & {
      on?: (
        event: string,
        cb: (payload: { error?: { code?: string; description?: string } }) => void,
      ) => void;
    };
    withOn.on?.("payment.failed", (payload) => {
      finish({
        kind: "failed",
        code: payload.error?.code ?? null,
        message: payload.error?.description ?? "The payment did not go through.",
      });
    });

    instance.open();
    options.onOpened?.();
  });
}
