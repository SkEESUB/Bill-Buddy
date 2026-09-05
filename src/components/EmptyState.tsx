import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Centered icon + copy used whenever a list has nothing to show. */
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-soft-blue text-primary">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <h2 className="mt-4 text-[17px] font-semibold text-text-primary">{title}</h2>
      <p className="mt-1.5 max-w-xs text-sm text-text-secondary">{subtitle}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
