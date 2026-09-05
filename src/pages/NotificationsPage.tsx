import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Bell, CheckCheck, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  clearNotifications,
  deleteNotification,
  listNotifications,
  markAllNotificationsRead,
  setNotificationRead,
} from "@/lib/notifications.functions";
import { formatDateTime } from "@/lib/format";
import { usePreferences } from "@/lib/preferences";
import { toUserMessage } from "@/lib/errors";
import { EmptyState } from "@/components/EmptyState";
import { notificationLink } from "@/lib/scheduler";

export const NOTIFICATIONS_KEY = ["notifications", "list"] as const;

/** In-app notification centre backed by real rows. */
export function NotificationsPage() {
  const fetchAll = useServerFn(listNotifications);
  const markRead = useServerFn(setNotificationRead);
  const markAll = useServerFn(markAllNotificationsRead);
  const removeOne = useServerFn(deleteNotification);
  const clearAll = useServerFn(clearNotifications);
  const queryClient = useQueryClient();
  const { timezone } = usePreferences();

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

  return (
    <section className="animate-fade-in pb-8">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Notifications</h1>
          <p className="text-[13px] text-text-secondary">
            {data?.unread ? `${data.unread} unread` : "You're all caught up"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-secondary !min-h-10 !px-3 !text-xs"
            disabled={!data?.unread || allRead.isPending}
            onClick={() => allRead.mutate()}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
          <button
            type="button"
            className="btn !min-h-10 !px-3 !text-xs bg-soft-red !text-error"
            disabled={rows.length === 0 || clear.isPending}
            onClick={() => clear.mutate()}
            aria-label="Clear all notifications"
            title="Clear all notifications"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="card mt-5 flex items-center justify-center p-10 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="mt-5">
          <EmptyState
            icon={Bell}
            title="Nothing here yet"
            subtitle="Bill reminders, budget alerts and payment confirmations will appear here."
          />
        </div>
      ) : (
        <div className="mt-5 space-y-2">
          {rows.map((n) => (
            <article
              key={n.id}
              className={`card flex items-start gap-3 p-4 ${n.read_at ? "opacity-70" : ""}`}
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-soft-blue text-primary">
                <Bell className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                {(() => {
                  const href = notificationLink(n);
                  const heading = (
                    <>
                      <p className="text-sm font-semibold text-text-primary">{n.title}</p>
                      {n.body ? <p className="text-[13px] text-text-secondary">{n.body}</p> : null}
                    </>
                  );
                  // Tapping a notification opens the thing it is about, and
                  // marks it read on the way.
                  return href ? (
                    <Link
                      to={href}
                      className="block text-left hover:opacity-80"
                      onClick={() => {
                        if (!n.read_at) toggle.mutate({ id: n.id, read: true });
                      }}
                    >
                      {heading}
                    </Link>
                  ) : (
                    heading
                  );
                })()}
                <p className="mt-1 text-[12px] text-text-tertiary">
                  {formatDateTime(n.created_at, timezone)}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  className="rounded-xl p-2 text-text-secondary hover:text-primary"
                  aria-label={n.read_at ? "Mark as unread" : "Mark as read"}
                  onClick={() => toggle.mutate({ id: n.id, read: !n.read_at })}
                >
                  <CheckCheck className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-xl p-2 text-error"
                  aria-label="Delete notification"
                  onClick={() => remove.mutate(n.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}