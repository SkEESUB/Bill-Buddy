import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Loader2, ShieldAlert } from "lucide-react";
import { roleLabel, type AdminPermission, type HealthStatus } from "@/lib/admin/permissions";
import { useAdminSession } from "@/hooks/useAdminSession";

const TABS: { to: string; label: string; permission: AdminPermission }[] = [
  { to: "/admin", label: "Overview", permission: "system.read" },
  { to: "/admin/users", label: "Users", permission: "users.read" },
  { to: "/admin/support", label: "Support", permission: "support.read" },
  { to: "/admin/payments", label: "Payments", permission: "payments.read" },
  { to: "/admin/system", label: "System", permission: "jobs.read" },
  { to: "/admin/audit", label: "Audit", permission: "audit.read" },
];

/** Shell for every admin screen: role banner, permission-aware tabs, guard. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { session, isAdmin, isLoading, can } = useAdminSession();
  const path = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Checking access">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-error" />
        <h1 className="mt-4 text-xl font-bold text-text-primary">Restricted area</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This area is limited to PocketPilot operators. Your account does not have an operations role.
        </p>
        <Link to="/" className="btn btn-secondary mt-5 inline-flex">
          Back to your dashboard
        </Link>
      </div>
    );
  }

  const visible = TABS.filter((tab) => can(tab.permission));

  return (
    <section className="animate-fade-in pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-text-primary">Operations</h1>
          <p className="text-[13px] text-text-secondary">
            Signed in as {roleLabel(session?.role ?? "user")} · every action here is recorded
          </p>
        </div>
      </header>

      <nav aria-label="Admin sections" className="mt-5 flex flex-wrap gap-2">
        {visible.map((tab) => {
          const active = tab.to === "/admin" ? path === "/admin" : path.startsWith(tab.to);
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                active
                  ? "bg-primary text-white shadow-sm"
                  : "bg-surface text-text-secondary hover:text-text-primary"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Renders children only when the caller holds the permission. */
export function Can({ permission, children }: { permission: AdminPermission; children: ReactNode }) {
  const { can } = useAdminSession();
  return can(permission) ? <>{children}</> : null;
}

export function StatusPill({ status }: { status: HealthStatus | string }) {
  const tone: Record<string, string> = {
    HEALTHY: "bg-success/10 text-success",
    DEGRADED: "bg-warning/10 text-warning",
    NOT_CONFIGURED: "bg-surface text-text-secondary",
    UNKNOWN: "bg-surface text-text-secondary",
    FAILING: "bg-error/10 text-error",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
        tone[status] ?? "bg-surface text-text-secondary"
      }`}
    >
      {String(status).replace(/_/g, " ").toLowerCase()}
    </span>
  );
}

export function DataCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="text-[15px] font-bold text-text-primary">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex justify-center py-10" role="status" aria-label="Loading">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}