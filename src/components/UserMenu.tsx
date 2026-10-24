import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  User,
  Settings,
  Shield,
  LogOut,
  Moon,
  Sun,
  Laptop,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { useAdminSession } from "@/hooks/useAdminSession";
import { useTheme } from "@/lib/hooks/useTheme";
import { displayName, initials } from "@/lib/format";
import { Avatar } from "@/components/Avatar";

export function UserMenu() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user, signOut } = useAuth();
  const { overview } = useAccount();
  const { isAdmin } = useAdminSession({ enabled: !!user });
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const profile = overview?.profile as { full_name: string | null } | null | undefined;
  const name = profile?.full_name?.trim() || displayName(user?.email);
  const userInitials = initials(name || user?.email);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    void navigate({ to: "/login" });
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-full p-0.5 ring-offset-background transition-all hover:ring-2 hover:ring-primary/40 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="User account menu"
      >
        <Avatar fallback={userInitials} size={36} />
      </button>

      {open && (
        <div
          role="menu"
          className="animate-scale-in absolute right-0 top-full mt-2 w-64 origin-top-right rounded-2xl border border-border-light bg-surface p-2 shadow-xl ring-1 ring-black/5 z-50"
        >
          {/* User Info Header */}
          <div className="px-3 py-2.5 border-b border-border-light mb-1">
            <div className="flex items-center gap-2">
              <Avatar fallback={userInitials} size={32} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text-primary leading-tight">
                  {name}
                </p>
                <p className="truncate text-xs text-text-secondary mt-0.5">
                  {user?.email}
                </p>
              </div>
            </div>
            {isAdmin && (
              <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <Shield className="h-3 w-3" /> Admin
              </span>
            )}
          </div>

          {/* Links */}
          <div className="py-1 space-y-0.5">
            <Link
              to="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-muted"
              role="menuitem"
            >
              <User className="h-4 w-4 text-text-secondary" />
              Your Profile
            </Link>

            <Link
              to="/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-muted"
              role="menuitem"
            >
              <Settings className="h-4 w-4 text-text-secondary" />
              Settings & Preferences
            </Link>

            {isAdmin && (
              <Link
                to="/admin"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-muted"
                role="menuitem"
              >
                <Shield className="h-4 w-4 text-text-secondary" />
                Admin Console
              </Link>
            )}
          </div>

          {/* Theme Quick Selector */}
          <div className="border-t border-border-light my-1 pt-1.5 px-3">
            <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
              Appearance
            </p>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1 text-[11px]">
              <button
                type="button"
                onClick={() => setTheme("light")}
                className={`flex items-center justify-center gap-1 rounded-lg py-1 transition-all cursor-pointer ${
                  theme === "light"
                    ? "bg-surface font-semibold text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Sun className="h-3 w-3" /> Light
              </button>
              <button
                type="button"
                onClick={() => setTheme("dark")}
                className={`flex items-center justify-center gap-1 rounded-lg py-1 transition-all cursor-pointer ${
                  theme === "dark"
                    ? "bg-surface font-semibold text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Moon className="h-3 w-3" /> Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme("system")}
                className={`flex items-center justify-center gap-1 rounded-lg py-1 transition-all cursor-pointer ${
                  theme === "system"
                    ? "bg-surface font-semibold text-primary shadow-sm"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                <Laptop className="h-3 w-3" /> Auto
              </button>
            </div>
          </div>

          {/* Sign Out */}
          <div className="border-t border-border-light mt-1 pt-1">
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-status-error transition-colors hover:bg-soft-red/60 cursor-pointer"
              role="menuitem"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
