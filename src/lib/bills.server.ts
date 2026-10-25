/**
 * Server-only bill logic. Never imported by components — the server functions
 * in `bills.functions.ts` are the only entry point.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { occurrenceDatesThrough, todayInTimeZone, addDays, type RecurrenceRule } from "./money";

export type Db = SupabaseClient<Database>;

/** How far ahead occurrences are materialised for a recurring bill. */
export const OCCURRENCE_HORIZON_DAYS = 400;

export type BillRow = Database["public"]["Tables"]["bills"]["Row"];

/**
 * Privileged client for settlement-critical tables. Since Phase 4 the browser
 * has no INSERT/UPDATE/DELETE grant on `bill_occurrences` or `transactions`,
 * so those writes happen here, after the caller has been authenticated, and
 * always scoped explicitly by `user_id`.
 */
export async function privilegedDb(fallbackClient?: Db): Promise<Db> {
  const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (serviceKey) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      return supabaseAdmin as unknown as Db;
    } catch (e) {
      console.warn("[privilegedDb] Error loading admin client, using fallback:", e);
    }
  }
  if (fallbackClient) {
    return fallbackClient;
  }
  const { supabase } = await import("@/lib/supabase");
  return supabase as unknown as Db;
}

/** Write an audit trail entry. Failures are logged, never surfaced to the user. */
export async function audit(
  _db: Db,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const db = await privilegedDb();
  const { error } = await db.from("audit_logs").insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: metadata as never,
  } as never);
  if (error) console.error("[audit] failed", action, error.message);
}

/**
 * Materialise (and prune) the occurrence rows for one bill so the schedule in
 * the database always matches the bill's recurrence rule.
 *
 * Rules:
 *  - never touches an occurrence that has been paid, cancelled or skipped, or
 *    that has a payment in flight — settled history is immutable;
 *  - re-dates nothing: obsolete future rows are deleted and correct ones
 *    inserted, so the schedule converges on the rule;
 *  - inactive bills keep their history but generate nothing new.
 */
export async function syncBillOccurrences(
  db: Db,
  userId: string,
  bill: BillRow,
  today = todayInTimeZone(),
): Promise<{ created: number; removed: number }> {
  const { data: existingRows, error: readError } = await db
    .from("bill_occurrences")
    .select("id, scheduled_date, status, expected_amount")
    .eq("bill_id", bill.id);
  if (readError) throw readError;

  const existing = existingRows ?? [];
  const locked = new Set(
    existing
      .filter((o) => ["paid", "cancelled", "skipped", "payment_pending"].includes(o.status))
      .map((o) => o.scheduled_date),
  );

  const rule: RecurrenceRule = {
    repeat_type: (bill.repeat_type ?? "none") as RecurrenceRule["repeat_type"],
    repeat_interval: bill.repeat_interval ?? 1,
    repeat_end_date: bill.repeat_end_date,
  };

  const horizon = addDays(today, OCCURRENCE_HORIZON_DAYS);
  const wanted = bill.is_active
    ? occurrenceDatesThrough(bill.due_date, horizon, rule)
    : occurrenceDatesThrough(bill.due_date, today, rule);
  const wantedSet = new Set(wanted);

  // Remove open future rows that the current rule no longer schedules.
  const stale = existing.filter(
    (o) => !locked.has(o.scheduled_date) && !wantedSet.has(o.scheduled_date),
  );
  if (stale.length > 0) {
    const { error } = await db
      .from("bill_occurrences")
      .delete()
      .in(
        "id",
        stale.map((o) => o.id),
      );
    if (error) throw error;
  }

  const have = new Set(
    existing.filter((o) => !stale.some((s) => s.id === o.id)).map((o) => o.scheduled_date),
  );
  const missing = wanted.filter((date) => !have.has(date));
  if (missing.length > 0) {
    const { error } = await db.from("bill_occurrences").insert(
      missing.map((date) => ({
        bill_id: bill.id,
        user_id: userId,
        scheduled_date: date,
        expected_amount: bill.amount,
        status: "pending",
      })) as never,
    );
    if (error) throw error;
  }

  // Keep amounts on still-open rows in step with the bill.
  const repriceIds = existing
    .filter(
      (o) =>
        !locked.has(o.scheduled_date) &&
        wantedSet.has(o.scheduled_date) &&
        Number(o.expected_amount) !== Number(bill.amount),
    )
    .map((o) => o.id);
  if (repriceIds.length > 0) {
    const { error } = await db
      .from("bill_occurrences")
      .update({ expected_amount: bill.amount } as never)
      .in("id", repriceIds);
    if (error) throw error;
  }

  try {
    await syncBillReminders(db, userId, bill as any);
  } catch (remErr) {
    console.warn("[syncBillOccurrences] Reminder sync notice:", remErr);
  }

  return { created: missing.length, removed: stale.length };
}

/**
 * Helper to compute an ISO timestamp for a local date and wall-clock time in a target timezone.
 * Defaults to Asia/Kolkata (IST) and 09:00:00 without assuming browser clock or simple UTC.
 */
function toUtcIso(dayStr: string, timeStr = "09:00", timeZone = "Asia/Kolkata"): string {
  try {
    const [y, m, d] = dayStr.split("-").map(Number);
    const [h = 9, min = 0] = timeStr.split(":").map(Number);
    if (!y || !m || !d) return new Date().toISOString();

    const targetUtcMs = Date.UTC(y, m - 1, d, h, min, 0);
    const dateObj = new Date(targetUtcMs);

    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone || "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(dateObj);
    const p = (type: string) => Number(parts.find((x) => x.type === type)?.value ?? 0);
    const asInTzMs = Date.UTC(p("year"), p("month") - 1, p("day"), p("hour") % 24, p("minute"), p("second"));
    const offsetMs = asInTzMs - targetUtcMs;
    return new Date(targetUtcMs - offsetMs).toISOString();
  } catch {
    return `${dayStr}T${timeStr.slice(0, 5)}:00.000Z`;
  }
}

