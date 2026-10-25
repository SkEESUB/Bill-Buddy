/**
 * Server-only payment ledger + settlement engine.
 *
 * Nothing here is reachable from the browser: every write uses the service
 * client after the caller has been authenticated (server function) or the
 * payload has been cryptographically verified (webhook). A bill instalment is
 * only ever marked paid from `settleCapturedPayment`, which requires a
 * provider-confirmed CAPTURED payment.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isPaymentState,
  tryTransition,
  type PaymentState,
  amountsMatch,
  mapRazorpayPaymentStatus,
} from "./state";
import { PROVIDER, type ProviderPayment } from "./provider.server";

type Db = SupabaseClient<any, "public", any>;

export type PaymentOrderRow = {
  id: string;
  user_id: string;
  bill_occurrence_id: string;
  provider: string;
  provider_order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  refunded_amount: number;
  transaction_id: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
};

export async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

export function orderState(order: { status: string }): PaymentState {
  return isPaymentState(order.status) ? order.status : "UNKNOWN";
}

export async function loadOrder(db: Db, id: string): Promise<PaymentOrderRow | null> {
  const { data } = await db.from("payment_orders").select("*").eq("id", id).maybeSingle();
  return (data as PaymentOrderRow | null) ?? null;
}

export async function loadOrderByProviderOrderId(
  db: Db,
  providerOrderId: string,
): Promise<PaymentOrderRow | null> {
  const { data } = await db
    .from("payment_orders")
    .select("*")
    .eq("provider", PROVIDER)
    .eq("provider_order_id", providerOrderId)
    .maybeSingle();
  return (data as PaymentOrderRow | null) ?? null;
}

/** Apply a state change through the machine. Out-of-order moves are ignored. */
export async function applyOrderState(
  db: Db,
  order: PaymentOrderRow,
  next: PaymentState,
  patch: Record<string, unknown> = {},
): Promise<{ applied: boolean; state: PaymentState; reason?: string }> {
  const current = orderState(order);
  const result = tryTransition(current, next);
  if (!result.ok) return { applied: false, state: current, reason: result.reason };
  const { error } = await db
    .from("payment_orders")
    .update({ status: result.state, ...patch } as never)
    .eq("id", order.id);
  if (error) throw new Error(error.message);
  order.status = result.state;
  return { applied: true, state: result.state };
}

/** Insert or update the attempt row for one provider payment id. */
export async function upsertAttempt(
  db: Db,
  order: PaymentOrderRow,
  input: {
    providerPaymentId: string | null;
    status: PaymentState;
    method?: string | null;
    failureCode?: string | null;
    failureMessage?: string | null;
  },
): Promise<void> {
  if (input.providerPaymentId) {
    const { data: existing } = await db
      .from("payment_attempts")
      .select("id, status")
      .eq("provider", PROVIDER)
      .eq("provider_payment_id", input.providerPaymentId)
      .maybeSingle();
    if (existing) {
      const current = isPaymentState(existing.status) ? existing.status : "UNKNOWN";
      const next = tryTransition(current, input.status);
      await db
        .from("payment_attempts")
        .update({
          status: next.ok ? next.state : current,
          method: input.method ?? null,
          failure_code: input.failureCode ?? null,
          failure_message: input.failureMessage ?? null,
        } as never)
        .eq("id", existing.id);
      return;
    }
  }
  await db.from("payment_attempts").insert({
    payment_order_id: order.id,
    user_id: order.user_id,
    provider: PROVIDER,
    provider_payment_id: input.providerPaymentId,
    status: input.status,
    method: input.method ?? null,
    amount: order.amount,
    currency: order.currency,
    failure_code: input.failureCode ?? null,
    failure_message: input.failureMessage ?? null,
  } as never);
}

async function audit(
  db: Db,
  userId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await db.from("audit_logs").insert({
    user_id: userId,
    actor_type: "system",
    action,
    entity_type: "payment_order",
    entity_id: entityId,
    metadata: metadata as never,
  } as never);
  if (error) console.error("[payment audit]", action, error.message);
}

/**
 * Payment notifications go through the shared preference-aware writer, so a
 * user who switched payment confirmations off never receives one, and a
 * replayed webhook never produces a second row.
 */
async function notify(
  db: Db,
  userId: string,
  input: {
    type: "payment_success" | "payment_failed";
    title: string;
    body: string;
    dedupeKey: string;
    billId?: string | null;
    transactionId?: string | null;
  },
): Promise<void> {
  const { notifyUser } = await import("@/lib/notify.server");
  await notifyUser(
    db as never,
    userId,
    {
      type: input.type,
      title: input.title,
      body: input.body,
      dedupeKey: input.dedupeKey,
      billId: input.billId ?? null,
      transactionId: input.transactionId ?? null,
    },
    { channel: "payment_confirmations", schedule: "notify_payment_recorded" },
  );
}

