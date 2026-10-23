/**
 * Server-authoritative ledger API.
 *
 * Every read is filtered, paginated and RLS-scoped in the database; every
 * write is validated here and performed with a privileged client only after
 * the caller's ownership has been proven. The browser has no write grant on
 * `transactions`, so this module is the only mutation path.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { z } from "zod";
import {
  EXPORT_ROW_LIMIT,
  MANUAL_TYPES,
  PAGE_SIZE,
  PAYMENT_METHODS,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
  reversalTypeFor,
  toLedgerCsv,
  toLedgerJson,
  type ExportRow,
  type LedgerRow,
} from "./transactions";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date");
const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const filterSchema = z.object({
  search: z.string().trim().max(120).nullable().optional(),
  type: z.enum(["all", ...TRANSACTION_TYPES]).default("all"),
  status: z.enum(["all", ...TRANSACTION_STATUSES]).default("all"),
  category: z.string().trim().max(60).nullable().optional(),
  payment_method: z.string().trim().max(40).nullable().optional(),
  from: day.nullable().optional(),
  to: day.nullable().optional(),
});

export type LedgerFilterInput = z.input<typeof filterSchema>;

const listSchema = filterSchema.extend({
  page: z.number().int().min(0).max(10_000).default(0),
  pageSize: z.number().int().min(1).max(200).default(PAGE_SIZE),
});

export type LedgerPage = {
  rows: LedgerRow[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
};

/** Paginated, filtered, searchable ledger page. */
export const listTransactions = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => listSchema.parse(data ?? {}))
  .handler(async ({ data, context }): Promise<LedgerPage> => {
    const { ledgerQuery } = await import("./transactions.server");
    const from = data.page * data.pageSize;
    const { data: rows, count, error } = await ledgerQuery(
      context.supabase as never,
      context.userId,
      data,
      true,
    ).range(from, from + data.pageSize - 1);
    if (error) throw new Error(error.message);
    const total = count ?? 0;
    return {
      rows: (rows ?? []) as unknown as LedgerRow[],
      total,
      page: data.page,
      pageSize: data.pageSize,
      hasMore: from + (rows?.length ?? 0) < total,
    };
  });

export type TransactionDetail = {
  transaction: LedgerRow & { updated_at?: string };
  bill: { id: string; title: string; category: string } | null;
  occurrence: { id: string; scheduled_date: string; status: string; expected_amount: number } | null;
  providerReference: string | null;
  reversal: { id: string; date: string; amount: number; type: string } | null;
  original: { id: string; date: string; amount: number; type: string } | null;
  attachments: { id: string; file_name: string; mime_type: string; file_size: number; created_at: string }[];
};

/** Everything the detail screen shows. Provider secrets are never returned. */
export const getTransaction = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<TransactionDetail> => {
    const { supabase, userId } = context;
    const { data: txn, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!txn) throw new Error("Transaction not found.");
    const row = txn as unknown as LedgerRow & { updated_at?: string };

    let bill: TransactionDetail["bill"] = null;
    let occurrence: TransactionDetail["occurrence"] = null;
    if (row.bill_occurrence_id) {
      const { data: occ } = await supabase
        .from("bill_occurrences")
        .select("id, scheduled_date, status, expected_amount, bill:bills(id, title, category)")
        .eq("id", row.bill_occurrence_id)
        .eq("user_id", userId)
        .maybeSingle();
      const record = occ as unknown as
        | {
            id: string;
            scheduled_date: string;
            status: string;
            expected_amount: number;
            bill: { id: string; title: string; category: string } | null;
          }
        | null;
      if (record) {
        occurrence = {
          id: record.id,
          scheduled_date: record.scheduled_date,
          status: record.status,
          expected_amount: Number(record.expected_amount),
        };
        bill = record.bill;
      }
    }

    const linkedIds = [row.reversal_of, row.reversed_by].filter(Boolean) as string[];
    const linked = linkedIds.length
      ? ((
          await supabase
            .from("transactions")
            .select("id, date, amount, type")
            .eq("user_id", userId)
            .in("id", linkedIds)
        ).data ?? [])
      : [];
    const findLinked = (id?: string | null) => {
      const found = linked.find((l) => l.id === id);
      return found ? { ...found, amount: Number(found.amount) } : null;
    };

    const { data: attachments } = await supabase
      .from("attachments")
      .select("id, file_name, mime_type, file_size, created_at")
      .eq("user_id", userId)
      .eq("transaction_id", row.id)
      .order("created_at");

    return {
      transaction: row,
      bill,
      occurrence,
      providerReference: row.external_reference ?? null,
      reversal: findLinked(row.reversed_by),
      original: findLinked(row.reversal_of),
      attachments: (attachments ?? []).map((a) => ({ ...a, file_size: Number(a.file_size) })),
    };
  });

