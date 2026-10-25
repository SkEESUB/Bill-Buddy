/**
 * Payment state machine.
 *
 * Pure, dependency-free and therefore unit-testable. Every payment state
 * change in the app — server function, webhook or reconciliation — goes
 * through `transition()`, so an invalid or client-forged jump is impossible.
 */

export const PAYMENT_STATES = [
  "CREATED",
  "ORDER_CREATED",
  "CHECKOUT_OPENED",
  "USER_PROCESSING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
  "UNKNOWN",
] as const;

export type PaymentState = (typeof PAYMENT_STATES)[number];

/** States from which no further movement is expected (refunds excepted). */
export const TERMINAL_PAYMENT_STATES: readonly PaymentState[] = [
  "CAPTURED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
  "REFUNDED",
];

/** States that mean "a payment is currently in flight for this instalment". */
export const ACTIVE_PAYMENT_STATES: readonly PaymentState[] = [
  "CREATED",
  "ORDER_CREATED",
  "CHECKOUT_OPENED",
  "USER_PROCESSING",
  "AUTHORIZED",
  "UNKNOWN",
];

const ALLOWED: Record<PaymentState, readonly PaymentState[]> = {
  CREATED: ["ORDER_CREATED", "FAILED", "CANCELLED", "EXPIRED", "UNKNOWN"],
  ORDER_CREATED: [
    "CHECKOUT_OPENED",
    "USER_PROCESSING",
    "FAILED",
    "CANCELLED",
    "EXPIRED",
    "UNKNOWN",
  ],
  CHECKOUT_OPENED: ["USER_PROCESSING", "FAILED", "CANCELLED", "EXPIRED", "UNKNOWN"],
  USER_PROCESSING: ["AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "EXPIRED", "UNKNOWN"],
  AUTHORIZED: ["CAPTURED", "FAILED", "EXPIRED", "UNKNOWN"],
  // Terminal, except that a captured payment can later be refunded.
  CAPTURED: ["REFUNDED"],
  FAILED: [],
  CANCELLED: [],
  EXPIRED: [],
  REFUNDED: [],
  // An uncertain payment must be resolvable by reconciliation.
  UNKNOWN: ["AUTHORIZED", "CAPTURED", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED"],
};

export class PaymentStateError extends Error {
  readonly code = "INVALID_PAYMENT_TRANSITION";
  constructor(
    readonly from: PaymentState,
    readonly to: PaymentState,
  ) {
    super(`Payment cannot move from ${from} to ${to}.`);
  }
}

export function isPaymentState(value: unknown): value is PaymentState {
  return typeof value === "string" && (PAYMENT_STATES as readonly string[]).includes(value);
}

export function isTerminal(state: PaymentState): boolean {
  return TERMINAL_PAYMENT_STATES.includes(state);
}

export function isActive(state: PaymentState): boolean {
  return ACTIVE_PAYMENT_STATES.includes(state);
}

export function canTransition(from: PaymentState, to: PaymentState): boolean {
  if (from === to) return true; // idempotent replay of the same event
  return ALLOWED[from].includes(to);
}

/**
 * Returns the next state, or throws when the move is not permitted.
 * Re-applying the current state is allowed so duplicate provider events are
 * harmless.
 */
export function transition(from: PaymentState, to: PaymentState): PaymentState {
  if (!canTransition(from, to)) throw new PaymentStateError(from, to);
  return to;
}

/**
 * Same as `transition`, but never throws: used by webhook processing where an
 * out-of-order event must be ignored rather than crash the endpoint.
 */
export function tryTransition(
  from: PaymentState,
  to: PaymentState,
): { ok: true; state: PaymentState } | { ok: false; state: PaymentState; reason: string } {
  if (!canTransition(from, to)) {
    return { ok: false, state: from, reason: `Ignored out-of-order transition ${from} → ${to}.` };
  }
  return { ok: true, state: to };
}

/** True only for the one state that is allowed to settle a bill instalment. */
export function isSettling(state: PaymentState): boolean {
  return state === "CAPTURED";
}

/** Map a provider status string onto our state machine vocabulary. */
export function mapRazorpayPaymentStatus(status: string | null | undefined): PaymentState {
  switch (status) {
    case "created":
      return "ORDER_CREATED";
    case "authorized":
      return "AUTHORIZED";
    case "captured":
      return "CAPTURED";
    case "failed":
      return "FAILED";
    case "refunded":
      return "REFUNDED";
    default:
      return "UNKNOWN";
  }
}

/** Map a Razorpay *order* status onto our vocabulary. */
export function mapRazorpayOrderStatus(status: string | null | undefined): PaymentState {
  switch (status) {
    case "created":
      return "ORDER_CREATED";
    case "attempted":
      return "USER_PROCESSING";
    case "paid":
      return "CAPTURED";
    default:
      return "UNKNOWN";
  }
}

/** Razorpay webhook event name → state, or null when the event is irrelevant. */
export function mapRazorpayEvent(eventType: string): PaymentState | null {
  switch (eventType) {
    case "payment.authorized":
      return "AUTHORIZED";
    case "payment.captured":
    case "order.paid":
      return "CAPTURED";
    case "payment.failed":
      return "FAILED";
    case "refund.processed":
    case "refund.created":
      return "REFUNDED";
    default:
      return null;
  }
}

/** Money equality in minor units, guarding against float drift. */
export function amountsMatch(expectedMajor: number, providerMinor: number): boolean {
  return Math.round(expectedMajor * 100) === Math.round(providerMinor);
}