export type SettlementOutcome = {
  state: PaymentState;
  settled: boolean;
  duplicate: boolean;
  message?: string;
};

/**
 * The ONLY path that marks a bill instalment paid.
 *
 * Requires a provider-confirmed captured payment whose amount and currency
 * match the authoritative order. Idempotent: a duplicate call (retry, replayed
 * webhook, reconciliation after the webhook) creates no second transaction —
 * a unique index on `transactions.bill_occurrence_id` is the backstop.
 */
export async function settleCapturedPayment(
  db: Db,
  order: PaymentOrderRow,
  payment: ProviderPayment,
): Promise<SettlementOutcome> {
  if (!amountsMatch(Number(order.amount), Number(payment.amount))) {
    await applyOrderState(db, order, "UNKNOWN", {
      failure_code: "AMOUNT_MISMATCH",
      failure_message: "Provider amount does not match the bill instalment amount.",
    });
    await audit(db, order.user_id, "payment.amount_mismatch", order.id, {
      expected: order.amount,
      provider_minor: payment.amount,
    });
    return { state: "UNKNOWN", settled: false, duplicate: false, message: "AMOUNT_MISMATCH" };
  }
  if (payment.currency && payment.currency !== order.currency) {
    await applyOrderState(db, order, "UNKNOWN", {
      failure_code: "CURRENCY_MISMATCH",
      failure_message: "Provider currency does not match the payment order.",
    });
    return { state: "UNKNOWN", settled: false, duplicate: false, message: "CURRENCY_MISMATCH" };
  }

  await upsertAttempt(db, order, {
    providerPaymentId: payment.id,
    status: "CAPTURED",
    method: payment.method ?? null,
  });

  // Already settled by an earlier event → nothing more to do.
  if (order.status === "CAPTURED" && order.transaction_id) {
    return { state: "CAPTURED", settled: true, duplicate: true };
  }

  const { data: occurrence, error: occError } = await db
    .from("bill_occurrences")
    .select("*, bill:bills(title, category)")
    .eq("id", order.bill_occurrence_id)
    .maybeSingle();
  if (occError) throw new Error(occError.message);
  if (!occurrence) throw new Error("Bill instalment no longer exists.");

  const bill = (occurrence as { bill?: { title?: string; category?: string } | null }).bill ?? null;
  const paidOn = new Date().toISOString();

  // Idempotent transaction creation: the partial unique index guarantees one
  // bill_payment transaction per instalment even under concurrent webhooks.
  let transactionId: string | null = null;
  const { data: txn, error: txnError } = await db
    .from("transactions")
    .insert({
      user_id: order.user_id,
      type: "bill_payment",
      amount: Number(order.amount),
      category: bill?.category ?? "general",
      description: bill?.title ?? "Bill payment",
      date: paidOn.slice(0, 10),
      status: "completed",
      payment_method: payment.method ?? "upi",
      external_reference: payment.id,
      bill_occurrence_id: order.bill_occurrence_id,
      notes: `${PROVIDER}:${payment.id}`,
    } as never)
    .select("id")
    .single();

  let duplicate = false;
  if (txnError) {
    if (!/duplicate key|unique constraint/i.test(txnError.message))
      throw new Error(txnError.message);
    duplicate = true;
    const { data: existing } = await db
      .from("transactions")
      .select("id")
      .eq("bill_occurrence_id", order.bill_occurrence_id)
      .eq("type", "bill_payment")
      .maybeSingle();
    transactionId = existing?.id ?? null;
  } else {
    transactionId = txn.id;
  }

  const { error: occUpdateError } = await db
    .from("bill_occurrences")
    .update({
      status: "paid",
      actual_amount: Number(order.amount),
      paid_at: paidOn,
      transaction_id: transactionId,
    } as never)
    .eq("id", order.bill_occurrence_id);

  if (occUpdateError) {
    // Never leave a transaction without a paid instalment: roll the money row
    // back unless it already existed before this call.
    if (!duplicate && transactionId) {
      await db.from("transactions").delete().eq("id", transactionId);
    }
    throw new Error(occUpdateError.message);
  }

  await applyOrderState(db, order, "CAPTURED", {
    captured_at: paidOn,
    transaction_id: transactionId,
    failure_code: null,
    failure_message: null,
  });

  await audit(db, order.user_id, "payment.captured", order.id, {
    provider_payment_id: payment.id,
    amount: order.amount,
    duplicate,
  });
  await notify(db, order.user_id, {
    type: "payment_success",
    title: "Payment successful",
    body: `${bill?.title ?? "Your bill"} — ${order.currency} ${Number(order.amount).toFixed(2)} paid.`,
    dedupeKey: `payment_captured:${order.id}`,
    transactionId: transactionId,
  });

  return { state: "CAPTURED", settled: true, duplicate };
}

