import { Link } from "@tanstack/react-router";
import { Bell, Check, Minus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Group, Row, SettingsHeader, Toggle } from "@/components/settings/ui";
import { useAccount } from "@/hooks/useAccount";
import type { NotificationPrefsInput } from "@/lib/account.functions";
import type { SettingsInput } from "@/lib/finance.functions";
import { usePreferences } from "@/lib/preferences";

/** Honest picture of what can actually be delivered today. */
const DELIVERY = [
  { channel: "in_app", configured: true, detail: "— notification centre" },
  { channel: "email", configured: false, detail: "— no provider connected" },
  { channel: "push", configured: false, detail: "— no provider connected" },
  { channel: "sms", configured: false, detail: "— no provider connected" },
] as const;

const SCHEDULE: { key: keyof SettingsInput; label: string; hint: string }[] = [
  { key: "notify_bill_reminders", label: "Bill reminders", hint: "Ahead of the due date" },
  { key: "notify_due_tomorrow", label: "Due tomorrow", hint: "Evening heads-up" },
  { key: "notify_due_today", label: "Due today", hint: "Morning reminder" },
  { key: "notify_overdue", label: "Overdue alerts", hint: "When a bill slips past its date" },
  { key: "notify_payment_recorded", label: "Payment recorded", hint: "Confirmation after paying" },
  { key: "notify_weekly_summary", label: "Weekly summary", hint: "Every Monday" },
  { key: "notify_monthly_summary", label: "Monthly summary", hint: "First of the month" },
];

const CHANNELS: { key: keyof NotificationPrefsInput; label: string; hint: string }[] = [
  { key: "bill_reminders", label: "Bill reminders", hint: "Upcoming bills" },
  { key: "overdue_alerts", label: "Overdue alerts", hint: "Missed due dates" },
  { key: "payment_confirmations", label: "Payment confirmations", hint: "Successful payments" },
  { key: "budget_alerts", label: "Budget alerts", hint: "Nearing or over a budget" },
  { key: "weekly_summary", label: "Weekly digest", hint: "A recap of your week" },
  { key: "security_alerts", label: "Security alerts", hint: "Sign-ins and account changes" },
];

/** Two layers: what gets generated (channels) and when it gets sent (schedule). */
export function NotificationSettingsPage() {
  const { timezone } = usePreferences();
  const { settings, overview, updateSettings, updateNotificationPreferences, isLoading } =
    useAccount();
  const prefs = overview?.notificationPreferences as Record<string, boolean> | null | undefined;

  if (!settings) {
    return (
      <section className="animate-fade-in pb-8">
        <SettingsHeader title="Notifications" />
        <div className="card flex items-center justify-center p-10 text-text-secondary">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "No settings found."}
        </div>
      </section>
    );
  }

  const saveSetting = async (patch: SettingsInput) => {
    try {
      await updateSettings(patch);
      toast.success("Saved");
    } catch {
      /* handled in useAccount */
    }
  };

  const savePref = async (patch: NotificationPrefsInput) => {
    try {
      await updateNotificationPreferences(patch);
      toast.success("Saved");
    } catch {
      /* handled in useAccount */
    }
  };

  return (
    <section className="animate-fade-in pb-8">
      <SettingsHeader title="Notifications" subtitle="Every toggle is stored on your account." />

      <Link to="/notifications" className="card card-hover flex items-center gap-3 p-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-soft-blue text-primary">
          <Bell className="h-[18px] w-[18px]" />
        </span>
        <span className="text-sm font-semibold text-text-primary">Open notification centre</span>
      </Link>

      <Group title="What you get">
        {CHANNELS.map((c) => (
          <Row key={String(c.key)} label={c.label} hint={c.hint}>
            <Toggle
              label={c.label}
              checked={Boolean(prefs?.[String(c.key)])}
              onChange={(v) => void savePref({ [c.key]: v } as NotificationPrefsInput)}
            />
          </Row>
        ))}
      </Group>

      <Group title="When you get it">
        {SCHEDULE.map((s) => (
          <Row key={String(s.key)} label={s.label} hint={s.hint}>
            <Toggle
              label={s.label}
              checked={Boolean((settings as Record<string, unknown>)[String(s.key)])}
              onChange={(v) => void saveSetting({ [s.key]: v } as SettingsInput)}
            />
          </Row>
        ))}
      </Group>

      <Group title="How it reaches you">
        <div className="p-4 text-[13px] text-text-secondary">
          <p>
            Reminders are generated on the server twice a day in your own timezone
            ({timezone}) and land in your notification centre. Delivery outside the
            app is not enabled on this account.
          </p>
          <ul className="mt-3 space-y-1.5">
            {DELIVERY.map((d) => (
              <li key={d.channel} className="flex items-center gap-2">
                {d.configured ? (
                  <Check className="h-4 w-4 shrink-0 text-success" />
                ) : (
                  <Minus className="h-4 w-4 shrink-0 text-text-tertiary" />
                )}
                <span className="font-semibold capitalize text-text-primary">
                  {d.channel.replace("_", "-")}
                </span>
                <span className="text-text-tertiary">{d.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      </Group>
    </section>
  );
}