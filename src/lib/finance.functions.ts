/**
 * Server-authoritative money operations and the single read snapshot the app
 * renders from. Components never write to the database directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { fetchAllRows } from "@/lib/paged";
import { addDays, monthBounds, previousMonthBounds, todayInTimeZone } from "@/lib/money";
import { z } from "zod";

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

export type OccurrenceWithBill = {
  id: string;
  bill_id: string;
  scheduled_date: string;
  expected_amount: number;
  actual_amount: number | null;
  status: string;
  paid_at: string | null;
  transaction_id: string | null;
  bill: {
    id: string;
    title: string;
    category: string;
    amount: number;
    upi_id: string | null;
    notes: string | null;
    repeat_type: string;
    repeat_interval: number;
    repeat_end_date: string | null;
    reminder_days_before: number;
    is_active: boolean;
    due_date: string;
    created_at: string;
  } | null;
};

/**
 * Everything the dashboard, bills, money, history and analytics screens need,
 * read in one authenticated round trip so no two screens can disagree.
 */
export const getFinanceSnapshot = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Bounded windows keep the payload small; anything feeding an all-time
    // total is aggregated in SQL instead of shipped as rows.
    const today = todayInTimeZone();
    const txnFrom = previousMonthBounds(today).start;
    const txnTo = monthBounds(today).end;
    const occFrom = addDays(today, -400);
    const occTo = addDays(today, 400);

    const [bills, occurrences, transactions, budgets, settings, profile, balance] =
      await Promise.all([
        supabase.from("bills").select("*").eq("user_id", userId).order("due_date").limit(1000),
        fetchAllRows((from, to) =>
          supabase
            .from("bill_occurrences")
            .select(
              "id, bill_id, scheduled_date, expected_amount, actual_amount, status, paid_at, transaction_id, bill:bills(id, title, category, amount, upi_id, notes, repeat_type, repeat_interval, repeat_end_date, reminder_days_before, is_active, due_date, created_at)",
            )
            .eq("user_id", userId)
            .gte("scheduled_date", occFrom)
            .lte("scheduled_date", occTo)
            .order("scheduled_date")
            .range(from, to),
        ),
        fetchAllRows((from, to) =>
          supabase
            .from("transactions")
            .select("*")
            .eq("user_id", userId)
            .gte("date", txnFrom)
            .lte("date", txnTo)
            .order("date", { ascending: false })
            .range(from, to),
        ),
        supabase.from("budgets").select("*").eq("user_id", userId).limit(1000),
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.rpc("ledger_balance_delta"),
      ]);

    const firstError = bills.error ?? budgets.error ?? settings.error ?? profile.error ?? balance.error;
    if (firstError) throw new Error(firstError.message);

    return {
      bills: bills.data ?? [],
      occurrences: occurrences as unknown as OccurrenceWithBill[],
      transactions,
      /** All-time settled inflow minus outflow, aggregated in the database. */
      ledgerDelta: Number(balance.data ?? 0),
      budgets: budgets.data ?? [],
      settings: settings.data ?? null,
      profile: profile.data ?? null,
    };
  });

/* Transactions live in `transactions.functions.ts` — the ledger owns those writes. */

/* ------------------------------- budgets ------------------------------- */

const budgetInput = z.object({
  category: z.string().trim().min(1).max(60),
  amount: z.number().positive("Enter a valid amount.").max(1_000_000_000),
  period: z.enum(["weekly", "monthly", "yearly"]).default("monthly"),
});

export type BudgetInput = z.input<typeof budgetInput>;

export const saveBudget = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((data: unknown) => budgetInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    // Only one active budget may exist per category + period, so update the
    // existing one when present instead of creating a duplicate.
    const { data: existing, error: lookupError } = await supabase
      .from("budgets")
      .select("id")
      .eq("user_id", userId)
      .eq("category", data.category)
      .eq("period", data.period)
      .eq("status", "active")
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);

    const query = existing
      ? supabase
          .from("budgets")
          .update({ amount: data.amount } as never)
          .eq("id", (existing as { id: string }).id)
          .eq("user_id", userId)
      : supabase.from("budgets").insert({ ...data, user_id: userId } as never);

    const { data: row, error } = await query.select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const removeBudget = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("budgets")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* --------------------------- profile + settings --------------------------- */

const profileInput = z.object({
  full_name: z.string().trim().max(120).nullable().optional(),
  mobile: z.string().trim().max(20).nullable().optional(),
  default_upi_id: z.string().trim().max(120).nullable().optional(),
  avatar_url: z.string().trim().max(500).nullable().optional(),
  onboarding_completed: z.boolean().optional(),
  onboarding_step: z.number().int().min(0).max(10).optional(),
});

export type ProfileInput = z.infer<typeof profileInput>;

export const saveProfile = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((data: unknown) => profileInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("profiles")
      .upsert({ id: userId, ...data } as never, { onConflict: "id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const settingsInput = z.object({
  currency: z.string().trim().length(3).optional(),
  monthly_income: z.number().min(0).max(1_000_000_000).optional(),
  monthly_budget: z.number().min(0).max(1_000_000_000).optional(),
  starting_balance: z.number().min(-1_000_000_000).max(1_000_000_000).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  reduced_motion: z.boolean().optional(),
  default_budget_period: z.enum(["weekly", "monthly", "quarterly", "yearly", "custom"]).optional(),
  default_warn_threshold: z.number().min(1).max(98).optional(),
  default_near_limit_threshold: z.number().min(2).max(99).optional(),
  notify_bill_reminders: z.boolean().optional(),
  notify_due_today: z.boolean().optional(),
  notify_due_tomorrow: z.boolean().optional(),
  notify_overdue: z.boolean().optional(),
  notify_payment_recorded: z.boolean().optional(),
  notify_weekly_summary: z.boolean().optional(),
  notify_monthly_summary: z.boolean().optional(),
});

export type SettingsInput = z.infer<typeof settingsInput>;

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .inputValidator((data: unknown) => settingsInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("user_settings")
      .upsert({ user_id: userId, ...data } as never, { onConflict: "user_id" })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