/* -------------------------------- mutations ------------------------------- */

const createSchema = z.object({
  type: z.enum(MANUAL_TYPES),
  amount: z.number().finite().refine((v) => Math.abs(v) > 0 && Math.abs(v) <= 1_000_000_000, {
    message: "Enter an amount greater than 0",
  }),
  category: z.string().trim().min(1).max(60),
  description: optionalText(200),
  date: day,
  payment_method: z.enum(PAYMENT_METHODS).nullable().optional(),
  notes: optionalText(500),
  currency: z.string().trim().length(3).default("INR"),
  client_request_id: z.string().trim().min(8).max(64),
});

export type CreateTransactionInput = z.input<typeof createSchema>;

/**
 * Record a manual money movement. `client_request_id` makes the write
 * idempotent: a double click, a retry or a refresh mid-request all resolve to
 * the same single row.
 */
export const createTransaction = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => createSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (data.type !== "adjustment" && data.amount <= 0) {
      throw new Error("Enter an amount greater than 0");
    }
    const { privilegedDb, audit } = await import("./bills.server");
    const db = await privilegedDb();

    const payload = {
      user_id: userId,
      type: data.type,
      amount: data.type === "adjustment" ? data.amount : Math.abs(data.amount),
      category: data.category,
      description: data.description ?? null,
      date: data.date,
      payment_method: data.payment_method ?? "manual",
      notes: data.notes ?? null,
      currency: data.currency,
      status: "completed",
      source: "manual",
      client_request_id: data.client_request_id,
    };

    const { data: row, error } = await db
      .from("transactions")
      .insert(payload as never)
      .select("*")
      .single();

    if (error) {
      // Unique violation on (user_id, client_request_id) = a repeated submit.
      if (error.code === "23505") {
        const { data: existing } = await db
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .eq("client_request_id", data.client_request_id)
          .maybeSingle();
        if (existing) return existing;
      }
      throw new Error(error.message);
    }
    await audit(db, userId, "transaction.create", "transaction", (row as { id: string }).id, {
      type: data.type,
    });
    return row;
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  amount: z.number().finite().optional(),
  category: z.string().trim().min(1).max(60).optional(),
  description: optionalText(200),
  date: day.optional(),
  payment_method: z.enum(PAYMENT_METHODS).nullable().optional(),
  notes: optionalText(500),
});

export type UpdateTransactionInput = z.input<typeof updateSchema>;

/** Edit a manual entry. Engine/provider records are immutable from the client. */
export const updateTransaction = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => updateSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...patch } = data;
    const { data: existing, error: readError } = await supabase
      .from("transactions")
      .select("id, type, source, reversed_by, reversal_of, status")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) throw new Error("Transaction not found.");
    const record = existing as unknown as LedgerRow;
    if (record.type === "bill_payment" || (record.source ?? "manual") !== "manual") {
      throw new Error("Settled payment records can't be edited. Use a reversal instead.");
    }
    if (record.reversed_by || record.reversal_of) {
      throw new Error("Reversal records can't be edited — they preserve history.");
    }
    if (patch.amount !== undefined) {
      const abs = Math.abs(patch.amount);
      if (!(abs > 0) || abs > 1_000_000_000) throw new Error("Enter an amount greater than 0");
      patch.amount = record.type === "adjustment" ? patch.amount : abs;
    }

    const { privilegedDb, audit } = await import("./bills.server");
    const db = await privilegedDb();
    const { data: row, error } = await db
      .from("transactions")
      .update(patch as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await audit(db, userId, "transaction.update", "transaction", id, {});
    return row;
  });

