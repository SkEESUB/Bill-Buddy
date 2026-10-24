import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Bell,
  Check,
  CheckCheck,
  CheckCircle2,
  DollarSign,
  Loader2,
  PieChart,
  Receipt,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import {
  clearNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  setNotificationRead,
  type NotificationRow,
} from "@/lib/notifications.functions";
import { formatDateTime } from "@/lib/format";
import { usePreferences } from "@/lib/preferences";
import { toUserMessage } from "@/lib/errors";

export const NOTIFICATIONS_KEY = ["notifications", "list"] as const;

type FilterType = "all" | "bills" | "payments" | "budgets";

export function NotificationsPage() {
  const navigate = useNavigate();
  const fetchAll = useServerFn(listNotifications);
  const markRead = useServerFn(setNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const removeOne = useServerFn(deleteNotification);
  const clearAll = useServerFn(clearNotifications);
  const queryClient = useQueryClient();
  const { timezone } = usePreferences();

  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedNotification, setSelectedNotification] = useState<NotificationRow | null>(null);

  const { data, isLoading } = useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: () => fetchAll() });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
  const onError = (error: unknown) => toast.error(toUserMessage(error));

  const toggle = useMutation({
    mutationFn: (v: { id: string; read: boolean }) => markRead({ data: v }),
    onSuccess: invalidate,
    onError,
  });
  const allRead = useMutation({ mutationFn: () => markAll({ data: undefined }), onSuccess: invalidate, onError });
  const remove = useMutation({
    mutationFn: (id: string) => removeOne({ data: { id } }),
    onSuccess: invalidate,
    onError,
  });
  const clear = useMutation({
    mutationFn: () => clearAll({ data: undefined }),
    onSuccess: invalidate,
    onError,
  });

  const rows = data?.rows ?? [];

  const filteredRows = useMemo(() => {
    if (activeFilter === "all") return rows;
    if (activeFilter === "bills") {
      return rows.filter((r) => r.type.includes("bill") || r.type.includes("reminder") || r.related_bill_id);
    }
    if (activeFilter === "payments") {
      return rows.filter((r) => r.type.includes("payment") || r.related_transaction_id);
    }
    if (activeFilter === "budgets") {
      return rows.filter((r) => r.type.includes("budget") || r.type.includes("goal") || r.related_budget_id);
    }
    return rows;
  }, [rows, activeFilter]);

  const getIcon = (type: string) => {
    if (type.includes("bill") || type.includes("due")) {
      return <Zap className="h-5 w-5 text-amber-500" />;
    }
    if (type.includes("payment") || type.includes("success")) {
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    }
    if (type.includes("budget")) {
      return <PieChart className="h-5 w-5 text-rose-500" />;
    }
    if (type.includes("goal")) {
      return <Sparkles className="h-5 w-5 text-indigo-500" />;
    }
    return <Bell className="h-5 w-5 text-primary" />;
  };

  return (
    <section className="animate-fade-in max-w-3xl mx-auto space-y-5 pb-28">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">
            Notification Center
          </h1>
          <p className="text-xs text-text-secondary">
            {data?.unread ? `${data.unread} unread notifications` : "All caught up"}
          </p>
        </div>
        <div className="flex gap-2">
          {data?.unread ? (
            <button
              type="button"
              className="btn btn-secondary !min-h-9 !px-3 !text-xs cursor-pointer"
              disabled={allRead.isPending}
              onClick={() => allRead.mutate()}
            >
              <CheckCheck className="h-3.5 w-3.5" /> Mark read
            </button>
          ) : null}
          {rows.length > 0 && (
            <button
              type="button"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-light text-text-tertiary hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
              disabled={clear.isPending}
              onClick={() => {
                if (confirm("Clear all notifications?")) clear.mutate();
              }}
              title="Clear all"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Filter Tabs matching Phase 6 Screen 1 */}
      <div className="flex gap-2 border-b border-border-light/80 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-surface border border-border-light text-text-secondary hover:text-text-primary"
          }`}
        >
          All ({rows.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("bills")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeFilter === "bills"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-surface border border-border-light text-text-secondary hover:text-text-primary"
          }`}
        >
          Bills
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("payments")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeFilter === "payments"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-surface border border-border-light text-text-secondary hover:text-text-primary"
          }`}
        >
          Payments
        </button>
        <button
          type="button"
          onClick={() => setActiveFilter("budgets")}
          className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
            activeFilter === "budgets"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-surface border border-border-light text-text-secondary hover:text-text-primary"
          }`}
        >
          Budgets
        </button>
      </div>

      {isLoading ? (
        <div className="card flex items-center justify-center p-12 text-text-secondary">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : filteredRows.length === 0 ? (
        /* Empty State matching Phase 6 Screen 9 */
        <div className="card rounded-[32px] p-8 text-center shadow-xs border border-border-light my-6">
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500/10 text-primary">
            <Bell className="h-10 w-10 stroke-[2]" />
          </div>
          <h2 className="text-xl font-bold text-text-primary">All caught up!</h2>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
            You don't have any notifications right now. We'll alert you when a bill is due or a budget threshold is reached.
          </p>
          <div className="mt-5 flex justify-center">
            <Link
              to="/money"
              className="btn btn-secondary !rounded-full !px-5 text-xs font-semibold cursor-pointer"
            >
              Explore Budgets
            </Link>
          </div>
        </div>
      ) : (
        /* Notifications List matching Phase 6 Screen 1 */
        <div className="space-y-2.5">
          {filteredRows.map((n) => {
            const isUnread = !n.read_at;
            return (
              <div
                key={n.id}
                onClick={() => setSelectedNotification(n)}
                className={`card rounded-2xl p-4 flex items-start justify-between gap-3 transition-all hover:shadow-md cursor-pointer ${
                  isUnread
                    ? "border-primary/40 bg-primary/5"
                    : "border-border-light bg-surface"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface border border-border-light shadow-xs mt-0.5">
                    {getIcon(n.type)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-text-primary truncate">
                        {n.title}
                      </p>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2 mt-0.5">
                      {n.body}
                    </p>
                    <p className="text-[11px] text-text-tertiary mt-1.5">
                      {formatDateTime(n.created_at, timezone)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => toggle.mutate({ id: n.id, read: !n.read_at })}
                    className="p-1.5 text-text-tertiary hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                    title={isUnread ? "Mark as read" : "Mark as unread"}
                  >
                    <Check className={`h-4 w-4 ${isUnread ? "text-primary stroke-[2.5]" : ""}`} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(n.id)}
                    className="p-1.5 text-text-tertiary hover:text-rose-500 rounded-lg transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notification Details Sheet matching Phase 6 Screen 2 */}
      {selectedNotification && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm p-4 sm:items-center animate-fade-in"
          onClick={() => setSelectedNotification(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm rounded-[32px] border border-border-light bg-surface p-6 shadow-2xl animate-scale-in text-center"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Notification Details"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10">
              {getIcon(selectedNotification.type)}
            </div>

            <h3 className="text-xl font-bold text-text-primary">
              {selectedNotification.title}
            </h3>
            <p className="text-xs text-text-tertiary mt-1">
              {formatDateTime(selectedNotification.created_at, timezone)}
            </p>

            <div className="mt-4 rounded-2xl bg-muted/40 border border-border-light p-4 text-left">
              <p className="text-xs text-text-secondary leading-relaxed">
                {selectedNotification.body}
              </p>
            </div>

            <div className="mt-6 space-y-2.5">
              {selectedNotification.related_bill_id ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNotification(null);
                    void navigate({ to: "/bills" });
                  }}
                  className="btn btn-primary w-full !min-h-11 !rounded-2xl text-xs font-bold shadow-md cursor-pointer"
                >
                  Pay Now
                </button>
              ) : null}

              {!selectedNotification.read_at && (
                <button
                  type="button"
                  onClick={() => {
                    toggle.mutate({ id: selectedNotification.id, read: true });
                    setSelectedNotification(null);
                  }}
                  className="btn btn-secondary w-full !min-h-11 !rounded-2xl text-xs font-bold cursor-pointer"
                >
                  Mark as Read
                </button>
              )}

              <button
                type="button"
                onClick={() => setSelectedNotification(null)}
                className="text-xs font-semibold text-text-secondary hover:text-text-primary pt-1 cursor-pointer block mx-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
