import { Link } from "@tanstack/react-router";
import { Receipt } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserMenu } from "@/components/UserMenu";

export function TopNav() {
  const { isAuthenticated } = useAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-border-light/80 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo */}
        <Link to="/" className="flex items-center gap-2.5 font-semibold text-text-primary group">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
            <Receipt className="h-4 w-4" />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight">BillBuddy</span>
        </Link>

        {/* Desktop Navigation Links */}
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-lg px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:text-text-primary hover:bg-muted"
              activeProps={{ className: "bg-lilac/50 !text-primary font-bold" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Right Action Icons: Notification Bell & User Avatar Menu */}
        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <NotificationBell />
              <UserMenu />
            </>
          ) : (
            <Link to="/login" className="btn btn-primary !min-h-9 !py-1 !px-3.5 !text-xs">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
