import { Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  CreditCard,
  Database,
  HelpCircle,
  LogOut,
  Palette,
  Shield,
  Tags,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAccount } from "@/hooks/useAccount";
import { displayName, initials } from "@/lib/format";
import { Avatar } from "@/components/Avatar";

const SECTIONS: {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}[] = [
  {
    to: "/settings/appearance",
    label: "Appearance & locale",
    hint: "Theme, motion, currency, timezone",
    icon: Palette,
  },
  {
    to: "/settings/money",
    label: "Money & budgets",
    hint: "Income, balance, budget defaults",
    icon: Wallet,
  },
  {
    to: "/settings/notifications",
    label: "Notifications",
    hint: "Reminders, alerts and summaries",
    icon: Bell,
  },
  { to: "/settings/categories", label: "Categories", hint: "Your custom labels", icon: Tags },
  {
    to: "/settings/payments",
    label: "Payments",
    hint: "Default UPI ID and checkout status",
    icon: CreditCard,
  },
  {
    to: "/settings/security",
    label: "Security",
    hint: "Email, sessions, recent activity",
    icon: Shield,
  },
  {
    to: "/settings/data",
    label: "Privacy & data",
    hint: "Export, clear data, delete account",
    icon: Database,
  },
  { to: "/settings/help", label: "Help & about", hint: "Support, legal, version", icon: HelpCircle },
];

/** Settings hub — every section is a real screen with working controls. */
export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { overview } = useAccount();
  const profile = overview?.profile as { full_name: string | null } | null | undefined;

  return (
    <section className="animate-fade-in pb-8">
      <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Settings</h1>

      <Link to="/profile" className="card card-hover mt-5 flex items-center gap-4 p-5">
        <Avatar fallback={initials(profile?.full_name ?? user?.email)} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">
            {profile?.full_name?.trim() || displayName(user?.email)}
          </p>
          <p className="truncate text-[13px] text-text-secondary">
            {user?.email ?? "Not signed in"}
          </p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-text-tertiary" />
      </Link>

      <nav className="card mt-6 p-2">
        {SECTIONS.map(({ to, label, hint, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-2xl px-3 py-3 transition-colors hover:bg-muted"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-soft-blue text-primary">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-text-primary">{label}</span>
              <span className="block truncate text-[13px] text-text-tertiary">{hint}</span>
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-text-tertiary" />
          </Link>
        ))}
      </nav>

      <button className="btn btn-secondary mt-6 w-full" onClick={() => void signOut()}>
        <LogOut className="h-[18px] w-[18px]" /> Sign out
      </button>
    </section>
  );
}
