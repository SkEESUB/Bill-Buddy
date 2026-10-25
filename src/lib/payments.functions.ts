import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { z } from "zod";
import { statusResult, type PaymentStatusResult } from "./payments/status";

/**
 * Payment server functions.
 *
 * Every amount is read from the database, never from the browser. Every state
 * change goes through the payment state machine. Nothing here trusts a
 * client-supplied payment result until the provider signature has been
 * verified server-side AND the provider itself reports the payment captured.
 */

export type CheckoutSession = {
  paymentOrderId: string;
  providerOrderId: string;
  provider: "razorpay";
  publishableKey: string;
  amount: number;
  amountMinor: number;
  currency: string;
  billTitle: string;
  dueDate: string;
  sandbox: boolean;
  expiresAt: string;
};

export type { PaymentStatusResult } from "./payments/status";

export const createPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        occurrence_id: z.string().uuid(),
        // Client-supplied idempotency token: two rapid clicks reuse one order.
        client_token: z.string().trim().min(8).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<CheckoutSession> => {
    const { userId } = context;
    const { readConfig, createProviderOrder, isSandboxKey, PROVIDER } =
      await import("./payments/provider.server");
    const { adminDb, orderState } = await import("./payments/settle.server");
    const { isActive } = await import("./payments/state");

    const config = readConfig();
    if (!config) {
      throw new Error("PAYMENT_NOT_CONFIGURED");
    }

    const db = await adminDb();

    // Ownership + payability come from the authoritative row, not the client.
    const { data: occurrence, error } = await db
      .from("bill_occurrences")
      .select("*, bill:bills(title, category, is_active)")
      .eq("id", data.occurrence_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!occurrence) throw new Error("OCCURRENCE_NOT_FOUND");
    if (occurrence.status === "paid") throw new Error("OCCURRENCE_ALREADY_SETTLED");
    if (occurrence.status === "cancelled" || occurrence.status === "skipped") {
      throw new Error("OCCURRENCE_NOT_PAYABLE");
    }

    const amount = Number(occurrence.actual_amount ?? occurrence.expected_amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_AMOUNT");
    const currency = "INR";
    const idempotencyKey = `${data.occurrence_id}:${data.client_token}`;

    // Same click, retried: hand back the existing order instead of a new one.
    const { data: sameKey } = await db
      .from("payment_orders")
      .select("*")
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (sameKey?.provider_order_id && isActive(orderState(sameKey))) {
      return session(sameKey, occurrence, config.keyId, amount);
    }

    // A different payment is already in flight for this instalment.
    const { data: active } = await db
      .from("payment_orders")
      .select("*")
      .eq("bill_occurrence_id", data.occurrence_id)
      .in("status", [
        "CREATED",
        "ORDER_CREATED",
        "CHECKOUT_OPENED",
        "USER_PROCESSING",
        "AUTHORIZED",
        "UNKNOWN",
      ])
      .maybeSingle();
    if (active) throw new Error("PAYMENT_ALREADY_IN_PROGRESS");

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const { data: order, error: insertError } = await db
      .from("payment_orders")
      .insert({
        user_id: userId,
        bill_occurrence_id: data.occurrence_id,
        provider: PROVIDER,
        amount,
        currency,
        status: "CREATED",
        idempotency_key: idempotencyKey,
        expires_at: expiresAt,
        metadata: { occurrence_amount: amount },
      } as never)
      .select("*")
      .single();
    if (insertError) {
      if (/payment_orders_active_per_occurrence/.test(insertError.message)) {
        throw new Error("PAYMENT_ALREADY_IN_PROGRESS");
      }
      throw new Error(insertError.message);
    }

    let providerOrder;
    try {
      providerOrder = await createProviderOrder({
        amountMinor: Math.round(amount * 100),
        currency,
        receipt: order.id,
        idempotencyKey,
        notes: { payment_order_id: order.id, bill_occurrence_id: data.occurrence_id },
      });
    } catch (e) {
      await db
        .from("payment_orders")
        .update({
          status: "FAILED",
          failure_code: "PROVIDER_ORDER_FAILED",
          failure_message: e instanceof Error ? e.message : "Provider error",
        } as never)
        .eq("id", order.id);
      throw new Error("PAYMENT_PROVIDER_ERROR");
    }

    const { data: updated, error: updateError } = await db
      .from("payment_orders")
      .update({ status: "ORDER_CREATED", provider_order_id: providerOrder.id } as never)
      .eq("id", order.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);

    return session(updated, occurrence, config.keyId, amount);

    function session(
      row: {
        id: string;
        provider_order_id: string | null;
        currency: string;
        expires_at: string | null;
      },
      occ: { scheduled_date: string; bill?: { title?: string } | null },
      keyId: string,
      amountMajor: number,
    ): CheckoutSession {
      return {
        paymentOrderId: row.id,
        providerOrderId: row.provider_order_id!,
        provider: "razorpay",
        publishableKey: keyId, // key id is public by design; the secret never leaves the server
        amount: amountMajor,
        amountMinor: Math.round(amountMajor * 100),
        currency: row.currency,
        billTitle: occ.bill?.title ?? "Bill payment",
        dueDate: occ.scheduled_date,
        sandbox: isSandboxKey(keyId),
        expiresAt: row.expires_at ?? expiresAt,
      };
    }
  });

