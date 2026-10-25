import { createFileRoute } from "@tanstack/react-router";

/**
 * Razorpay webhook receiver — the authoritative settlement path.
 *
 * The browser can lie or simply disappear (closed tab, dead network) after a
 * successful payment, so money is only ever recognised here or in an explicit
 * server-side reconciliation. Every request must carry a valid HMAC signature
 * over the raw body; unverified payloads are rejected before any read.
 */
export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("x-razorpay-signature");

        const { verifyWebhookSignature, webhookConfigured } =
          await import("@/lib/payments/provider.server");
        if (!webhookConfigured()) {
          console.error("[payments:webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
          return new Response("Webhook not configured", { status: 503 });
        }
        if (!signature || !(await verifyWebhookSignature(raw, signature))) {
          return new Response("Invalid signature", { status: 401 });
        }

        let event: RazorpayWebhookEvent;
        try {
          event = JSON.parse(raw) as RazorpayWebhookEvent;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventType = typeof event.event === "string" ? event.event : "";
        const paymentEntity = event.payload?.payment?.entity ?? null;
        const refundEntity = event.payload?.refund?.entity ?? null;
        const providerOrderId = paymentEntity?.order_id ?? event.payload?.order?.entity?.id ?? null;
        // Razorpay's delivery id is stable across retries — our dedupe key.
        const eventId =
          request.headers.get("x-razorpay-event-id") ??
          `${eventType}:${paymentEntity?.id ?? refundEntity?.id ?? ""}`;

        const {
          adminDb,
          loadOrderByProviderOrderId,
          settleCapturedPayment,
          recordFailure,
          recordRefund,
          applyOrderState,
        } = await import("@/lib/payments/settle.server");

        const db = await adminDb();

        // Persist the raw event first: even an unmatched event stays auditable.
        // Only columns that exist on payment_events may be written here — an
        // unknown column makes every delivery fail and blocks settlement.
        const { data: eventRow, error: eventError } = await db
          .from("payment_events")
          .insert({
            provider: "razorpay",
            provider_event_id: eventId,
            event_type: eventType,
            provider_payment_id: paymentEntity?.id ?? null,
            payload: event as never,
          } as never)
          .select("id")
          .single();
        if (eventError) {
          // Unique violation = Razorpay retrying a delivery we already handled.
          if (/duplicate key|unique/i.test(eventError.message)) {
            return new Response("ok (duplicate)", { status: 200 });
          }
          console.error("[payments:webhook] event insert failed", eventError.message);
          return new Response("Storage error", { status: 500 });
        }

        if (!providerOrderId) {
          return new Response("ok (no order)", { status: 200 });
        }

        const order = await loadOrderByProviderOrderId(db, providerOrderId);
        if (!order) {
          console.warn("[payments:webhook] no local order for", providerOrderId);
          return new Response("ok (unmatched)", { status: 200 });
        }

        // Link the stored event to the local order now that it is known.
        if (eventRow?.id) {
          await db
            .from("payment_events")
            .update({ payment_order_id: order.id } as never)
            .eq("id", eventRow.id);
        }

        try {
          switch (eventType) {
            case "payment.captured":
            case "order.paid": {
              if (!paymentEntity) break;
              await settleCapturedPayment(db, order, {
                id: paymentEntity.id,
                order_id: paymentEntity.order_id ?? providerOrderId,
                status: "captured",
                amount: paymentEntity.amount,
                currency: paymentEntity.currency,
                method: paymentEntity.method ?? null,
                error_code: null,
                error_description: null,
              });
              break;
            }
            case "payment.authorized": {
              await applyOrderState(db, order, "AUTHORIZED");
              break;
            }
            case "payment.failed": {
              if (!paymentEntity) break;
              await recordFailure(
                db,
                order,
                {
                  id: paymentEntity.id,
                  order_id: paymentEntity.order_id ?? providerOrderId,
                  status: "failed",
                  amount: paymentEntity.amount,
                  currency: paymentEntity.currency,
                  method: paymentEntity.method ?? null,
                  error_code: paymentEntity.error_code ?? null,
                  error_description: paymentEntity.error_description ?? null,
                },
                "FAILED",
              );
              break;
            }
            case "refund.processed":
            case "refund.created": {
              if (!refundEntity) break;
              await recordRefund(db, order, {
                refundId: refundEntity.id,
                providerPaymentId: refundEntity.payment_id,
                refundedMinor: refundEntity.amount,
              });
              break;
            }
            default:
              break;
          }
        } catch (e) {
          console.error("[payments:webhook] handler failed", eventType, e);
          if (eventRow?.id) {
            await db
              .from("payment_events")
              .update({
                process_error: e instanceof Error ? e.message : String(e),
              } as never)
              .eq("id", eventRow.id);
          }
          // 500 makes Razorpay retry — better than silently losing a capture.
          return new Response("Processing error", { status: 500 });
        }

        if (eventRow?.id) {
          await db
            .from("payment_events")
            .update({ processed: true, processed_at: new Date().toISOString() } as never)
            .eq("id", eventRow.id);
        }
        return new Response("ok", { status: 200 });
      },
    },
  },
});

type RazorpayWebhookEvent = {
  event?: string;
  payload?: {
    payment?: {
      entity?: {
        id: string;
        order_id?: string | null;
        amount: number;
        currency: string;
        method?: string | null;
        error_code?: string | null;
        error_description?: string | null;
      };
    };
    order?: { entity?: { id: string } };
    refund?: {
      entity?: {
        id: string;
        payment_id: string;
        amount: number;
        status?: string;
      };
    };
  };
};
