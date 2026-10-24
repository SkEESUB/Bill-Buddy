/**
 * Server-authoritative bill operations.
 *
 * Every write is validated and executed on the server as the signed-in user,
 * so the browser can never set `user_id`, invent an amount, or mark a bill
 * paid without a corresponding recorded transaction.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { z } from "zod";

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

const repeatType = z.enum(["none", "weekly", "monthly", "quarterly", "yearly", "custom"]);

const billInput = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  amount: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  category: z.string().trim().min(1).max(60).default("general"),
  due_date: dayString,
  repeat_type: repeatType.default("none"),
  repeat_interval: z.number().int().min(1).max(365).default(1),
  repeat_end_date: dayString.nullable().optional(),
  reminder_days_before: z.number().int().min(0).max(60).default(3),
  upi_id: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  amount_type: z.enum(["fixed", "variable"]).default("fixed"),
});

export type BillInput = z.infer<typeof billInput>;

/** Create a bill and materialise its schedule. */
export const createBill = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => billInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { syncBillOccurrences, audit, privilegedDb } = await import("./bills.server");
    const db = await privilegedDb(supabase as any);

    console.log(`[createBill] Creating bill for user ${userId}:`, data.title);

    const { data: bill, error } = await supabase
      .from("bills")
      .insert({
        user_id: userId,
        title: data.title,
        amount: data.amount,
        category: data.category,
        due_date: data.due_date,
        repeat_type: data.repeat_type,
        repeat_interval: data.repeat_interval,
        repeat_end_date: data.repeat_end_date ?? null,
        reminder_days_before: data.reminder_days_before,
        upi_id: data.upi_id ?? null,
        notes: data.notes ?? null,
        amount_type: data.amount_type,
        is_recurring: data.repeat_type !== "none",
        recurring_type: data.repeat_type === "none" ? null : data.repeat_type,
        is_active: true,
      } as never)
      .select("*")
      .single();
    if (error) {
      console.error("[createBill] Supabase INSERT error:", error);
      throw new Error(`Failed to create bill: ${error.message} (${error.code})`);
    }

    try {
      await syncBillOccurrences(db, userId, bill);
    } catch (syncErr) {
      console.error("[createBill] syncBillOccurrences error:", syncErr);
      const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
      throw new Error(`Bill created, but occurrence schedule failed: ${msg}`);
    }

    try {
      await audit(supabase, userId, "bill.created", "bill", bill.id, { title: bill.title });
    } catch (auditErr) {
      console.warn("[createBill] Audit logging notice:", auditErr);
    }

    return bill;
  });

const billUpdate = billInput.partial().extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
});

export type BillUpdateInput = z.infer<typeof billUpdate>;

/** Update a bill and reconcile its future schedule. */
export const updateBill = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => billUpdate.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { syncBillOccurrences, audit, privilegedDb } = await import("./bills.server");
    const db = await privilegedDb(supabase as any);
    const { id, ...patch } = data;

    const changes: Record<string, unknown> = { ...patch };
    if (patch.repeat_type) {
      changes["is_recurring"] = patch.repeat_type !== "none";
      changes["recurring_type"] = patch.repeat_type === "none" ? null : patch.repeat_type;
    }

    const { data: bill, error } = await supabase
      .from("bills")
      .update(changes as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    await syncBillOccurrences(db, userId, bill);
    await audit(supabase, userId, "bill.updated", "bill", bill.id, changes);
    return bill;
  });

/**
 * Delete a bill. Refused once any instalment has been settled — deleting then
 * would cascade away paid occurrences and orphan their transactions. Callers
 * should archive (pause) such bills instead.
 */
export const deleteBill = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit } = await import("./bills.server");

    const { count, error: countError } = await supabase
      .from("bill_occurrences")
      .select("id", { count: "exact", head: true })
      .eq("bill_id", data.id)
      .eq("user_id", userId)
      .eq("status", "paid");
    if (countError) throw new Error(countError.message);
    if ((count ?? 0) > 0) {
      throw new Error(
        "This bill has recorded payments, so it can't be deleted. Pause it instead to keep your payment history.",
      );
    }

    const { error } = await supabase
      .from("bills")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "bill.deleted", "bill", data.id);
    return { ok: true };
  });

/**
 * Pause or resume a bill. Pausing stops future instalments from being
 * scheduled while keeping every settled and open past instalment intact.
 */
export const setBillActive = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { syncBillOccurrences, audit, privilegedDb } = await import("./bills.server");
    const db = await privilegedDb(supabase as any);
    const { data: bill, error } = await supabase
      .from("bills")
      .update({ is_active: data.is_active } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await syncBillOccurrences(db, userId, bill);
    await audit(supabase, userId, data.is_active ? "bill.resumed" : "bill.paused", "bill", bill.id);
    return bill;
  });

