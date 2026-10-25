/**
 * Scheduled job runner — server-only.
 *
 * Runs hourly. Each user is processed in their own timezone, so a 9 AM
 * reminder arrives at 9 AM where they live. Nothing here changes financial
 * state: it materialises schedules (idempotent), derives overdue status
 * without writing it, and creates notifications guarded by a unique dedupe
 * key. Running the job twice, ten times, or after a retry produces exactly
 * the same result as running it once.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  DEFAULT_CHANNELS,
  DEFAULT_SCHEDULE,
  budgetAlertDrafts,
  classifyFailure,
  isDuplicateKey,
  localTime,
  reminderDrafts,
  runKey,
  slotsFor,
  weeklySummaryDraft,
  type Channels,
  type NotificationDraft,
  type OccurrenceLike,
  type Schedule,
  type Slot,
} from "./scheduler";
import { addDays, round2, spendingByCategory, type TxnLike } from "./money";
import { cashFlow } from "./insights";
import { currentCycle, budgetState, DEFAULT_THRESHOLDS, categorySpend } from "./budgets";
import { insertDraft } from "./notify.server";

export { insertDraft };

type Db = SupabaseClient<Database>;

const SWEEP_JOB = "notification_sweep";
const RETENTION_JOB = "notification_retention";
/** A claim older than this is treated as a crashed run and may be taken over. */
const STALE_CLAIM_MS = 15 * 60 * 1000;
/** Read-and-archived notifications are pruned after this many days. */
export const RETENTION_DAYS = 90;
/** Notification types kept regardless of age — they document account integrity. */
const RETAINED_TYPES = ["security", "payment_success", "payment_failed"];

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
}

/* ------------------------------- claiming -------------------------------- */

export type Claim = { id: string; retryCount: number } | null;

/**
 * Take exclusive ownership of one (job, run key) pair.
 *
 * The unique index does the locking: a second worker for the same hour loses
 * the insert and returns `null` instead of duplicating the work. A run that
 * died mid-flight is reclaimed after `STALE_CLAIM_MS` with its retry count
 * incremented, so a crash never wedges the schedule permanently.
 */
export async function claimRun(db: Db, job: string, key: string): Promise<Claim> {
  const { data, error } = await db
    .from("job_runs")
    .insert({ job, run_key: key, status: "running" } as never)
    .select("id, retry_count")
    .maybeSingle();

  if (!error && data) return { id: data.id, retryCount: data.retry_count };
  if (error && !isDuplicateKey(error)) throw new Error(error.message);

  const cutoff = new Date(Date.now() - STALE_CLAIM_MS).toISOString();
  const { data: existing } = await db
    .from("job_runs")
    .select("id, retry_count, status, started_at")
    .eq("job", job)
    .eq("run_key", key)
    .maybeSingle();
  if (!existing || existing.status !== "running" || existing.started_at > cutoff) return null;

  const { data: taken } = await db
    .from("job_runs")
    .update({
      started_at: new Date().toISOString(),
      retry_count: existing.retry_count + 1,
    } as never)
    .eq("id", existing.id)
    .eq("status", "running")
    .lt("started_at", cutoff)
    .select("id, retry_count")
    .maybeSingle();

  return taken ? { id: taken.id, retryCount: taken.retry_count } : null;
}

async function finishRun(
  db: Db,
  id: string,
  startedAt: number,
  result: {
    processed: number;
    created: number;
    failed: number;
    error?: string | null;
    details?: Record<string, unknown>;
  },
): Promise<void> {
  const status =
    result.failed > 0
      ? result.created > 0 || result.processed > result.failed
        ? "partial"
        : "failed"
      : "success";
  const { error } = await db
    .from("job_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      processed: result.processed,
      created: result.created,
      failed: result.failed,
      error: result.error ?? null,
      details: (result.details ?? {}) as never,
    } as never)
    .eq("id", id);
  if (error) console.error("[jobs] could not finalise run", id, error.message);
}

/* ------------------------------- user work ------------------------------- */

type UserSettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];

function scheduleOf(row: UserSettingsRow): Schedule {
  return {
    notify_bill_reminders: row.notify_bill_reminders,
    notify_due_tomorrow: row.notify_due_tomorrow,
    notify_due_today: row.notify_due_today,
    notify_overdue: row.notify_overdue,
    notify_payment_recorded: row.notify_payment_recorded,
    notify_weekly_summary: row.notify_weekly_summary,
    notify_monthly_summary: row.notify_monthly_summary,
  };
}

