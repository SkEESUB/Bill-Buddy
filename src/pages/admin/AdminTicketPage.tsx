import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowLeft, Lock } from "lucide-react";
import { getTicket, replyToTicket, updateTicket } from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";
import { Can, DataCard, Loading } from "./ui";

/** One support conversation, with staff replies and internal notes. */
export function AdminTicketPage({ ticketId }: { ticketId: string }) {
  const fetchTicket = useServerFn(getTicket);
  const update = useServerFn(updateTicket);
  const reply = useServerFn(replyToTicket);
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  const key = ["admin", "ticket", ticketId];
  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: () => fetchTicket({ data: { ticketId } }),
  });
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: key });
  const onError = (e: unknown) => toast.error(toUserMessage(e));

  const setStatus = useMutation({
    mutationFn: (status: string) =>
      update({ data: { ticketId, status: status as "open", assignToMe: true } }),
    onSuccess: () => {
      toast.success("Ticket updated");
      invalidate();
    },
    onError,
  });

  const send = useMutation({
    mutationFn: () => reply({ data: { ticketId, body, internal } }),
    onSuccess: () => {
      setBody("");
      toast.success(internal ? "Internal note added" : "Reply sent");
      invalidate();
    },
    onError,
  });

  if (isLoading) return <Loading />;
  if (error || !data)
    return <p className="card p-6 text-center text-sm text-error">{toUserMessage(error)}</p>;

  return (
    <div className="space-y-5">
      <Link to="/admin/support" className="inline-flex items-center gap-1 text-[13px] text-text-secondary">
        <ArrowLeft className="h-4 w-4" /> Support inbox
      </Link>

      <DataCard title={data.ticket.subject}>
        <p className="text-[12px] text-text-secondary">
          {data.requesterEmail ?? "Unknown requester"} · {formatDateTime(data.ticket.created_at)} ·{" "}
          {data.ticket.priority} · {data.ticket.status.replace("_", " ")}
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm text-text-primary">{data.ticket.description}</p>
      </DataCard>

      <DataCard title="Conversation">
        {data.messages.length === 0 ? (
          <p className="text-sm text-text-secondary">No replies yet.</p>
        ) : (
          <ul className="space-y-3">
            {data.messages.map((message) => (
              <li
                key={message.id}
                className={`rounded-2xl p-3 text-sm ${
                  message.is_internal
                    ? "bg-warning/10 text-text-primary"
                    : message.author_type === "staff"
                      ? "bg-primary/10 text-text-primary"
                      : "bg-surface text-text-primary"
                }`}
              >
                <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase text-text-secondary">
                  {message.is_internal && <Lock className="h-3 w-3" />}
                  {message.is_internal ? "Internal note" : message.author_type === "staff" ? "Staff" : "Customer"}
                  <span className="font-normal normal-case">· {formatDateTime(message.created_at)}</span>
                </p>
                <p className="whitespace-pre-wrap">{message.body}</p>
              </li>
            ))}
          </ul>
        )}
      </DataCard>

      <Can permission="support.write">
        <DataCard title="Respond">
          <textarea
            className="input min-h-28 !rounded-2xl py-3"
            placeholder={internal ? "Internal note — the customer never sees this" : "Reply to the customer"}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Response body"
          />
          <label className="mt-3 flex items-center gap-2 text-[13px] text-text-secondary">
            <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
            Internal note only
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              disabled={send.isPending || body.trim().length === 0}
              onClick={() => send.mutate()}
            >
              {internal ? "Add note" : "Send reply"}
            </button>
            {["in_progress", "waiting_user", "resolved", "closed"].map((status) => (
              <button
                key={status}
                type="button"
                className="btn btn-secondary !min-h-10 !px-3 !text-xs"
                disabled={setStatus.isPending || data.ticket.status === status}
                onClick={() => setStatus.mutate(status)}
              >
                Mark {status.replace("_", " ")}
              </button>
            ))}
          </div>
        </DataCard>
      </Can>
    </div>
  );
}