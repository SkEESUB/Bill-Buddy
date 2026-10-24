import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { MOBILE_LEFT_ITEMS, MOBILE_RIGHT_ITEMS } from "./nav-items";
import { QuickAddModal } from "./QuickAddModal";

export function BottomNav() {
  const [quickAddOpen, setQuickAddOpen] = useState(false);

  return (
    <>
      <nav
        aria-label="Primary mobile navigation"
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 lg:hidden border-t border-border-light/80 bg-surface/95 backdrop-blur-md px-2 py-1.5 shadow-lg"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {/* Left items */}
          {MOBILE_LEFT_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
              activeProps={{
                className: "!text-primary font-semibold",
              }}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          ))}

          {/* Center Quick Add Floating Button */}
          <div className="flex flex-1 items-center justify-center -mt-4">
            <button
              type="button"
              onClick={() => setQuickAddOpen(true)}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-95 hover:brightness-110 cursor-pointer"
              aria-label="Quick Add"
            >
              <Plus className="h-6 w-6 stroke-[2.5]" />
            </button>
          </div>

          {/* Right items */}
          {MOBILE_RIGHT_ITEMS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              className="flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[11px] font-medium text-text-tertiary transition-colors hover:text-text-primary"
              activeProps={{
                className: "!text-primary font-semibold",
              }}
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <QuickAddModal open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </>
  );
}
