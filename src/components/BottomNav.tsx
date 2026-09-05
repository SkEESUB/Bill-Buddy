import { Link } from "@tanstack/react-router";
import { NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  return (
    <nav
      aria-label="Primary mobile"
      className="safe-bottom fixed inset-x-3 bottom-3 z-20 rounded-[24px] border border-border-light/70 bg-surface py-2 shadow-[var(--neu-raised-lg)] sm:hidden"
    >
      <div className="flex items-stretch px-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: to === "/" }}
            className="mx-0.5 flex min-h-11 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 text-[11px] font-semibold text-text-tertiary transition-all"
            activeProps={{
              className: "bg-lilac/45 !text-primary shadow-[var(--neu-inset)]",
            }}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
