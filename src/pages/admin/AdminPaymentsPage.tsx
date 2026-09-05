import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { listPaymentOrders, listWebhookEvents, reconcilePayment } from "@/lib/admin.functions";
import { currencySymbol, formatAmount, formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";
import { Can, DataCard, Loading } from "./ui";

/** Operational view of money movement: orders and provider webhooks. */
export function AdminPaymentsPage() {
  const fetchOrders = useServerFn(listPaymentOrders);
  const fetchEvents = useServerFn(listWebhookEvents);
  const reconcile = useServerFn(reconcilePayment);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("all");

  const orders = useQuery({
    queryKey: ["admin", "orders", status],
    queryFn: () => fetchOrders({ data: { status } }),
  });
  const events = useQuery({ queryKey: ["admin", "webhooks"], queryFn: () => fetchEvents() });

  const run = useMutation({
    mutationFn: (paymentOrderId: string) => reconcile({ data: { paymentOrderId } }),
    onSuccess: () => {
      toast.success("Reconciled against the provider");
      void queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-5">
      <DataCard title="Payment orders">
        <div className="mb-3 flex flex-wrap gap-2">
          {["all", "CREATED", "ORDER_CREATED", "CAPTURED", "FAILED", "REFUNDED"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                status === s ? "bg-primary text-white" : "bg-surface text-text-secondary"
              }`}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>

        {orders.isLoading ? (
          <Loading />
        ) : (orders.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-text-secondary">No payment orders yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {orders.data?.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">
                    {currencySymbol(order.currency)}
                    {formatAmount(Number(order.amount))} · {order.status}
                  </p>
                  <p className="text-[12px] text-text-secondary">
                    {formatDateTime(order.created_at)}
                    {order.failure_code ? ` · ${order.failure_code}` : ""}
                    {Number(order.refunded_amount) > 0
                      ? ` · refunded ${formatAmount(Number(order.refunded_amount))}`
                      : ""}
                  </p>
                </div>
                <Can permission="payments.reconcile">
                  <button
                    type="button"
                    className="btn btn-secondary !min-h-11 !px-3 !text-xs"
                    disabled={run.isPending}
                    onClick={() => run.mutate(order.id)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Reconcile
                  </button>
                </Can>
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <DataCard title="Provider webhooks">
        {events.isLoading ? (
          <Loading />
        ) : (events.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-text-secondary">No webhook events received.</p>
        ) : (
          <ul className="divide-y divide-border">
            {events.data?.map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{event.event_type}</p>
                  <p className="text-[12px] text-text-secondary">
                    {formatDateTime(event.created_at)}
                    {event.process_error ? ` · ${event.process_error}` : ""}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${
                    event.processed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                  }`}
                >
                  {event.processed ? "processed" : "pending"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}