/** Delete a manual entry. Settled bill payments and reversals stay auditable. */
export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: readError } = await supabase
      .from("transactions")
      .select("id, type, source, reversed_by, reversal_of")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) throw new Error("Transaction not found.");
    const record = existing as unknown as LedgerRow;
    if (record.type === "bill_payment" || (record.source ?? "manual") !== "manual") {
      throw new Error("Settled payment records can't be deleted. Use a reversal instead.");
    }
    if (record.reversed_by || record.reversal_of) {
      throw new Error("Reversed records are kept for audit. Delete is not available.");
    }

    const { privilegedDb, audit } = await import("./bills.server");
    const db = await privilegedDb();
    const { error } = await db
      .from("transactions")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    await audit(db, userId, "transaction.delete", "transaction", data.id, {});
    return { ok: true };
  });

/**
 * Reverse a settled movement by writing an offsetting record and linking the
 * two. The original row is never rewritten or deleted, so history stays true.
 */
export const reverseTransaction = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().trim().max(200).optional(),
        client_request_id: z.string().trim().min(8).max(64),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing, error: readError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!existing) throw new Error("Transaction not found.");
    const original = existing as unknown as LedgerRow;
    if ((original.status ?? "completed") !== "completed") {
      throw new Error("Only completed records can be reversed.");
    }
    if (original.reversed_by) throw new Error("This record has already been reversed.");
    if (original.reversal_of) throw new Error("A reversal can't itself be reversed.");
    if (original.type === "transfer") throw new Error("Transfers can't be reversed.");

    const { privilegedDb, audit } = await import("./bills.server");
    const db = await privilegedDb();
    const type = reversalTypeFor(original);
    const amount = Math.abs(Number(original.amount));

    const { data: created, error } = await db
      .from("transactions")
      .insert({
        user_id: userId,
        type,
        // An adjustment reversing money in must remove it again.
        amount: type === "adjustment" ? -amount : amount,
        category: original.category,
        description: data.reason?.trim()
          ? `Reversal: ${data.reason.trim()}`
          : `Reversal of ${original.description || original.category}`,
        date: new Date().toISOString().slice(0, 10),
        currency: original.currency ?? "INR",
        payment_method: original.payment_method ?? null,
        external_reference: original.external_reference ?? null,
        status: "completed",
        source: "system",
        reversal_of: original.id,
        client_request_id: data.client_request_id,
      } as never)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: dupe } = await db
          .from("transactions")
          .select("*")
          .eq("user_id", userId)
          .eq("reversal_of", original.id)
          .maybeSingle();
        if (dupe) return dupe;
      }
      throw new Error(error.message);
    }

    const reversalId = (created as { id: string }).id;
    const { error: linkError } = await db
      .from("transactions")
      .update({ reversed_by: reversalId } as never)
      .eq("id", original.id)
      .eq("user_id", userId);
    if (linkError) throw new Error(linkError.message);

    await audit(db, userId, "transaction.reverse", "transaction", original.id, {
      reversal_id: reversalId,
    });
    return created;
  });

/* --------------------------------- export --------------------------------- */

const exportSchema = filterSchema.extend({ format: z.enum(["csv", "json"]).default("csv") });

export type ExportInput = z.input<typeof exportSchema>;

/**
 * Build an export file from real database rows for the calling user only.
 * Runs on the server and is capped, so browser memory is never the limit.
 */
