import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { listTickets } from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";
import { Loading } from "./ui";

const STATUSES = ["all", "open", "in_progress", "waiting_user", "resolved", "closed"];

/** The support inbox. */
export function AdminSupportPage() {
  const fetchTickets = useServerFn(listTickets);
  const [status, setStatus] = useState("open");
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "tickets", status],
    queryFn: () => fetchTickets({ data: { status } }),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              status === s ? "bg-primary text-white" : "bg-surface text-text-secondary"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <Loading />
      ) : (data?.length ?? 0) === 0 ? (
        <p className="card p-6 text-center text-sm text-text-secondary">Nothing in this queue.</p>
      ) : (
        <ul className="space-y-2">
          {data?.map((ticket) => (
            <li key={ticket.id}>
              <Link
                to="/admin/support/$id"
                params={{ id: ticket.id }}
                className="card flex items-center justify-between gap-4 p-4 transition hover:shadow-md"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{ticket.subject}</p>
                  <p className="text-[12px] text-text-secondary">
                    {formatDateTime(ticket.created_at)} · {ticket.priority}
                    {ticket.assigned_to ? " · assigned" : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[11px] font-bold uppercase text-text-secondary">
                  {ticket.status.replace("_", " ")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}