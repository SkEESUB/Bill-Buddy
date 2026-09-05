import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getUserDetail, setAccountStatus } from "@/lib/admin.functions";
import { ACCOUNT_STATUSES, roleLabel } from "@/lib/admin/permissions";
import { currencySymbol, formatAmount, formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";
import { Can, DataCard, Loading } from "./ui";

/** One account, as an operator needs to see it. No credentials are exposed. */
export function AdminUserDetailPage({ userId }: { userId: string }) {
  const fetchUser = useServerFn(getUserDetail);
  const changeStatus = useServerFn(setAccountStatus);
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string>("");
  const [reason, setReason] = useState("");

  const key = ["admin", "user", userId];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => fetchUser({ data: { userId } }),
  });

  const save = useMutation({
    mutationFn: () => changeStatus({ data: { userId, status, reason } }),
    onSuccess: () => {
      toast.success("Account status updated");
      setReason("");
      void queryClient.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  if (isLoading) return <Loading />;
  if (error || !data)
    return <p className="card p-6 text-center text-sm text-error">{toUserMessage(error)}</p>;

  return (
    <div className="space-y-5">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-[13px] text-text-secondary">
        <ArrowLeft className="h-4 w-4" /> All users
      </Link>

      <DataCard title="Identity">
        <dl className="grid gap-3 sm:grid-cols-2">
          {[
            ["Email", data.email ?? "—"],
            ["Name", data.fullName ?? "—"],
            ["Email confirmed", data.emailConfirmed ? "Yes" : "No"],
            ["Roles", data.roles.length ? data.roles.map(roleLabel).join(", ") : "User"],
            ["Signed up", data.createdAt ? formatDateTime(data.createdAt) : "—"],
            ["Last sign in", data.lastSignInAt ? formatDateTime(data.lastSignInAt) : "—"],
            ["Status", data.accountStatus],
            ["Status reason", data.statusReason ?? "—"],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[12px] text-text-secondary">{label}</dt>
              <dd className="text-sm font-semibold text-text-primary">{value}</dd>
            </div>
          ))}
        </dl>
      </DataCard>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          ["Bills", data.counts.bills],
          ["Transactions", data.counts.transactions],
          ["Budgets", data.counts.budgets],
          ["Notifications", data.counts.notifications],
        ].map(([label, value]) => (
          <div key={String(label)} className="card p-4">
            <p className="text-[12px] text-text-secondary">{label}</p>
            <p className="text-xl font-bold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      <Can permission="users.status">
        <DataCard title="Account status">
          <div className="space-y-3">
            <select
              className="input"
              value={status || data.accountStatus}
              onChange={(e) => setStatus(e.target.value)}
              aria-label="Account status"
            >
              {ACCOUNT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ").toLowerCase()}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="Reason (recorded in the audit log)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Reason for status change"
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={save.isPending || reason.trim().length < 5}
              onClick={() => save.mutate()}
            >
              Apply status change
            </button>
          </div>
        </DataCard>
      </Can>

      <Can permission="payments.read">
        <DataCard title="Recent payment orders">
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-text-secondary">No payment orders.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-text-secondary">{formatDateTime(order.created_at)}</span>
                  <span className="font-semibold text-text-primary">
                    {currencySymbol(order.currency)}
                    {formatAmount(Number(order.amount))} · {order.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DataCard>
      </Can>

      <Can permission="support.read">
        <DataCard title="Support tickets">
          {data.tickets.length === 0 ? (
            <p className="text-sm text-text-secondary">No tickets.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.tickets.map((ticket) => (
                <li key={ticket.id} className="py-2 text-sm">
                  <Link to="/admin/support/$id" params={{ id: ticket.id }} className="font-semibold text-primary">
                    {ticket.subject}
                  </Link>
                  <span className="ml-2 text-text-secondary">{ticket.status}</span>
                </li>
              ))}
            </ul>
          )}
        </DataCard>
      </Can>
    </div>
  );
}