export const exportTransactions = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => exportSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { ledgerQuery, billTitlesForOccurrences } = await import("./transactions.server");
    const { data: rows, error } = await ledgerQuery(
      context.supabase as never,
      context.userId,
      data,
    ).limit(EXPORT_ROW_LIMIT);
    if (error) throw new Error(error.message);

    const list = (rows ?? []) as unknown as LedgerRow[];
    const titles = await billTitlesForOccurrences(
      context.supabase as never,
      context.userId,
      list.map((r) => r.bill_occurrence_id ?? "").filter(Boolean),
    );
    const enriched: ExportRow[] = list.map((row) => ({
      ...row,
      bill_title: row.bill_occurrence_id ? titles.get(row.bill_occurrence_id) ?? null : null,
    }));

    const stamp = new Date().toISOString().slice(0, 10);
    return data.format === "json"
      ? {
          filename: `billbuddy-transactions-${stamp}.json`,
          mime: "application/json;charset=utf-8",
          content: toLedgerJson(enriched),
          count: enriched.length,
          truncated: enriched.length === EXPORT_ROW_LIMIT,
        }
      : {
          filename: `billbuddy-transactions-${stamp}.csv`,
          mime: "text/csv;charset=utf-8",
          content: toLedgerCsv(enriched),
          count: enriched.length,
          truncated: enriched.length === EXPORT_ROW_LIMIT,
        };
  });

/* ------------------------------- attachments ------------------------------ */

const ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "application/pdf",
] as const;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Issue a one-time signed upload URL under the caller's own private prefix.
 * A user can never write to (or guess) another user's path.
 */
export const createAttachmentUpload = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        transaction_id: z.string().uuid(),
        file_name: z.string().trim().min(1).max(120),
        mime_type: z.enum(ALLOWED_MIME),
        file_size: z.number().int().positive().max(MAX_FILE_BYTES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned, error } = await supabase
      .from("transactions")
      .select("id")
      .eq("id", data.transaction_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!owned) throw new Error("Transaction not found.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safeName = data.file_name.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${userId}/${data.transaction_id}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("receipts")
      .createSignedUploadUrl(path);
    if (signError) throw new Error(signError.message);
    return { path, token: signed.token, signedUrl: signed.signedUrl };
  });

/** Record an uploaded receipt after verifying ownership of the storage path. */
export const confirmAttachment = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        transaction_id: z.string().uuid(),
        storage_path: z.string().min(3).max(400),
        file_name: z.string().trim().min(1).max(120),
        mime_type: z.enum(ALLOWED_MIME),
        file_size: z.number().int().positive().max(MAX_FILE_BYTES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context;
    if (!data.storage_path.startsWith(`${userId}/${data.transaction_id}/`)) {
      throw new Error("This file does not belong to your account.");
    }
    const { privilegedDb } = await import("./bills.server");
    const db = await privilegedDb();
    const { data: owned } = await db
      .from("transactions")
      .select("id")
      .eq("id", data.transaction_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!owned) throw new Error("Transaction not found.");
    const { data: row, error } = await db
      .from("attachments")
      .insert({
        user_id: userId,
        transaction_id: data.transaction_id,
        storage_path: data.storage_path,
        file_name: data.file_name,
        mime_type: data.mime_type,
        file_size: data.file_size,
      } as never)
      .select("id, file_name, mime_type, file_size, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Short-lived signed link for the caller's own receipt. */
export const getAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("attachments")
      .select("id, storage_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Attachment not found.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("receipts")
      .createSignedUrl(row.storage_path, 60);
    if (signError) throw new Error(signError.message);
    return { url: signed.signedUrl };
  });

/** Remove a receipt the caller owns, from storage and from the ledger record. */
export const deleteAttachment = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("attachments")
      .select("id, storage_path")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Attachment not found.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage.from("receipts").remove([row.storage_path]);
    const { privilegedDb } = await import("./bills.server");
    const db = await privilegedDb();
    const { error: deleteError } = await db
      .from("attachments")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (deleteError) throw new Error(deleteError.message);
    return { ok: true };
  });