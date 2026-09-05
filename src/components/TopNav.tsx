import { Link } from "@tanstack/react-router";
import { Bell, LogOut, Receipt, Shield } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listNotifications } from "@/lib/notifications.functions";
import { NAV_ITEMS } from "./nav-items";
import { useAuth } from "@/hooks/useAuth";
import { useAdminSession } from "@/hooks/useAdminSession";

export function TopNav() {
  const { isAuthenticated, signOut } = useAuth();
  const { isAdmin } = useAdminSession({ enabled: isAuthenticated });
  const fetchNotifications = useServerFn(listNotifications);
  // Unread count refreshes periodically so automated reminders show up
  // without the user reloading the page.
  const { data } = useQuery({
    queryKey: ["notifications", "list"],
    queryFn: () => fetchNotifications(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const unread = data?.unread ?? 0;

  return (
    <header className="sticky top-0 z-20 border-b border-border-light bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-text-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
            <Receipt className="h-4 w-4" />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">PocketPilot</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-xl px-3 py-1.5 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
              activeProps={{ className: "bg-lilac/45 !text-primary" }}
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/settings"
            className="rounded-xl px-3 py-1.5 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
            activeProps={{ className: "bg-lilac/45 !text-primary" }}
          >
            Settings
          </Link>
        </nav>
        {isAuthenticated ? (
          <div className="flex items-center gap-2">
            {isAdmin ? (
              <Link
                to="/admin"
                aria-label="Operations"
                className="flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary transition-colors hover:text-primary"
                activeProps={{ className: "bg-lilac/45 !text-primary" }}
              >
                <Shield className="h-[18px] w-[18px]" />
              </Link>
            ) : null}
            <Link
              to="/notifications"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-text-secondary transition-colors hover:text-primary"
              activeProps={{ className: "bg-lilac/45 !text-primary" }}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unread > 0 ? (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white"
                  aria-hidden
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <button onClick={() => void signOut()} className="btn btn-secondary !min-h-11 !text-xs">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        ) : (
          <Link to="/login" className="btn btn-primary !min-h-11 !text-xs">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