/**
 * Record a real, user-confirmed payment against one occurrence.
 *
 * The server writes the money movement (`transactions`) and the schedule state
 * (`bill_occurrences`) together, and refuses to settle an occurrence twice.
 * `payment_method` is recorded verbatim so a UPI handoff is never presented as
 * an automatically verified payment.
 */
const paymentInput = z.object({
  occurrence_id: z.string().uuid(),
  amount: z.number().positive().max(1_000_000_000),
  paid_on: dayString,
  payment_method: z.enum(["upi", "cash", "card", "netbanking", "autopay", "other"]),
  external_reference: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

export type PaymentInput = z.infer<typeof paymentInput>;

export const recordOccurrencePayment = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => paymentInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, privilegedDb } = await import("./bills.server");
    const db = await privilegedDb(supabase as any);

    const { data: occurrence, error: readError } = await supabase
      .from("bill_occurrences")
      .select("*, bill:bills(title, category)")
      .eq("id", data.occurrence_id)
      .eq("user_id", userId)
      .single();
    if (readError) throw new Error(readError.message);
    if (occurrence.status === "paid") {
      throw new Error("This bill instalment is already marked as paid.");
    }
    if (occurrence.status === "cancelled" || occurrence.status === "skipped") {
      throw new Error("This bill instalment was cancelled or skipped.");
    }

    const bill = occurrence.bill as { title: string; category: string } | null;

    const { data: txn, error: txnError } = await db
      .from("transactions")
      .insert({
        user_id: userId,
        type: "bill_payment",
        amount: data.amount,
        category: bill?.category ?? "general",
        description: bill?.title ?? "Bill payment",
        date: data.paid_on,
        status: "completed",
        payment_method: data.payment_method,
        external_reference: data.external_reference ?? null,
        notes: data.notes ?? null,
        bill_occurrence_id: occurrence.id,
      } as never)
      .select("*")
      .single();
    if (txnError) throw new Error(txnError.message);

    const { data: updated, error: updateError } = await db
      .from("bill_occurrences")
      .update({
        status: "paid",
        actual_amount: data.amount,
        paid_at: new Date().toISOString(),
        transaction_id: txn.id,
      } as never)
      .eq("id", occurrence.id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (updateError) {
      // Roll back the money movement so the ledger never shows a phantom payment.
      await db.from("transactions").delete().eq("id", txn.id).eq("user_id", userId);
      throw new Error(updateError.message);
    }

    await audit(supabase, userId, "bill.payment_recorded", "bill_occurrence", occurrence.id, {
      amount: data.amount,
      payment_method: data.payment_method,
    });

    // Confirmation for a payment the user recorded themselves. Preference
    // aware, and keyed on the instalment so it can never duplicate.
    const { notifyUser } = await import("./notify.server");
    await notifyUser(
      db as never,
      userId,
      {
        type: "payment_success",
        title: "Payment recorded",
        body: `${bill?.title ?? "Bill"} — ${data.amount.toFixed(2)} marked as paid.`,
        dedupeKey: `payment_recorded:${occurrence.id}`,
        billId: occurrence.bill_id,
        transactionId: txn.id,
      },
      { channel: "payment_confirmations", schedule: "notify_payment_recorded" },
    );

    return { occurrence: updated, transaction: txn };
  });

/** Skip a single instalment without paying it (e.g. a month you were not billed). */
export const skipOccurrence = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z.object({ occurrence_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { audit, privilegedDb } = await import("./bills.server");
    const db = await privilegedDb(supabase as any);
    const { data: updated, error } = await db
      .from("bill_occurrences")
      .update({ status: "skipped" } as never)
      .eq("id", data.occurrence_id)
      .eq("user_id", userId)
      .neq("status", "paid")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await audit(supabase, userId, "bill.occurrence_skipped", "bill_occurrence", data.occurrence_id);
    return updated;
  });

/**
 * Refresh schedules for every active bill of the signed-in user. Safe to call
 * repeatedly — it is idempotent by construction.
 */
export const syncSchedules = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { syncBillOccurrences, privilegedDb } = await import("./bills.server");
    const db = await privilegedDb(supabase as any);
    const { data: bills, error } = await supabase
      .from("bills")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);
    if (error) throw new Error(error.message);

    let created = 0;
    let removed = 0;
    // Bounded concurrency: sequential syncing cost seconds on busy accounts.
    const queue = [...(bills ?? [])];
    const workers = Array.from({ length: Math.min(8, queue.length) }, async () => {
      for (let bill = queue.shift(); bill; bill = queue.shift()) {
        const result = await syncBillOccurrences(db, userId, bill);
        created += result.created;
        removed += result.removed;
      }
    });
    await Promise.all(workers);
    return { bills: (bills ?? []).length, created, removed };
  });
