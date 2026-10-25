/**
 * Preference-aware notification writer — server-only.
 *
 * Every notification in the app goes through here so two rules always hold:
 * a notification is only created when the user's channel and schedule allow
 * it, and the same event can never produce two rows (the unique dedupe key on
 * `notifications` is the backstop, and a duplicate is reported as "not
 * created" rather than as an error).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_CHANNELS,
  DEFAULT_SCHEDULE,
  isDuplicateKey,
  type Channels,
  type NotificationDraft,
  type Schedule,
} from "./scheduler";

type Db = SupabaseClient<Database>;

/** Insert a draft. Returns false when it already existed. */
export async function insertDraft(
  db: Db,
  userId: string,
  draft: NotificationDraft,
): Promise<boolean> {
  const { error } = await db.from("notifications").insert({
    user_id: userId,
    type: draft.type,
    title: draft.title,
    body: draft.body,
    dedupe_key: draft.dedupeKey,
    related_bill_id: draft.billId ?? null,
    related_transaction_id: draft.transactionId ?? null,
    related_budget_id: draft.budgetId ?? null,
  } as never);
  if (!error) return true;
  if (isDuplicateKey(error)) return false;
  throw new Error(error.message);
}

export type DeliveryDecision =
  | { delivered: true; duplicate: boolean }
  | { delivered: false; reason: "channel_off" | "schedule_off" | "error" };

/**
 * Create a notification for an event that just happened, honouring the user's
 * preferences. Never throws into the caller's flow: a failed notification must
 * not roll back a settled payment.
 */
export async function notifyUser(
  db: Db,
  userId: string,
  draft: NotificationDraft,
  gate: { channel?: keyof Channels; schedule?: keyof Schedule } = {},
): Promise<DeliveryDecision> {
  try {
    const [{ data: prefs }, { data: settings }] = await Promise.all([
      db.from("notification_preferences").select("*").eq("user_id", userId).maybeSingle(),
      db.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
    ]);

    if (gate.channel) {
      const row = prefs as unknown as Record<string, boolean> | null;
      const enabled = row?.[gate.channel] ?? DEFAULT_CHANNELS[gate.channel];
      if (!enabled) return { delivered: false, reason: "channel_off" };
    }
    if (gate.schedule) {
      const row = settings as unknown as Record<string, boolean> | null;
      const enabled = row?.[gate.schedule] ?? DEFAULT_SCHEDULE[gate.schedule];
      if (!enabled) return { delivered: false, reason: "schedule_off" };
    }

    const created = await insertDraft(db, userId, draft);
    return { delivered: true, duplicate: !created };
  } catch (error) {
    console.error("[notify] failed", draft.type, error instanceof Error ? error.message : error);
    return { delivered: false, reason: "error" };
  }
}

/**
 * Which delivery channels actually exist right now.
 *
 * In-app notifications are real. Email, push and SMS have no configured
 * provider, so the app says so instead of pretending a message was sent.
 */
export function deliveryChannelStatus(): {
  channel: string;
  configured: boolean;
  detail: string;
}[] {
  const hasEmail = Boolean(process.env["RESEND_API_KEY"] || process.env["SMTP_HOST"]);
  return [
    { channel: "in_app", configured: true, detail: "Delivered to the notification centre." },
    {
      channel: "email",
      configured: hasEmail,
      detail: hasEmail
        ? "Connected via configured email provider."
        : "No email provider configured (set RESEND_API_KEY in .env).",
    },
    { channel: "push", configured: false, detail: "No push provider configured." },
    { channel: "sms", configured: false, detail: "No SMS provider configured." },
  ];
}