function channelsOf(row: Record<string, boolean> | null | undefined): Channels {
  if (!row) return DEFAULT_CHANNELS;
  return {
    bill_reminders: row["bill_reminders"] ?? DEFAULT_CHANNELS.bill_reminders,
    overdue_alerts: row["overdue_alerts"] ?? DEFAULT_CHANNELS.overdue_alerts,
    payment_confirmations: row["payment_confirmations"] ?? DEFAULT_CHANNELS.payment_confirmations,
    budget_alerts: row["budget_alerts"] ?? DEFAULT_CHANNELS.budget_alerts,
    weekly_summary: row["weekly_summary"] ?? DEFAULT_CHANNELS.weekly_summary,
    security_alerts: row["security_alerts"] ?? DEFAULT_CHANNELS.security_alerts,
  };
}

/** Everything one user needs generated for one slot. Returns the drafts only. */
export async function draftsForUser(
  db: Db,
  userId: string,
  input: { today: string; slot: Slot; schedule: Schedule; channels: Channels; currency: string },
): Promise<NotificationDraft[]> {
  const { today, slot, schedule, channels, currency } = input;
  const drafts: NotificationDraft[] = [];

  // Bill reminders — a window wide enough for the longest lead time and for
  // instalments that slipped past their date.
  const { data: occurrences, error: occErr } = await db
    .from("bill_occurrences")
    .select(
      "id, bill_id, scheduled_date, expected_amount, actual_amount, status, bill:bills(title, reminder_days_before, is_active)",
    )
    .eq("user_id", userId)
    .gte("scheduled_date", addDays(today, -120))
    .lte("scheduled_date", addDays(today, 45));
  if (occErr) throw new Error(occErr.message);

  const rows: OccurrenceLike[] = (occurrences ?? []).map((o) => {
    const bill = o.bill as {
      title?: string;
      reminder_days_before?: number;
      is_active?: boolean;
    } | null;
    return {
      id: o.id,
      bill_id: o.bill_id,
      scheduled_date: o.scheduled_date,
      expected_amount: Number(o.expected_amount),
      actual_amount: o.actual_amount === null ? null : Number(o.actual_amount),
      status: o.status,
      title: bill?.title ?? "Bill",
      reminder_days_before: bill?.reminder_days_before ?? 3,
      bill_active: bill?.is_active ?? true,
    };
  });
  drafts.push(...reminderDrafts(rows, { today, slot, schedule, channels, currency }));

  if (slot === "evening") return drafts;

  // Budget alerts — evaluated with the same deterministic engine the UI uses.
  const { data: budgets, error: budgetErr } = await db
    .from("budgets")
    .select("*")
    .eq("user_id", userId);
  if (budgetErr) throw new Error(budgetErr.message);

  const needsTxns = (budgets ?? []).length > 0 || slot === "weekly";
  const txns: TxnLike[] = needsTxns
    ? await loadTransactions(db, userId, addDays(today, -400), today)
    : [];

  for (const budget of budgets ?? []) {
    const cycle = currentCycle(budget as never, today);
    const spend = categorySpend(txns, budget.category, cycle.start, cycle.end);
    drafts.push(
      ...budgetAlertDrafts(
        {
          id: budget.id,
          name: budget.name?.trim() || budget.category,
          amount: Number(budget.amount),
          spent: spend.net,
          cycleStart: cycle.start,
          warnThreshold: Number(budget.warn_threshold) || DEFAULT_THRESHOLDS.nearLimit,
          state: budgetState(budget as never),
        },
        { channels, slot, currency },
      ),
    );
  }

  if (slot !== "weekly") return drafts;

  // Weekly summary — the seven complete days before today.
  const weekStart = addDays(today, -7);
  const weekEnd = addDays(today, -1);
  const flow = cashFlow(txns, weekStart, weekEnd);
  const top = spendingByCategory(txns, weekStart, weekEnd)[0] ?? null;

  const { data: upcomingRows, error: upErr } = await db
    .from("bill_occurrences")
    .select("expected_amount, actual_amount, status")
    .eq("user_id", userId)
    .gte("scheduled_date", today)
    .lte("scheduled_date", addDays(today, 7));
  if (upErr) throw new Error(upErr.message);
  const upcoming = round2(
    (upcomingRows ?? [])
      .filter((o) => !["paid", "skipped", "cancelled"].includes(o.status))
      .reduce((sum, o) => sum + Number(o.actual_amount ?? o.expected_amount), 0),
  );

  const summary = weeklySummaryDraft(
    {
      weekStart,
      weekEnd,
      income: flow.income,
      spent: flow.expenses,
      billsPaid: flow.billPayments,
      upcoming,
      topCategory: top,
      transactionCount: flow.count,
    },
    { channels, schedule, currency },
  );
  if (summary.draft) drafts.push(summary.draft);

  return drafts;
}

