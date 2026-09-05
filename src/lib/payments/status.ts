/** Client-safe shapes and helpers shared by payment server functions and UI. */

export type PaymentStatusResult = {
  paymentOrderId: string;
  state: string;
  settled: boolean;
  failureCode: string | null;
  failureMessage: string | null;
  amount: number;
  currency: string;
};

export function statusResult(
  order: {
    id: string;
    amount: number;
    currency: string;
    failure_code?: string | null;
    failure_message?: string | null;
  },
  state: string,
): PaymentStatusResult {
  return {
    paymentOrderId: order.id,
    state,
    settled: state === "CAPTURED",
    failureCode: order.failure_code ?? null,
    failureMessage: order.failure_message ?? null,
    amount: Number(order.amount),
    currency: order.currency,
  };
}

/** Error codes the UI maps to specific, honest messages. */
export const PAYMENT_ERROR_CODES = [
  "PAYMENT_NOT_CONFIGURED",
  "OCCURRENCE_ALREADY_SETTLED",
  "PAYMENT_ALREADY_IN_PROGRESS",
  "OCCURRENCE_NOT_PAYABLE",
  "OCCURRENCE_NOT_FOUND",
  "PAYMENT_ORDER_NOT_FOUND",
  "PAYMENT_ORDER_MISMATCH",
  "INVALID_PAYMENT_SIGNATURE",
  "PAYMENT_PROVIDER_ERROR",
  "INVALID_AMOUNT",
] as const;

export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[number];

export function paymentErrorCode(error: unknown): PaymentErrorCode | null {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const match = (PAYMENT_ERROR_CODES as readonly string[]).find((code) => message.includes(code));
  return (match as PaymentErrorCode | undefined) ?? null;
}
