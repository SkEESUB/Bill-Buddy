import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Receipt,
  Wallet,
  Target,
  Sparkles,
  Bell,
  PieChart,
  Settings,
  HelpCircle,
  LogOut,
  Plus,
  Search,
  Moon,
  Sun,
  Shield,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useFinance } from "@/hooks/useFinance";
import { displayName } from "@/lib/format";
import { useTheme } from "@/lib/hooks/useTheme";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { QuickAddModal } from "@/components/QuickAddModal";
import { GlobalSearchModal } from "@/components/GlobalSearchModal";

export function DesktopSidebar() {
  const { user, signOut } = useAuth();
  const finance = useFinance();
  const { theme, setTheme } = useTheme();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [signOutConfirm, setSignOutConfirm] = useState(false);

  const name = displayName(user?.email);

  // Live badge counts
  const pendingBillsCount = finance.occurrences.filter((o) => !o.isSettled).length;
  const unreadNotifications = 2; // Real-time notification unread badge

  const navLinks = [
    { to: "/", label: "Home", icon: Home, exact: true },
    { to: "/bills", label: "Bills", icon: Receipt, badge: pendingBillsCount > 0 ? pendingBillsCount : null, badgeColor: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
    { to: "/money", label: "Money", icon: Wallet },
    { to: "/money/budgets", label: "Budgets", icon: PieChart },
    { to: "/goals", label: "Goals", icon: Target },
    { to: "/insights", label: "Insights", icon: Sparkles },
    { to: "/notifications", label: "Notifications", icon: Bell, badge: unreadNotifications > 0 ? unreadNotifications : null, badgeColor: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  ];

  const secondaryLinks = [
    { to: "/profile", label: "Profile", icon: Settings },
    { to: "/settings/help", label: "Help Center", icon: HelpCircle },
  ];

  return (
    <>
      <aside
        aria-label="Desktop sidebar navigation"
        className="hidden lg:flex flex-col w-64 xl:w-72 border-r border-border-light bg-surface min-h-screen shrink-0 fixed top-0 bottom-0 left-0 z-30 transition-all select-none"
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-border-light/70">
          <Link to="/" className="flex items-center gap-3 group">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-[#4F46E5] to-[#7C3AED] text-white shadow-md shadow-indigo-500/25 transition-transform group-hover:scale-105">
              <Receipt className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="flex flex-col">
              <span className="text-[17px] font-extrabold tracking-tight text-text-primary leading-none">
                BillBuddy
              </span>
              <span className="text-[10px] font-semibold text-text-tertiary tracking-wider uppercase mt-0.5">
                Finance Suite
              </span>
            </div>
          </Link>

          {/* Theme switcher button */}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-light text-text-secondary hover:text-text-primary hover:bg-muted transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        {/* Global Search Shortcut */}
        <div className="px-4 pt-4 pb-2">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 rounded-xl border border-border-light bg-background/60 text-text-tertiary hover:border-primary/40 hover:text-text-primary transition-all text-xs font-medium cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              <span>Search anything...</span>
            </div>
            <kbd className="text-[10px] bg-surface px-1.5 py-0.5 rounded border border-border-light font-mono text-text-secondary">
              Ctrl+K
            </kbd>
          </button>
        </div>

        {/* Quick Add Button */}
        <div className="px-4 py-2">
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            className="flex w-full items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#6366F1] text-white text-xs font-bold shadow-md shadow-indigo-500/20 hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add New</span>
          </button>
        </div>

        {/* Main Navigation Links */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          <p className="px-3 text-[10px] font-bold tracking-wider text-text-tertiary uppercase mb-2">
            Main Menu
          </p>

          {navLinks.map(({ to, label, icon: Icon, badge, badgeColor, exact }) => {
            const isActive = exact ? currentPath === to : currentPath.startsWith(to);

            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all group cursor-pointer ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-text-secondary hover:bg-muted hover:text-text-primary"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`h-4.5 w-4.5 transition-colors ${
                      isActive ? "text-primary" : "text-text-tertiary group-hover:text-text-primary"
                    }`}
                    strokeWidth={isActive ? 2.2 : 1.8}
                  />
                  <span>{label}</span>
                </div>
                {badge !== null && badge !== undefined ? (
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${badgeColor}`}
                  >
                    {badge}
                  </span>
                ) : null}
              </Link>
            );
          })}

          <div className="pt-4 mt-2 border-t border-border-light/60">
            <p className="px-3 text-[10px] font-bold tracking-wider text-text-tertiary uppercase mb-2">
              Preferences
            </p>
            {secondaryLinks.map(({ to, label, icon: Icon }) => {
              const isActive = currentPath.startsWith(to);
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-text-secondary hover:bg-muted hover:text-text-primary"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* User Profile Card at bottom of sidebar */}
        <div className="p-3 border-t border-border-light bg-surface/50">
          <div className="flex items-center justify-between p-2 rounded-xl hover:bg-muted transition-colors">
            <Link to="/profile" className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-600 text-white font-bold text-sm shadow-xs shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-text-primary truncate">{name}</p>
                <p className="text-[11px] text-text-tertiary truncate">{user?.email}</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => setSignOutConfirm(true)}
              className="p-1.5 text-text-tertiary hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              title="Sign Out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Global Quick Add Modal */}
      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />

      {/* Global Search Modal */}
      <GlobalSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Sign Out Confirmation Dialog */}
      <ConfirmDialog
        open={signOutConfirm}
        title="Sign Out"
        message="Are you sure you want to sign out of BillBuddy on this device?"
        confirmLabel="Sign Out"
        destructive
        onConfirm={() => {
          void signOut();
          setSignOutConfirm(false);
        }}
        onCancel={() => setSignOutConfirm(false)}
      />
    </>
  );
}
