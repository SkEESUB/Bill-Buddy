/**
 * Server-only bill logic. Never imported by components — the server functions
 * in `bills.functions.ts` are the only entry point.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import {
  occurrenceDatesThrough,
  todayInTimeZone,
  addDays,
  type RecurrenceRule,
} from "./money";

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
export async function privilegedDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Db;
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
      .filter((o) =>
        ["paid", "cancelled", "skipped", "payment_pending"].includes(o.status),
      )
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
        status: "upcoming",
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

  return { created: missing.length, removed: stale.length };
}