async function loadTransactions(
  db: Db,
  userId: string,
  from: string,
  to: string,
): Promise<TxnLike[]> {
  const { data, error } = await db
    .from("transactions")
    .select("type, amount, category, date, status")
    .eq("user_id", userId)
    .gte("date", from)
    .lte("date", to);
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    type: t.type as TxnLike["type"],
    amount: Number(t.amount),
    category: t.category,
    date: t.date,
    status: t.status,
  }));
}

/* --------------------------------- sweep --------------------------------- */

export type SweepResult = {
  ran: boolean;
  reason?: string;
  processed: number;
  created: number;
  failed: number;
  retryable: number;
  users: number;
  emailReminders?: { sent: number; failed: number };
};

/** The hourly sweep: schedules, reminders, budget alerts and weekly summaries. */
export async function runNotificationSweep(now: Date = new Date()): Promise<SweepResult> {
  const db = await adminDb();
  const key = runKey(now);
  const claim = await claimRun(db, SWEEP_JOB, key);
  if (!claim) {
    return {
      ran: false,
      reason: "already_claimed",
      processed: 0,
      created: 0,
      failed: 0,
      retryable: 0,
      users: 0,
    };
  }

  const startedAt = Date.now();
  let processed = 0;
  let created = 0;
  let failed = 0;
  let retryable = 0;
  const failures: { user: string; category: string; message: string }[] = [];

  const { data: users, error } = await db.from("user_settings").select("*");
  if (error) {
    await finishRun(db, claim.id, startedAt, {
      processed: 0,
      created: 0,
      failed: 1,
      error: error.message,
    });
    throw new Error(error.message);
  }

  const { data: prefRows } = await db.from("notification_preferences").select("*");
  const prefsByUser = new Map<string, Record<string, boolean>>();
  for (const row of prefRows ?? []) {
    prefsByUser.set(row.user_id, row as unknown as Record<string, boolean>);
  }

  for (const settings of users ?? []) {
    const local = localTime(settings.timezone ?? "UTC", now);
    const slots = slotsFor(local);
    if (slots.length === 0) continue;

    processed += 1;
    try {
      const schedule = { ...DEFAULT_SCHEDULE, ...scheduleOf(settings) };
      const channels = channelsOf(prefsByUser.get(settings.user_id));
      const currency = settings.currency ?? "INR";

      if (slots.includes("morning")) await syncUserSchedules(db, settings.user_id, local.day);

      const seen = new Set<string>();
      for (const slot of slots) {
        const drafts = await draftsForUser(db, settings.user_id, {
          today: local.day,
          slot,
          schedule,
          channels,
          currency,
        });
        for (const draft of drafts) {
          if (seen.has(draft.dedupeKey)) continue;
          seen.add(draft.dedupeKey);
          if (await insertDraft(db, settings.user_id, draft)) created += 1;
        }
      }
    } catch (userError) {
      failed += 1;
      const category = classifyFailure(userError);
      if (category === "retryable") retryable += 1;
      const message = userError instanceof Error ? userError.message : String(userError);
      failures.push({ user: settings.user_id, category, message: message.slice(0, 300) });
      console.error(`[jobs:${SWEEP_JOB}] user ${settings.user_id} ${category}:`, message);
    }
  }

  // Process and deliver due email reminders
  let emailReminders = { processed: 0, sent: 0, failed: 0 };
  try {
    emailReminders = await processDueEmailReminders(db, now);
  } catch (emailErr) {
    console.error("[jobs:email_reminders] processing error:", emailErr);
  }

  await finishRun(db, claim.id, startedAt, {
    processed,
    created,
    failed,
    error: failures[0]?.message ?? null,
    details: {
      failures: failures.slice(0, 20),
      retryable,
      users: (users ?? []).length,
      run_key: key,
      emailReminders,
    },
  });

  return {
    ran: true,
    processed,
    created,
    failed,
    retryable,
    users: (users ?? []).length,
    emailReminders,
  };
}

/**
 * Keep every active bill's schedule materialised. `syncBillOccurrences` never
 * touches paid, skipped, cancelled or in-flight instalments, so this is safe
 * to run on every sweep.
 */
async function syncUserSchedules(db: Db, userId: string, today: string): Promise<void> {
  const { syncBillOccurrences } = await import("./bills.server");
  const { data: bills, error } = await db
    .from("bills")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  for (const bill of bills ?? []) {
    await syncBillOccurrences(db as never, userId, bill, today);
  }
}

/**
 * Deliver due email reminders across all users independently of website visitor sessions.
 */