/**
 * Synchronize email reminder records in bill_reminders for every open occurrence.
 * By default schedules a reminder on the bill's due date. If an advance reminder
 * is requested (e.g. 1, 3, or 7 days before), that preference is also scheduled alongside.
 * Uses the user's configured profile timezone (defaulting to Asia/Kolkata).
 */
export async function syncBillReminders(
  db: Db,
  userId: string,
  bill: BillRow & { reminder_time?: string | null; reminder_email?: string | null },
): Promise<{ scheduled: number; cancelled: number }> {
  const { data: occurrences, error: occError } = await db
    .from("bill_occurrences")
    .select("id, scheduled_date, status")
    .eq("bill_id", bill.id);

  if (occError || !occurrences) return { scheduled: 0, cancelled: 0 };

  const pendingOccurrences = occurrences.filter((o) => o.status === "pending");
  const pendingOccIds = pendingOccurrences.map((o) => o.id);

  if (!bill.is_active || pendingOccIds.length === 0) {
    if (pendingOccIds.length > 0) {
      await db
        .from("bill_reminders")
        .update({ status: "cancelled" } as never)
        .eq("user_id", userId)
        .in("bill_occurrence_id", pendingOccIds)
        .eq("status", "pending");
    }
    return { scheduled: 0, cancelled: pendingOccIds.length };
  }

  // Look up user's stored timezone from user_settings (defaulting to Asia/Kolkata)
  let userTimezone = "Asia/Kolkata";
  try {
    const { data: settings } = await db
      .from("user_settings")
      .select("timezone")
      .eq("user_id", userId)
      .maybeSingle();
    if (settings?.timezone) {
      userTimezone = settings.timezone;
    }
  } catch {
    // Keep Asia/Kolkata default
  }

  const leadDays = Math.max(0, Math.floor(bill.reminder_days_before ?? 0));
  const timeStr = ((bill as any).reminder_time ?? "09:00:00").slice(0, 5) || "09:00";

  // 1. Fetch ALL existing pending reminders for all pending occurrences of this bill in a SINGLE query
  const { data: existingList } = await db
    .from("bill_reminders")
    .select("id, bill_occurrence_id, scheduled_for, status")
    .eq("user_id", userId)
    .in("bill_occurrence_id", pendingOccIds)
    .eq("status", "pending");

  const existingReminders = existingList ?? [];
  const remindersByOccId = new Map<string, Array<{ id: string; scheduled_for: string; status: string }>>();
  for (const r of existingReminders) {
    const list = remindersByOccId.get(r.bill_occurrence_id) ?? [];
    list.push(r);
    remindersByOccId.set(r.bill_occurrence_id, list);
  }

  const toInsert: Array<{
    user_id: string;
    bill_occurrence_id: string;
    reminder_type: string;
    scheduled_for: string;
    status: string;
  }> = [];
  const toUpdate: Array<{ id: string; scheduled_for: string }> = [];
  const obsoleteIds: string[] = [];
  let scheduled = 0;

  for (const occ of pendingOccurrences) {
    // Due date reminder is always scheduled by default
    const targetDates = [occ.scheduled_date];

    // If user selected an additional advance reminder, preserve that preference
    if (leadDays > 0) {
      const advanceDate = addDays(occ.scheduled_date, -leadDays);
      if (advanceDate !== occ.scheduled_date) {
        targetDates.push(advanceDate);
      }
    }

    const targetIsoDates = targetDates.map((d) => toUtcIso(d, timeStr, userTimezone));
    const occExisting = remindersByOccId.get(occ.id) ?? [];

    for (const targetIso of targetIsoDates) {
      // Find matching existing reminder within 1 hour
      const matching = occExisting.find((r) => {
        const diffMs = Math.abs(new Date(r.scheduled_for).getTime() - new Date(targetIso).getTime());
        return diffMs < 3600 * 1000;
      });

      if (matching) {
        if (matching.scheduled_for !== targetIso) {
          toUpdate.push({ id: matching.id, scheduled_for: targetIso });
        }
        scheduled += 1;
      } else {
        toInsert.push({
          user_id: userId,
          bill_occurrence_id: occ.id,
          reminder_type: "email",
          scheduled_for: targetIso,
          status: "pending",
        });
        scheduled += 1;
      }
    }

    // Identify obsolete pending reminders for this occurrence
    for (const r of occExisting) {
      const rTime = new Date(r.scheduled_for).getTime();
      const hasMatch = targetIsoDates.some(
        (targetIso) => Math.abs(rTime - new Date(targetIso).getTime()) < 3600 * 1000,
      );
      if (!hasMatch) {
        obsoleteIds.push(r.id);
      }
    }
  }

  // 2. Perform batched mutations in parallel rather than sequential per-row queries
  const ops: Promise<unknown>[] = [];

  if (toInsert.length > 0) {
    ops.push(Promise.resolve(db.from("bill_reminders").insert(toInsert as never)));
  }

  if (obsoleteIds.length > 0) {
    ops.push(
      Promise.resolve(
        db
          .from("bill_reminders")
          .update({ status: "cancelled" } as never)
          .in("id", obsoleteIds),
      ),
    );
  }

  for (const u of toUpdate) {
    ops.push(
      Promise.resolve(
        db
          .from("bill_reminders")
          .update({ scheduled_for: u.scheduled_for } as never)
          .eq("id", u.id),
      ),
    );
  }

  if (ops.length > 0) {
    await Promise.all(ops);
  }

  return { scheduled, cancelled: obsoleteIds.length };
}
