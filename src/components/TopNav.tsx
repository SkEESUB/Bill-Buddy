import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Receipt, Search, Plus } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserMenu } from "@/components/UserMenu";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";
import { QuickAddModal } from "@/components/QuickAddModal";

export function TopNav() {
  const { isAuthenticated } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const routerState = useRouterState();
  const path = routerState.location.pathname;

  const pageTitles: Record<string, string> = {
    "/": "Dashboard",
    "/bills": "Bills & Subscriptions",
    "/money": "Money & Transactions",
    "/money/budgets": "Budgets & Limits",
    "/goals": "Financial Goals",
    "/insights": "Analytics & Insights",
    "/notifications": "Notifications",
    "/profile": "Account & Profile",
    "/settings": "General Settings",
  };

  const currentTitle = pageTitles[path] || "BillBuddy";

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-border-light/80 bg-surface/90 backdrop-blur-md">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Mobile Brand Logo (< lg) */}
          <div className="flex items-center gap-3 lg:hidden">
            <Link to="/" className="flex items-center gap-2.5 font-semibold text-text-primary group">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-white shadow-xs transition-transform group-hover:scale-105">
                <Receipt className="h-4 w-4" />
              </span>
              <span className="text-[17px] font-extrabold tracking-tight">BillBuddy</span>
            </Link>
          </div>

          {/* Desktop Current Page Title (>= lg) */}
          <div className="hidden lg:flex items-center gap-2">
            <h1 className="text-sm font-bold text-text-primary tracking-tight">
              {currentTitle}
            </h1>
          </div>

          {/* Right Action Icons */}
          <div className="flex items-center gap-2">
            {/* Search Button */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-border-light text-text-secondary hover:text-text-primary hover:border-primary/40 hover:bg-muted transition-colors cursor-pointer"
              aria-label="Search"
              title="Search (Ctrl+K)"
            >
              <Search className="h-4 w-4" />
            </button>

            {isAuthenticated ? (
              <>
                {/* Desktop Quick Add Button */}
                <button
                  type="button"
                  onClick={() => setQuickAddOpen(true)}
                  className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-primary text-white text-xs font-semibold shadow-xs hover:bg-primary-deep transition-colors cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Add</span>
                </button>

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

      {/* Global Search Modal */}
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Quick Add Modal */}
      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}