/** Record a provider-reported failure. The instalment stays unpaid. */
export async function recordFailure(
  db: Db,
  order: PaymentOrderRow,
  payment: Partial<ProviderPayment> & { id?: string | null },
  state: Extract<PaymentState, "FAILED" | "CANCELLED" | "EXPIRED">,
): Promise<SettlementOutcome> {
  await upsertAttempt(db, order, {
    providerPaymentId: payment.id ?? null,
    status: state,
    method: payment.method ?? null,
    failureCode: payment.error_code ?? state,
    failureMessage: payment.error_description ?? null,
  });
  const applied = await applyOrderState(db, order, state, {
    failure_code: payment.error_code ?? state,
    failure_message: payment.error_description ?? null,
  });
  await audit(db, order.user_id, `payment.${state.toLowerCase()}`, order.id, {
    provider_payment_id: payment.id ?? null,
  });
  await notify(db, order.user_id, {
    type: "payment_failed",
    title: state === "FAILED" ? "Payment failed" : `Payment ${state.toLowerCase()}`,
    body:
      payment.error_description ??
      `Your payment of ${order.currency} ${Number(order.amount).toFixed(2)} did not go through. The bill is still unpaid.`,
    dedupeKey: `payment_${state.toLowerCase()}:${order.id}:${payment.id ?? "none"}`,
  });
  return { state: applied.state, settled: false, duplicate: !applied.applied };
}

/** Record a refund against a captured payment and reverse it in the ledger. */
export async function recordRefund(
  db: Db,
  order: PaymentOrderRow,
  input: { refundedMinor: number; providerPaymentId: string | null; refundId: string },
): Promise<SettlementOutcome> {
  const refundedMajor = Math.round(input.refundedMinor) / 100;
  if (Number(order.refunded_amount) >= refundedMajor) {
    return { state: orderState(order), settled: false, duplicate: true };
  }

  const delta = refundedMajor - Number(order.refunded_amount);
  const full = refundedMajor >= Number(order.amount);

  const { error: refundTxnError } = await db.from("transactions").insert({
    user_id: order.user_id,
    type: "refund",
    amount: delta,
    category: "refund",
    description: "Bill payment refund",
    date: new Date().toISOString().slice(0, 10),
    status: "completed",
    payment_method: "upi",
    external_reference: input.refundId,
    // Unique per (user_id, client_request_id): two concurrent refund events for
    // the same provider refund can never create two ledger rows.
    client_request_id: `refund:${input.refundId}`,
    notes: `${PROVIDER}:refund:${input.refundId}`,
  } as never);
  if (refundTxnError && !/duplicate key/i.test(refundTxnError.message)) {
    throw new Error(refundTxnError.message);
  }

  await applyOrderState(db, order, full ? "REFUNDED" : orderState(order), {
    refunded_amount: refundedMajor,
  });

  if (full) {
    // A fully refunded instalment is no longer settled.
    await db
      .from("bill_occurrences")
      .update({
        status: "pending",
        paid_at: null,
        actual_amount: null,
        transaction_id: null,
      } as never)
      .eq("id", order.bill_occurrence_id);
  }

  await audit(db, order.user_id, "payment.refunded", order.id, {
    refund_id: input.refundId,
    refunded_amount: refundedMajor,
    full,
  });
  return { state: full ? "REFUNDED" : orderState(order), settled: false, duplicate: false };
}

/**
 * Bring one order in line with the provider's authoritative view.
 * Used by the callback verifier, the "Check status" button and the webhook.
 */
export async function reconcileOrderWithProvider(
  db: Db,
  order: PaymentOrderRow,
): Promise<SettlementOutcome> {
  const { fetchOrderPayments } = await import("./provider.server");
  if (!order.provider_order_id) {
    return { state: orderState(order), settled: false, duplicate: false, message: "NO_ORDER_ID" };
  }

  const payments = await fetchOrderPayments(order.provider_order_id);
  const captured = payments.find((p) => p.status === "captured");
  if (captured) return settleCapturedPayment(db, order, captured);

  const authorized = payments.find((p) => p.status === "authorized");
  if (authorized) {
    await upsertAttempt(db, order, {
      providerPaymentId: authorized.id,
      status: "AUTHORIZED",
      method: authorized.method ?? null,
    });
    const applied = await applyOrderState(db, order, "AUTHORIZED");
    return { state: applied.state, settled: false, duplicate: false };
  }

  const failed = payments.find((p) => p.status === "failed");
  if (failed) return recordFailure(db, order, failed, "FAILED");

  const expired = order.expires_at ? new Date(order.expires_at).getTime() < Date.now() : false;
  if (expired) return recordFailure(db, order, {}, "EXPIRED");

  const state = orderState(order);
  return { state, settled: false, duplicate: false, message: "STILL_PENDING" };
}

export { mapRazorpayPaymentStatus };
