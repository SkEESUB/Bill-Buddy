import { useState } from "react";
import { AlertTriangle, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Group, Row, SettingsHeader } from "@/components/settings/ui";
import { useAccount } from "@/hooks/useAccount";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";

/** Identity, session control and a read-only trail of recent account activity. */
export function SecuritySettingsPage() {
  const { overview, isLoading, refresh } = useAccount();
  const { signOut } = useAuth();
  const identity = overview?.identity;
  const activity = (overview?.activity ?? []) as {
    id: string;
    action: string;
    entity_type: string;
    created_at: string;
  }[];

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<"email" | "others" | null>(null);

  const changeEmail = async () => {
    const next = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setBusy("email");
    try {
      const { error } = await supabase.auth.updateUser({ email: next });
      if (error) throw error;
      toast.success("Check both inboxes — we sent a confirmation link to each address.");
      setEmail("");
      await refresh();
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const signOutOthers = async () => {
    setBusy("others");
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      toast.success("Signed out of every other device.");
    } catch (error) {
      toast.error(toUserMessage(error));
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="animate-fade-in pb-8">
      <SettingsHeader title="Security" subtitle="Your sign-in identity and recent activity." />

      {isLoading && !identity ? (
        <div className="card flex items-center justify-center p-10 text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <>
          <Group title="Identity">
            <Row label="Email" hint={identity?.email ?? "—"}>
              <span
                className={`rounded-lg px-2 py-1 text-[12px] font-semibold ${
                  identity?.emailConfirmed
                    ? "bg-soft-green text-success"
                    : "bg-soft-orange text-warning"
                }`}
              >
                {identity?.emailConfirmed ? "Verified" : "Unverified"}
              </span>
            </Row>
            <Row label="Sign-in method" hint={(identity?.providers ?? []).join(", ") || "email"} />
            <Row
              label="Account created"
              hint={identity?.createdAt ? formatDateTime(identity.createdAt) : "—"}
            />
            <Row
              label="Last sign-in"
              hint={identity?.lastSignInAt ? formatDateTime(identity.lastSignInAt) : "—"}
            />
          </Group>

          <Group
            title="Change email"
            description="We email a confirmation link to your current and new address. The change only applies once both are confirmed."
          >
            <div className="flex gap-2">
              <input
                className="input-field"
                type="email"
                autoComplete="email"
                placeholder="new@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary shrink-0"
                disabled={busy !== null || email.trim().length === 0}
                onClick={() => void changeEmail()}
              >
                {busy === "email" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Mail className="h-[18px] w-[18px]" />
                )}
                Send
              </button>
            </div>
          </Group>

          <Group title="Sessions">
            <button
              type="button"
              className="btn btn-secondary w-full"
              disabled={busy !== null}
              onClick={() => void signOutOthers()}
            >
              {busy === "others" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-[18px] w-[18px]" />
              )}
              Sign out of all other devices
            </button>
            <button
              type="button"
              className="btn mt-3 w-full bg-soft-red !text-error"
              onClick={() => void signOut()}
            >
              <LogOut className="h-[18px] w-[18px]" /> Sign out here
            </button>
          </Group>

          <Group title="Recent activity">
            {activity.length === 0 ? (
              <p className="py-2 text-[13px] text-text-tertiary">Nothing recorded yet.</p>
            ) : (
              activity.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 border-b border-border-light py-3 last:border-0"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-text-tertiary" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-text-primary">
                      {entry.action.replace(/[._]/g, " ")}
                    </span>
                    <span className="block text-[12px] text-text-tertiary">
                      {entry.entity_type} · {formatDateTime(entry.created_at)}
                    </span>
                  </span>
                </div>
              ))
            )}
          </Group>
        </>
      )}
    </section>
  );
}