import { Link } from "@tanstack/react-router";
import { LogOut, Receipt, Shield } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { useAuth } from "@/hooks/useAuth";
import { useAdminSession } from "@/hooks/useAdminSession";
import { NotificationBell } from "@/components/layout/NotificationBell";

export function TopNav() {
  const { isAuthenticated, signOut } = useAuth();
  const { isAdmin } = useAdminSession({ enabled: isAuthenticated });

  return (
    <header className="sticky top-0 z-20 border-b border-border-light bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-text-primary">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-[var(--shadow-primary)]">
            <Receipt className="h-4 w-4" />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">BillBuddy</span>
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
            <NotificationBell />
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