/** Checkout was handed to the provider; the user is now paying externally. */
export const markCheckoutOpened = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ payment_order_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { adminDb, loadOrder, applyOrderState } = await import("./payments/settle.server");
    const db = await adminDb();
    const order = await loadOrder(db, data.payment_order_id);
    if (!order || order.user_id !== context.userId) throw new Error("PAYMENT_ORDER_NOT_FOUND");
    const applied = await applyOrderState(db, order, "CHECKOUT_OPENED");
    return { state: applied.state };
  });

/**
 * The browser reports the provider's checkout result. The signature is
 * verified server-side and then IGNORED as proof of money movement: the
 * provider's own API is the source of truth for the captured state.
 */
export const submitCheckoutResult = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        payment_order_id: z.string().uuid(),
        razorpay_order_id: z.string().trim().min(4).max(120),
        razorpay_payment_id: z.string().trim().min(4).max(120),
        razorpay_signature: z.string().trim().min(16).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<PaymentStatusResult> => {
    const { verifyCheckoutSignature, fetchProviderPayment } =
      await import("./payments/provider.server");
    const {
      adminDb,
      loadOrder,
      applyOrderState,
      settleCapturedPayment,
      recordFailure,
      upsertAttempt,
      orderState,
    } = await import("./payments/settle.server");

    const db = await adminDb();
    const order = await loadOrder(db, data.payment_order_id);
    if (!order || order.user_id !== context.userId) throw new Error("PAYMENT_ORDER_NOT_FOUND");
    if (order.provider_order_id !== data.razorpay_order_id) {
      throw new Error("PAYMENT_ORDER_MISMATCH");
    }

    const valid = await verifyCheckoutSignature({
      orderId: data.razorpay_order_id,
      paymentId: data.razorpay_payment_id,
      signature: data.razorpay_signature,
    });
    if (!valid) {
      await applyOrderState(db, order, "UNKNOWN", {
        failure_code: "INVALID_SIGNATURE",
        failure_message: "Checkout signature could not be verified.",
      });
      throw new Error("INVALID_PAYMENT_SIGNATURE");
    }

    await applyOrderState(db, order, "USER_PROCESSING");
    await upsertAttempt(db, order, {
      providerPaymentId: data.razorpay_payment_id,
      status: "USER_PROCESSING",
    });

    let payment;
    try {
      payment = await fetchProviderPayment(data.razorpay_payment_id);
    } catch {
      const applied = await applyOrderState(db, order, "UNKNOWN", {
        failure_code: "PROVIDER_UNREACHABLE",
      });
      return statusResult(order, applied.state);
    }

    if (payment.order_id && payment.order_id !== order.provider_order_id) {
      throw new Error("PAYMENT_ORDER_MISMATCH");
    }

    if (payment.status === "captured") {
      const outcome = await settleCapturedPayment(db, order, payment);
      return statusResult(order, outcome.state);
    }
    if (payment.status === "authorized") {
      const applied = await applyOrderState(db, order, "AUTHORIZED");
      return statusResult(order, applied.state);
    }
    if (payment.status === "failed") {
      const outcome = await recordFailure(db, order, payment, "FAILED");
      return statusResult(order, outcome.state);
    }
    return statusResult(order, orderState(order));
  });

/** The user closed/abandoned the provider checkout. */
export const cancelPaymentOrder = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ payment_order_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PaymentStatusResult> => {
    const { adminDb, loadOrder, reconcileOrderWithProvider, applyOrderState, orderState } =
      await import("./payments/settle.server");
    const db = await adminDb();
    const order = await loadOrder(db, data.payment_order_id);
    if (!order || order.user_id !== context.userId) throw new Error("PAYMENT_ORDER_NOT_FOUND");

    // Never cancel blindly: the user may have paid before dismissing the sheet.
    try {
      const outcome = await reconcileOrderWithProvider(db, order);
      if (outcome.settled || outcome.state === "CAPTURED" || outcome.state === "AUTHORIZED") {
        return statusResult(order, outcome.state);
      }
    } catch {
      const applied = await applyOrderState(db, order, "UNKNOWN", {
        failure_code: "PROVIDER_UNREACHABLE",
      });
      return statusResult(order, applied.state);
    }

    const applied = await applyOrderState(db, order, "CANCELLED", {
      failure_code: "USER_CANCELLED",
      failure_message: "Payment cancelled before completion.",
    });
    return statusResult(order, applied.state || orderState(order));
  });

/** Authoritative status check — the "Check status" button and polling use it. */
export const reconcilePayment = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ payment_order_id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<PaymentStatusResult> => {
    const { adminDb, loadOrder, reconcileOrderWithProvider, orderState } =
      await import("./payments/settle.server");
    const db = await adminDb();
    const order = await loadOrder(db, data.payment_order_id);
    if (!order || order.user_id !== context.userId) throw new Error("PAYMENT_ORDER_NOT_FOUND");

    try {
      const outcome = await reconcileOrderWithProvider(db, order);
      return statusResult(order, outcome.state);
    } catch {
      return statusResult(order, orderState(order));
    }
  });

/** Is online payment available at all? Used to show an honest UI. */
export const getPaymentConfig = createServerFn({ method: "GET" }).handler(async () => {
  const { readConfig, isSandboxKey, webhookConfigured } =
    await import("./payments/provider.server");
  const config = readConfig();
  return {
    configured: !!config,
    provider: "razorpay" as const,
    sandbox: config ? isSandboxKey(config.keyId) : null,
    webhookConfigured: webhookConfigured(),
  };
});
