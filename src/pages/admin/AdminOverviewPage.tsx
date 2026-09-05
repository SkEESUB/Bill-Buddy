import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSystemHealth } from "@/lib/admin.functions";
import { DataCard, Loading, StatusPill } from "./ui";

/** System status at a glance: every dependency the app needs to work. */
export function AdminOverviewPage() {
  const fetchHealth = useServerFn(getSystemHealth);
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "health"],
    queryFn: () => fetchHealth(),
    refetchInterval: 60_000,
  });

  if (isLoading) return <Loading />;
  if (!data) return <p className="text-sm text-text-secondary">Health data unavailable.</p>;

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <div>
          <p className="text-[13px] text-text-secondary">Overall status</p>
          <p className="text-xl font-bold text-text-primary">PocketPilot platform</p>
        </div>
        <StatusPill status={data.overall} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Active accounts", value: data.metrics.users },
          { label: "Open tickets", value: data.metrics.openTickets },
          { label: "Unread notifications", value: data.metrics.unreadNotifications },
        ].map((m) => (
          <div key={m.label} className="card p-5">
            <p className="text-[13px] text-text-secondary">{m.label}</p>
            <p className="mt-1 text-2xl font-bold text-text-primary">{m.value}</p>
          </div>
        ))}
      </div>

      <DataCard title="Components">
        <ul className="divide-y divide-border">
          {data.checks.map((check) => (
            <li key={check.component} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm font-semibold text-text-primary">{check.component}</p>
                <p className="text-[13px] text-text-secondary">{check.detail}</p>
              </div>
              <StatusPill status={check.status} />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-text-secondary">
          Checked {new Date(data.generatedAt).toLocaleTimeString()}
        </p>
      </DataCard>
    </div>
  );
}