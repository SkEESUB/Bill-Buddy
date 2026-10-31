/**
 * Server-authoritative spend operations.
 *
 * Every mutation is validated and executed on the server under the authenticated
 * user's session. The browser cannot forge user_id or inject negative amounts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { safeLogError } from "@/lib/errors";
import { z } from "zod";
import type { Spend, SpendSource } from "@/types/database";

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const SPEND_SOURCES = [
  "cash",
  "bank",
  "statement",
  "email",
  "notification",
  "card",
  "upi",
  "other",
] as const;

export const spendSourceSchema = z.enum(SPEND_SOURCES);

/**
 * Deterministic deduplication hash based on user, date, amount, and trimmed lowercased name.
 * Safe to run universally on client and server.
 */
export function computeSpendDedupeHash(
  userId: string,
  spendDate: string,
  amount: number,
  name: string,
): string {
  const norm = `${userId}|${spendDate}|${Number(amount).toFixed(2)}|${name.trim().toLowerCase()}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < norm.length; i++) {
    const ch = norm.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `dh_${(h2 >>> 0).toString(16).padStart(8, "0")}${(h1 >>> 0).toString(16).padStart(8, "0")}`;
}

export const spendInputSchema = z.object({
  name: z.string().trim().min(1, "Spend name is required").max(120),
  amount: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  spend_date: dayString,
  notes: z.string().trim().max(1000).nullable().optional(),
  source: spendSourceSchema.default("cash"),
  dedupe_hash: z.string().max(128).nullable().optional(),
});

export type SpendInput = z.infer<typeof spendInputSchema>;

export const spendUpdateSchema = z.object({
  id: z.string().min(1, "Spend ID is required"),
  name: z.string().trim().min(1, "Spend name is required").max(120),
  amount: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  spend_date: dayString,
  notes: z.string().trim().max(1000).nullable().optional(),
  source: spendSourceSchema.optional(),
  dedupe_hash: z.string().max(128).nullable().optional(),
});

export type SpendUpdateInput = z.infer<typeof spendUpdateSchema>;

export const spendDeleteSchema = z.object({
  id: z.string().min(1, "Spend ID is required"),
});

/** Create a new daily spend */
export const createSpend = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => spendInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<Spend> => {
    const { supabase, userId } = context;

    const dedupeHash =
      data.dedupe_hash ?? computeSpendDedupeHash(userId, data.spend_date, data.amount, data.name);

    const payload = {
      user_id: userId,
      name: data.name,
      amount: data.amount,
      spend_date: data.spend_date,
      notes: data.notes ?? null,
      source: data.source ?? "cash",
      dedupe_hash: dedupeHash,
    };

    // Primary write path: public.spends
    const { data: spendRow, error: spendError } = await supabase
      .from("spends" as any)
      .insert(payload as any)
      .select("*")
      .single();

    if (!spendError && spendRow) {
      return {
        ...(spendRow as unknown as Spend),
        source: (spendRow as any).source || data.source || "other",
      };
    }

    // Resilient fallback to public.transactions if remote table migration is pending
    if (
      spendError &&
      (spendError.code === "PGRST205" ||
        spendError.code === "42P01" ||
        spendError.message?.includes("spends"))
    ) {
      console.warn(
        "[spends] public.spends not in cache, fallback to transactions:",
        spendError.message,
      );
      const { data: txnRow, error: txnError } = await supabase
        .from("transactions" as any)
        .insert({
          user_id: userId,
          type: "expense",
          amount: data.amount,
          description: data.name,
          category: "general",
          date: data.spend_date,
          notes: data.notes ?? null,
          status: "settled",
          payment_method: data.source === "cash" ? "cash" : "upi",
          source: data.source ?? "manual",
        } as any)
        .select("*")
        .single();

      if (txnError) throw new Error(txnError.message);

      return {
        id: (txnRow as any).id,
        user_id: (txnRow as any).user_id,
        name: (txnRow as any).description || "Expense",
        amount: Number((txnRow as any).amount),
        spend_date: (txnRow as any).date,
        notes: (txnRow as any).notes ?? null,
        source: data.source ?? "other",
        dedupe_hash: dedupeHash,
        created_at: (txnRow as any).created_at,
      };
    }

    if (spendError) {
      safeLogError("createSpend", spendError);
    }
    throw new Error(
      `Failed to create spend: ${spendError?.message || "Unknown error"} (${spendError?.code || "UNKNOWN"})`,
    );
  });

/** Update an existing daily spend (preserves source if not explicitly provided) */
export const updateSpend = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => spendUpdateSchema.parse(data))
  .handler(async ({ data, context }): Promise<Spend> => {
    const { supabase, userId } = context;

    const updatePayload: Record<string, any> = {
      name: data.name,
      amount: data.amount,
      spend_date: data.spend_date,
      notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
    };

    if (data.source !== undefined) {
      updatePayload["source"] = data.source;
    }

    if (data.dedupe_hash !== undefined) {
      updatePayload["dedupe_hash"] = data.dedupe_hash;
    } else {
      updatePayload["dedupe_hash"] = computeSpendDedupeHash(
        userId,
        data.spend_date,
        data.amount,
        data.name,
      );
    }

    // Try update in public.spends
    const { data: updatedSpend, error: spendError } = await supabase
      .from("spends" as any)
      .update(updatePayload as any)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (!spendError && updatedSpend) {
      return {
        ...(updatedSpend as unknown as Spend),
        source: (updatedSpend as any).source || data.source || "other",
      };
    }

    // Fallback try in public.transactions
    const txnUpdatePayload: Record<string, any> = {
      description: data.name,
      amount: data.amount,
      date: data.spend_date,
      notes: data.notes ?? null,
      updated_at: new Date().toISOString(),
    };
    if (data.source !== undefined) {
      txnUpdatePayload["payment_method"] = data.source === "cash" ? "cash" : "upi";
    }

    const { data: updatedTxn, error: txnError } = await supabase
      .from("transactions" as any)
      .update(txnUpdatePayload as any)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (!txnError && updatedTxn) {
      return {
        id: (updatedTxn as any).id,
        user_id: (updatedTxn as any).user_id,
        name: (updatedTxn as any).description || "Expense",
        amount: Number((updatedTxn as any).amount),
        spend_date: (updatedTxn as any).date,
        notes: (updatedTxn as any).notes ?? null,
        source: data.source || ((updatedTxn as any).payment_method === "cash" ? "cash" : "bank"),
        created_at: (updatedTxn as any).created_at,
      };
    }

    throw new Error(spendError?.message || txnError?.message || "Failed to update spend record");
  });

/** Check for potential duplicate spend */
export const findDuplicateSpend = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z
      .object({
        name: z.string().trim().min(1),
        amount: z.number().positive(),
        spend_date: dayString,
        dedupe_hash: z.string().max(128).optional(),
      })
      .parse(data),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ isDuplicate: boolean; spend: Spend | null; matchedBy: string | null }> => {
      const { supabase, userId } = context;
      const hash =
        data.dedupe_hash || computeSpendDedupeHash(userId, data.spend_date, data.amount, data.name);

      // Check by dedupe_hash first
      const { data: matchByHash } = await supabase
        .from("spends" as any)
        .select("*")
        .eq("user_id", userId)
        .eq("dedupe_hash", hash)
        .limit(1)
        .maybeSingle();

      if (matchByHash) {
        return {
          isDuplicate: true,
          matchedBy: "hash",
          spend: {
            ...(matchByHash as unknown as Spend),
            source: (matchByHash as any).source || "other",
          },
        };
      }

      // Check by exact date, amount and name
      const { data: matchDetails } = await supabase
        .from("spends" as any)
        .select("*")
        .eq("user_id", userId)
        .eq("spend_date", data.spend_date)
        .eq("amount", data.amount)
        .ilike("name", data.name.trim())
        .limit(1)
        .maybeSingle();

      if (matchDetails) {
        return {
          isDuplicate: true,
          matchedBy: "details",
          spend: {
            ...(matchDetails as unknown as Spend),
            source: (matchDetails as any).source || "other",
          },
        };
      }

      return { isDuplicate: false, matchedBy: null, spend: null };
    },
  );

/** Delete a daily spend */
export const deleteSpend = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => spendDeleteSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ success: boolean }> => {
    const { supabase, userId } = context;

    const { error: spendError } = await supabase
      .from("spends" as any)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (!spendError) {
      return { success: true };
    }

    // Also attempt deletion in transactions table
    const { error: txnError } = await supabase
      .from("transactions" as any)
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);

    if (txnError && spendError) {
      throw new Error(spendError.message || txnError.message);
    }

    return { success: true };
  });

/** Fetch spends for the user */
export const listSpends = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }): Promise<Spend[]> => {
    const { supabase, userId } = context;

    const { data, error } = await supabase
      .from("spends" as any)
      .select("*")
      .eq("user_id", userId)
      .order("spend_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1000);

    if (!error && data) {
      return (data as any[]).map((s) => ({
        ...s,
        source: s.source || "other",
      })) as unknown as Spend[];
    }

    // Fallback to transactions
    const { data: txnData } = await supabase
      .from("transactions" as any)
      .select("*")
      .eq("user_id", userId)
      .eq("type", "expense")
      .order("date", { ascending: false })
      .limit(1000);

    return (txnData || []).map((t: any) => ({
      id: t.id,
      user_id: t.user_id,
      name: t.description || t.category || "Expense",
      amount: Number(t.amount) || 0,
      spend_date: t.date,
      notes: t.notes ?? null,
      source: t.payment_method === "cash" ? "cash" : "bank",
      created_at: t.created_at,
    }));
  });

export const statementCandidateSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(120),
  amount: z.number().positive(),
  spend_date: dayString,
  reference: z.string().nullable().optional(),
});

export const checkStatementDuplicatesSchema = z.object({
  candidates: z.array(statementCandidateSchema).max(500),
});

export interface DuplicateCheckResult {
  candidateId: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  matchedId?: string;
}

/** Check for potential duplicate transactions in spends and transactions */
export const checkStatementDuplicates = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => checkStatementDuplicatesSchema.parse(data))
  .handler(async ({ data, context }): Promise<DuplicateCheckResult[]> => {
    const { supabase, userId } = context;
    if (data.candidates.length === 0) return [];

    const dates = Array.from(new Set(data.candidates.map((c) => c.spend_date)));

    const { data: existingSpends } = await supabase
      .from("spends" as any)
      .select("id, name, amount, spend_date, dedupe_hash, notes, source")
      .eq("user_id", userId)
      .in("spend_date", dates);

    const { data: existingTxns } = await supabase
      .from("transactions" as any)
      .select("id, description, amount, date, type, bill_occurrence_id, external_reference")
      .eq("user_id", userId)
      .in("date", dates);

    const spendsList = (existingSpends || []) as any[];
    const txnsList = (existingTxns || []) as any[];

    return data.candidates.map((candidate) => {
      const candidateHash = computeSpendDedupeHash(
        userId,
        candidate.spend_date,
        candidate.amount,
        candidate.name,
      );

      // A. Check exact hash in spends
      const matchHash = spendsList.find((s) => s.dedupe_hash && s.dedupe_hash === candidateHash);
      if (matchHash) {
        return {
          candidateId: candidate.id,
          isDuplicate: true,
          duplicateReason: `Already recorded on ${matchHash.spend_date} ("${matchHash.name}")`,
          matchedId: matchHash.id,
        };
      }

      // B. Check reference/UTR in spend notes if candidate has reference
      if (candidate.reference && candidate.reference.length >= 4) {
        const refMatch = spendsList.find(
          (s) => s.notes && s.notes.toLowerCase().includes(candidate.reference!.toLowerCase()),
        );
        if (refMatch) {
          return {
            candidateId: candidate.id,
            isDuplicate: true,
            duplicateReason: `Matches existing reference ${candidate.reference}`,
            matchedId: refMatch.id,
          };
        }

        const txnRefMatch = txnsList.find(
          (t) =>
            (t.external_reference &&
              t.external_reference.toLowerCase().includes(candidate.reference!.toLowerCase())) ||
            (t.description &&
              t.description.toLowerCase().includes(candidate.reference!.toLowerCase())),
        );
        if (txnRefMatch) {
          return {
            candidateId: candidate.id,
            isDuplicate: true,
            duplicateReason: `Matches ledger transaction reference ${candidate.reference}`,
            matchedId: txnRefMatch.id,
          };
        }
      }

      // C. Check exact date and amount with similar description in spends
      const matchExactSpend = spendsList.find(
        (s) =>
          s.spend_date === candidate.spend_date &&
          Math.abs(Number(s.amount) - candidate.amount) < 0.001,
      );
      if (matchExactSpend) {
        const sName = (matchExactSpend.name || "").toLowerCase();
        const cName = candidate.name.toLowerCase();
        if (sName === cName || sName.includes(cName) || cName.includes(sName)) {
          return {
            candidateId: candidate.id,
            isDuplicate: true,
            duplicateReason: `Same date, amount and similar description ("${matchExactSpend.name}")`,
            matchedId: matchExactSpend.id,
          };
        }
      }

      // D. Check matching bill payments in transactions
      const matchBillPayment = txnsList.find(
        (t) =>
          t.date === candidate.spend_date &&
          Math.abs(Number(t.amount) - candidate.amount) < 0.001 &&
          (t.type === "bill_payment" || t.bill_occurrence_id != null),
      );
      if (matchBillPayment) {
        return {
          candidateId: candidate.id,
          isDuplicate: true,
          duplicateReason: `Matches Bill Payment of ₹${candidate.amount} on ${candidate.spend_date}`,
          matchedId: matchBillPayment.id,
        };
      }

      return {
        candidateId: candidate.id,
        isDuplicate: false,
      };
    });
  });

export const importStatementSpendsSchema = z.object({
  spends: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        amount: z.number().positive().max(1_000_000_000),
        spend_date: dayString,
        notes: z.string().trim().max(1000).nullable().optional(),
        reference: z.string().trim().max(120).nullable().optional(),
      }),
    )
    .min(1)
    .max(500),
});

export const importStatementSpends = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => importStatementSpendsSchema.parse(data))
  .handler(async ({ data, context }): Promise<{ importedCount: number }> => {
    const { supabase, userId } = context;

    const payloads = data.spends.map((item) => {
      const hash = computeSpendDedupeHash(userId, item.spend_date, item.amount, item.name);
      const noteWithRef = [item.notes, item.reference ? `Ref: ${item.reference}` : null]
        .filter(Boolean)
        .join(" | ");

      return {
        user_id: userId,
        name: item.name,
        amount: item.amount,
        spend_date: item.spend_date,
        notes: noteWithRef || null,
        source: "statement",
        dedupe_hash: hash,
      };
    });

    // Batch insert into public.spends
    const { data: insertedSpends, error: spendsError } = await supabase
      .from("spends" as any)
      .insert(payloads as any)
      .select("id");

    if (!spendsError && insertedSpends) {
      return {
        importedCount: insertedSpends.length,
      };
    }

    // Fallback to transactions if public.spends is unmigrated in schema cache
    if (
      spendsError &&
      (spendsError.code === "PGRST205" ||
        spendsError.code === "42P01" ||
        spendsError.message?.includes("spends"))
    ) {
      console.warn("[importStatementSpends] Falling back to transactions:", spendsError.message);
      const txnPayloads = payloads.map((p) => ({
        user_id: userId,
        type: "expense",
        amount: p.amount,
        description: p.name,
        category: "statement",
        date: p.spend_date,
        notes: p.notes,
        status: "settled",
        payment_method: "upi",
        source: "statement",
      }));

      const { data: insertedTxns, error: txnError } = await supabase
        .from("transactions" as any)
        .insert(txnPayloads as any)
        .select("id");

      if (txnError) {
        throw new Error(txnError.message);
      }

      return {
        importedCount: insertedTxns?.length ?? 0,
      };
    }

    throw new Error(spendsError?.message || "Failed to import statement expenses");
  });