export async function processDueEmailReminders(
  db: Db,
  now: Date = new Date(),
): Promise<{ processed: number; sent: number; failed: number }> {
  const nowIso = now.toISOString();

  const { data: dueReminders, error } = await db
    .from("bill_reminders")
    .select(
      `
      id,
      user_id,
      bill_occurrence_id,
      reminder_type,
      scheduled_for,
      occurrence:bill_occurrences(
        id,
        scheduled_date,
        expected_amount,
        actual_amount,
        status,
        bill:bills(id, title, reminder_email, is_active, notes, upi_id)
      )
    `,
    )
    .eq("status", "pending")
    .eq("reminder_type", "email")
    .lte("scheduled_for", nowIso)
    .limit(50);

  if (error || !dueReminders) {
    if (error) console.error("[jobs:email_reminders] Query error:", error.message);
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const reminder of dueReminders) {
    try {
      const occ = reminder.occurrence as any;
      if (!occ || occ.status === "paid" || occ.status === "cancelled" || occ.status === "skipped") {
        await db
          .from("bill_reminders")
          .update({ status: "cancelled" } as never)
          .eq("id", reminder.id);
        continue;
      }

      const bill = occ.bill;
      if (bill && bill.is_active === false) {
        await db
          .from("bill_reminders")
          .update({ status: "cancelled" } as never)
          .eq("id", reminder.id);
        continue;
      }

      let recipientEmail = bill?.reminder_email?.trim();
      if (!recipientEmail) {
        try {
          const { data: userAuth } = await db.auth.admin.getUserById(reminder.user_id);
          recipientEmail = userAuth?.user?.email?.trim();
        } catch {
          // Fallback
        }
      }

      if (!recipientEmail) {
        console.warn(`[jobs:email_reminders] No destination email for reminder ${reminder.id}`);
        await db
          .from("bill_reminders")
          .update({ status: "failed" } as never)
          .eq("id", reminder.id);
        failed += 1;
        continue;
      }

      const amount = Number(occ.actual_amount ?? occ.expected_amount);
      const { sendReminderEmail } = await import("./email.server");
      const result = await sendReminderEmail({
        to: recipientEmail,
        billTitle: bill?.title ?? "Bill",
        amount,
        dueDate: occ.scheduled_date,
        notes: bill?.notes,
        upiId: bill?.upi_id,
      });

      if (result.delivered) {
        sent += 1;
        await db
          .from("bill_reminders")
          .update({
            status: "sent",
            sent_at: new Date().toISOString(),
          } as never)
          .eq("id", reminder.id);

        await insertDraft(db, reminder.user_id, {
          type: "bill_due",
          title: `${bill?.title ?? "Bill"} reminder sent`,
          body: `Email reminder sent to ${recipientEmail} for ₹${amount} due on ${occ.scheduled_date}.`,
          dedupeKey: `email_sent:${reminder.id}`,
          billId: bill?.id,
        });
      } else {
        failed += 1;
        await db
          .from("bill_reminders")
          .update({
            status: "failed",
          } as never)
          .eq("id", reminder.id);
      }
    } catch (reminderErr) {
      console.error(
        `[jobs:email_reminders] Error processing reminder ${reminder.id}:`,
        reminderErr,
      );
      failed += 1;
      try {
        await db
          .from("bill_reminders")
          .update({ status: "failed" } as never)
          .eq("id", reminder.id);
      } catch {
        // Safe ignore
      }
    }
  }

  return { processed: dueReminders.length, sent, failed };
}

/* ------------------------------- retention ------------------------------- */

/**
 * Prune read, non-critical notifications older than the retention window.
 * Security and payment records are kept: they document account integrity.
 */
export async function runNotificationRetention(now: Date = new Date()): Promise<SweepResult> {
  const db = await adminDb();
  const key = now.toISOString().slice(0, 10);
  const claim = await claimRun(db, RETENTION_JOB, key);
  if (!claim) {
    return {
      ran: false,
      reason: "already_claimed",
      processed: 0,
      created: 0,
      failed: 0,
      retryable: 0,
      users: 0,
    };
  }

  const startedAt = Date.now();
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 86_400_000).toISOString();
  const { data, error } = await db
    .from("notifications")
    .delete()
    .lt("created_at", cutoff)
    .not("read_at", "is", null)
    .not("type", "in", `(${RETAINED_TYPES.join(",")})`)
    .select("id");

  const removed = data?.length ?? 0;
  await finishRun(db, claim.id, startedAt, {
    processed: removed,
    created: 0,
    failed: error ? 1 : 0,
    error: error?.message ?? null,
    details: { cutoff, retained_types: RETAINED_TYPES },
  });
  if (error) throw new Error(error.message);

  return { ran: true, processed: removed, created: 0, failed: 0, retryable: 0, users: 0 };
}
