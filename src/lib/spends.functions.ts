/**
 * Server-authoritative spend operations.
 *
 * Every mutation is validated and executed on the server under the authenticated
 * user's session. The browser cannot forge user_id or inject negative amounts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { z } from "zod";
import type { Spend } from "@/types/database";

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export const spendInputSchema = z.object({
  name: z.string().trim().min(1, "Spend name is required").max(120),
  amount: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  spend_date: dayString,
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type SpendInput = z.infer<typeof spendInputSchema>;

export const spendUpdateSchema = z.object({
  id: z.string().min(1, "Spend ID is required"),
  name: z.string().trim().min(1, "Spend name is required").max(120),
  amount: z.number().positive("Amount must be greater than zero").max(1_000_000_000),
  spend_date: dayString,
  notes: z.string().trim().max(1000).nullable().optional(),
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

    const payload = {
      user_id: userId,
      name: data.name,
      amount: data.amount,
      spend_date: data.spend_date,
      notes: data.notes ?? null,
    };

    // Primary write path: public.spends
    const { data: spendRow, error: spendError } = await supabase
      .from("spends" as any)
      .insert(payload as any)
      .select("*")
      .single();

    if (!spendError && spendRow) {
      return spendRow as unknown as Spend;
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
        created_at: (txnRow as any).created_at,
      };
    }

    throw new Error(spendError?.message || "Failed to create spend record");
  });

/** Update an existing daily spend */
export const updateSpend = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => spendUpdateSchema.parse(data))
  .handler(async ({ data, context }): Promise<Spend> => {
    const { supabase, userId } = context;

    // Try update in public.spends
    const { data: updatedSpend, error: spendError } = await supabase
      .from("spends" as any)
      .update({
        name: data.name,
        amount: data.amount,
        spend_date: data.spend_date,
        notes: data.notes ?? null,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select("*")
      .maybeSingle();

    if (!spendError && updatedSpend) {
      return updatedSpend as unknown as Spend;
    }

    // Fallback try in public.transactions
    const { data: updatedTxn, error: txnError } = await supabase
      .from("transactions" as any)
      .update({
        description: data.name,
        amount: data.amount,
        date: data.spend_date,
        notes: data.notes ?? null,
        updated_at: new Date().toISOString(),
      } as any)
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
        created_at: (updatedTxn as any).created_at,
      };
    }

    throw new Error(spendError?.message || txnError?.message || "Failed to update spend record");
  });

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
      return data as unknown as Spend[];
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
      created_at: t.created_at,
    }));
  });
