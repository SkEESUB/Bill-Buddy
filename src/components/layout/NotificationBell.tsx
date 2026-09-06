// src/components/layout/NotificationBell.tsx
import { Bell } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listNotifications, markAllNotificationsRead } from "@/lib/notifications.functions";
import { formatRelativeDate } from "@/lib/utils/format-date";
import { Link } from "@tanstack/react-router";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    refetchInterval: 60_000, // poll every 60 seconds
  });

  const notifications = (Array.isArray(data) ? data : data?.rows ?? []) as Array<{
    id: string;
    title: string;
    body?: string | null;
    is_read?: boolean;
    read_at?: string | null;
    created_at: string;
  }>;

  const unreadCount =
    typeof data?.unread === "number"
      ? data.unread
      : notifications.filter((n) => !n.is_read && !n.read_at).length;

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl z-50 max-h-96 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification items */}
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500 dark:text-gray-400">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">You&apos;re all caught up!</p>
              </div>
            ) : (
              <div>
                {notifications.slice(0, 5).map((n) => {
                  const isRead = Boolean(n.read_at || n.is_read);
                  return (
                    <div
                      key={n.id}
                      className={`p-4 border-b border-gray-50 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                        !isRead ? "bg-indigo-50/30 dark:bg-indigo-950/20" : ""
                      }`}
                    >
                      <p
                        className={`text-sm ${
                          !isRead
                            ? "font-semibold text-gray-900 dark:text-white"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.body}</p>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {formatRelativeDate(n.created_at)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="p-3 border-t border-gray-100 dark:border-gray-800">
              <Link
                to="/notifications"
                onClick={() => setOpen(false)}
                className="block text-center text-sm text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                View all notifications →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
