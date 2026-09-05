import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLogs } from "@/lib/admin.functions";
import { ADMIN_ACTIONS } from "@/lib/admin/permissions";
import { formatDateTime } from "@/lib/format";
import { DataCard, Loading } from "./ui";

/** The immutable record of who did what. Nothing here can be edited or deleted. */
export function AdminAuditPage() {
  const fetchLogs = useServerFn(listAuditLogs);
  const [action, setAction] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "audit", action],
    queryFn: () => fetchLogs({ data: action ? { action } : {} }),
  });

  return (
    <DataCard title="Audit trail">
      <select
        className="input mb-4"
        value={action}
        onChange={(e) => setAction(e.target.value)}
        aria-label="Filter by action"
      >
        <option value="">All actions</option>
        {["ADMIN_ACCESS_DENIED", ...ADMIN_ACTIONS].map((a) => (
          <option key={a} value={a}>
            {a.replace(/_/g, " ").toLowerCase()}
          </option>
        ))}
      </select>

      {isLoading ? (
        <Loading />
      ) : (data?.length ?? 0) === 0 ? (
        <p className="text-sm text-text-secondary">No records for this filter.</p>
      ) : (
        <ul className="divide-y divide-border">
          {data?.map((log) => (
            <li key={log.id} className="py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-text-primary">
                  {log.action.replace(/_/g, " ").toLowerCase()}
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                    log.result === "denied" || log.result === "error"
                      ? "bg-error/10 text-error"
                      : "bg-success/10 text-success"
                  }`}
                >
                  {log.result ?? "success"}
                </span>
              </div>
              <p className="text-[12px] text-text-secondary">
                {formatDateTime(log.created_at)} · {log.actor_role ?? log.actor_type} ·{" "}
                {log.entity_type}
                {log.entity_id ? ` ${log.entity_id.slice(0, 8)}` : ""}
              </p>
              {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                <pre className="mt-1 overflow-x-auto rounded-xl bg-surface p-2 text-[11px] text-text-secondary">
                  {JSON.stringify(log.metadata, null, 1)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  );
}