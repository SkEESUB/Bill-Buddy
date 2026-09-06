import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LifeBuoy, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Group, Row, SettingsHeader } from "@/components/settings/ui";
import { createSupportTicket, listSupportTickets } from "@/lib/account.functions";
import { formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";
import { APP_VERSION } from "@/lib/app-meta";

const KEY = ["support", "tickets"] as const;

const FAQS = [
  {
    q: "How is my safe-to-spend calculated?",
    a: "Available balance minus every unpaid obligation in the period. It is deterministic — no estimates or AI.",
  },
  {
    q: "Can I undo a payment?",
    a: "Records are never deleted. Create a reversal from the transaction detail screen; both entries stay in the ledger.",
  },
  {
    q: "Why can't I delete a category?",
    a: "Categories referenced by a bill, budget or transaction stay put so history remains accurate. Hide them instead.",
  },
  {
    q: "Where are my receipts stored?",
    a: "In private storage scoped to your account. Links are short-lived and generated only for you.",
  },
];

/** Support tickets, FAQs and app information. */
export function HelpSettingsPage() {
  const fetchTickets = useServerFn(listSupportTickets);
  const createTicket = useServerFn(createSupportTicket);
  const queryClient = useQueryClient();
  const { data: tickets = [] } = useQuery({ queryKey: KEY, queryFn: () => fetchTickets() });

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");

  const submit = useMutation({
    mutationFn: () => createTicket({ data: { subject: subject.trim(), description: description.trim() } }),
    onSuccess: () => {
      setSubject("");
      setDescription("");
      void queryClient.invalidateQueries({ queryKey: KEY });
      toast.success("Support request sent");
    },
    onError: (error) => toast.error(toUserMessage(error)),
  });

  return (
    <section className="animate-fade-in pb-8">
      <SettingsHeader title="Help & about" subtitle="Answers, support and app details." />

      <Group title="Contact support">
        <input
          className="input-field"
          placeholder="Subject"
          maxLength={140}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-label="Subject"
        />
        <textarea
          className="input-field mt-3"
          rows={4}
          placeholder="Tell us what happened…"
          maxLength={4000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Description"
        />
        <button
          type="button"
          className="btn btn-primary mt-4 w-full"
          disabled={subject.trim().length < 4 || description.trim().length < 10 || submit.isPending}
          onClick={() => submit.mutate()}
        >
          {submit.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-[18px] w-[18px]" />
          )}
          Send request
        </button>
      </Group>

      {tickets.length > 0 ? (
        <Group title="Your requests">
          {(tickets as { id: string; subject: string; status: string; created_at: string }[]).map(
            (t) => (
              <Row key={t.id} label={t.subject} hint={formatDateTime(t.created_at)}>
                <span className="rounded-lg bg-muted px-2 py-1 text-[12px] font-semibold text-text-secondary">
                  {t.status}
                </span>
              </Row>
            ),
          )}
        </Group>
      ) : null}

      <Group title="FAQ">
        {FAQS.map((f) => (
          <details key={f.q} className="border-b border-border-light py-3 last:border-0">
            <summary className="cursor-pointer text-sm font-medium text-text-primary">{f.q}</summary>
            <p className="mt-2 text-[13px] text-text-secondary">{f.a}</p>
          </details>
        ))}
      </Group>

      <Group title="About">
        <Row label="App">
          <span className="text-sm font-medium text-text-secondary">BillBuddy</span>
        </Row>
        <Row label="Version">
          <span className="text-sm font-medium text-text-secondary">{APP_VERSION}</span>
        </Row>
        <p className="mt-3 flex items-start gap-2 text-[13px] text-text-tertiary">
          <LifeBuoy className="mt-0.5 h-4 w-4 shrink-0" />
          BillBuddy keeps a deterministic ledger: every figure on screen is derived from records
          you can export at any time.
        </p>
      </Group>
    </section>
  );
}