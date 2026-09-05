/**
 * Payment provider adapter (server-only).
 *
 * PocketPilot is India-first, so the implemented provider is Razorpay and the
 * checkout uses Razorpay's own UPI flow. We never see, request or store a UPI
 * PIN, bank password, banking OTP or card CVV — those are entered only inside
 * the provider's checkout or the user's own bank/UPI app.
 *
 * Credentials come from server environment variables and are read inside
 * functions (never at module scope, never in the browser bundle):
 *   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
 * When they are absent the app reports a configuration error instead of
 * pretending a payment happened.
 */

export const PROVIDER = "razorpay" as const;

const API = "https://api.razorpay.com/v1";

export type ProviderConfig = {
  keyId: string;
  keySecret: string;
};

export class PaymentConfigError extends Error {
  readonly code = "PAYMENT_NOT_CONFIGURED";
  constructor(message = "Online payments are not configured for this app yet.") {
    super(message);
  }
}

export class ProviderError extends Error {
  readonly code = "PAYMENT_PROVIDER_ERROR";
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

export function readConfig(): ProviderConfig | null {
  const keyId = process.env["RAZORPAY_KEY_ID"];
  const keySecret = process.env["RAZORPAY_KEY_SECRET"];
  if (!keyId || !keySecret) return null;
  return { keyId, keySecret };
}

export function requireConfig(): ProviderConfig {
  const config = readConfig();
  if (!config) throw new PaymentConfigError();
  return config;
}

export function isSandboxKey(keyId: string): boolean {
  return keyId.startsWith("rzp_test_");
}

function authHeader({ keyId, keySecret }: ProviderConfig): string {
  return `Basic ${btoa(`${keyId}:${keySecret}`)}`;
}

async function call<T>(path: string, init: RequestInit & { config: ProviderConfig }): Promise<T> {
  const { config, ...rest } = init;
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, {
      ...rest,
      headers: {
        "content-type": "application/json",
        authorization: authHeader(config),
        ...(rest.headers ?? {}),
      },
    });
  } catch (cause) {
    throw new ProviderError("Could not reach the payment provider.");
  }
  const text = await response.text();
  const body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    const error = (body["error"] ?? {}) as { description?: string; code?: string };
    throw new ProviderError(
      error.description ?? `Payment provider returned ${response.status}.`,
      response.status,
    );
  }
  return body as T;
}

export type ProviderOrder = {
  id: string;
  amount: number; // minor units
  currency: string;
  status: string;
  receipt?: string | null;
};

export type ProviderPayment = {
  id: string;
  order_id: string | null;
  amount: number; // minor units
  currency: string;
  status: string;
  method?: string | null;
  error_code?: string | null;
  error_description?: string | null;
  amount_refunded?: number;
};

/** Create a provider order. `amountMinor` is authoritative and server-derived. */
export function createProviderOrder(input: {
  amountMinor: number;
  currency: string;
  receipt: string;
  idempotencyKey: string;
  notes: Record<string, string>;
}): Promise<ProviderOrder> {
  const config = requireConfig();
  return call<ProviderOrder>("/orders", {
    config,
    method: "POST",
    headers: { "x-razorpay-idempotency-key": input.idempotencyKey },
    body: JSON.stringify({
      amount: input.amountMinor,
      currency: input.currency,
      receipt: input.receipt.slice(0, 40),
      payment_capture: 1,
      notes: input.notes,
    }),
  });
}

export function fetchProviderOrder(orderId: string): Promise<ProviderOrder> {
  return call<ProviderOrder>(`/orders/${encodeURIComponent(orderId)}`, {
    config: requireConfig(),
    method: "GET",
  });
}

export function fetchProviderPayment(paymentId: string): Promise<ProviderPayment> {
  return call<ProviderPayment>(`/payments/${encodeURIComponent(paymentId)}`, {
    config: requireConfig(),
    method: "GET",
  });
}

export async function fetchOrderPayments(orderId: string): Promise<ProviderPayment[]> {
  const body = await call<{ items?: ProviderPayment[] }>(
    `/orders/${encodeURIComponent(orderId)}/payments`,
    { config: requireConfig(), method: "GET" },
  );
  return body.items ?? [];
}

export function refundProviderPayment(
  paymentId: string,
  amountMinor?: number,
): Promise<{ id: string; amount: number; status: string }> {
  return call(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    config: requireConfig(),
    method: "POST",
    body: JSON.stringify(amountMinor ? { amount: amountMinor } : {}),
  });
}

/* ------------------------------ signatures ------------------------------ */

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison of two hex digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Verify the signature Razorpay Checkout hands back to the browser. */
export async function verifyCheckoutSignature(input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): Promise<boolean> {
  const { keySecret } = requireConfig();
  const expected = await hmacSha256Hex(keySecret, `${input.orderId}|${input.paymentId}`);
  return safeEqual(expected, input.signature.trim().toLowerCase());
}

/** Verify a webhook body against `x-razorpay-signature`. Raw body only. */
export async function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  const secret = process.env["RAZORPAY_WEBHOOK_SECRET"];
  if (!secret || !signature) return false;
  const expected = await hmacSha256Hex(secret, rawBody);
  return safeEqual(expected, signature.trim().toLowerCase());
}

export function webhookConfigured(): boolean {
  return !!process.env["RAZORPAY_WEBHOOK_SECRET"];
}
