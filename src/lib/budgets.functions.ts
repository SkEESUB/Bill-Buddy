/**
 * Server-authoritative budget management. All evaluation happens on the
 * server from RLS-scoped rows; the browser receives computed results only.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { fetchAllRows } from "@/lib/paged";
import { z } from "zod";
import {
  BUDGET_PERIODS,
  BUDGET_STATES,
  budgetHistory,
  currentCycle,
  evaluateBudget,
  evaluateBudgets,
  type BudgetEvaluation,
  type BudgetRecord,
} from "./budgets";
import { todayInTimeZone, type TxnLike } from "./money";

const BUDGET_COLUMNS =
  "id, name, category, amount, period, start_date, end_date, is_active, status, warn_threshold, near_limit_threshold, created_at";

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

const budgetFields = z.object({
  name: z.string().trim().max(80).optional(),
  category: z.string().trim().min(1).max(60),
  amount: z.number().positive("Enter an amount greater than 0.").max(1_000_000_000),
  period: z.enum(BUDGET_PERIODS),
  start_date: dayString,
  end_date: dayString.nullable().optional(),
  warn_threshold: z.number().min(1).max(99).optional(),
  near_limit_threshold: z.number().min(2).max(100).optional(),
});

export type BudgetFormInput = z.input<typeof budgetFields>;

function assertThresholds(warn?: number, near?: number) {
  const w = warn ?? 50;
  const n = near ?? 80;
  if (w >= n) throw new Error("The warning threshold must be lower than the near-limit threshold.");
}

type LedgerRow = { type: string; status: string; amount: number | string; date: string; category: string };

function toTxns(rows: LedgerRow[]): TxnLike[] {
  return rows.map((r) => ({
    type: r.type as TxnLike["type"],
    status: r.status,
    amount: Number(r.amount),
    date: r.date,
    category: r.category,
  }));
}

/** Every budget with its evaluated progress for the current cycle. */
export const listBudgets = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const today = todayInTimeZone();

    const { data: budgetRows, error } = await supabase
      .from("budgets")
      .select(BUDGET_COLUMNS)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const budgets = (budgetRows ?? []) as unknown as BudgetRecord[];
    if (budgets.length === 0) {
      return { today, budgets: [] as BudgetEvaluation[] };
    }

    // One windowed query covering every budget cycle — never one per budget.
    const earliest = budgets
      .map((b) => currentCycle(b, today).start)
      .sort()[0] as string;

    const txnRows = await fetchAllRows<LedgerRow>((from, to) =>
      supabase
        .from("transactions")
        .select("type, status, amount, date, category")
        .eq("user_id", userId)
        .gte("date", earliest)
        .lte("date", today)
        .order("date")
        .range(from, to),
    );

    return {
      today,
      budgets: evaluateBudgets(budgets, toTxns(txnRows), today),
    };
  });

/** One budget: evaluation, per-cycle history and the rows that fed it. */
export const getBudgetDetail = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = todayInTimeZone();

    const { data: row, error } = await supabase
      .from("budgets")
      .select(BUDGET_COLUMNS)
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Budget not found.");

    const budget = row as unknown as BudgetRecord;
    const cycle = currentCycle(budget, today);
    const historyStart = budget.start_date < cycle.start ? budget.start_date : cycle.start;

    // Paged: totals must see every row, not the first page PostgREST returns.
    const txnRows = await fetchAllRows((from, to) =>
      supabase
        .from("transactions")
        .select("id, type, status, amount, date, category, description, payment_method")
        .eq("user_id", userId)
        .eq("category", budget.category)
        .gte("date", historyStart)
        .lte("date", today)
        .order("date", { ascending: false })
        .range(from, to),
    );

    const rows = txnRows as unknown as (LedgerRow & {
      id: string;
      description: string | null;
      payment_method: string | null;
    })[];
    const txns = toTxns(rows);

    return {
      today,
      budget,
      evaluation: evaluateBudget(budget, txns, today),
      history: budgetHistory(budget, txns, today),
      transactions: rows
        .filter((r) => r.date >= cycle.start && r.date <= cycle.end)
        .slice(0, 500)
        .map((r) => ({ ...r, amount: Number(r.amount) })),
    };
  });

export const createBudget = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => budgetFields.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    assertThresholds(data.warn_threshold, data.near_limit_threshold);
    if (data.period === "custom" && !data.end_date) {
      throw new Error("A custom budget needs an end date.");
    }
    if (data.end_date && data.end_date < data.start_date) {
      throw new Error("The end date must be after the start date.");
    }

    const { data: row, error } = await supabase
      .from("budgets")
      .insert({
        user_id: userId,
        name: data.name?.trim() || null,
        category: data.category,
        amount: data.amount,
        period: data.period,
        start_date: data.start_date,
        end_date: data.end_date ?? null,
        warn_threshold: data.warn_threshold ?? 50,
        near_limit_threshold: data.near_limit_threshold ?? 80,
        status: "active",
        is_active: true,
      } as never)
      .select(BUDGET_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("An active budget already exists for this category and period.");
      }
      throw new Error(error.message);
    }
    return row;
  });

export const updateBudget = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    budgetFields.partial().extend({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { id, ...fields } = data;
    if (fields.warn_threshold !== undefined || fields.near_limit_threshold !== undefined) {
      assertThresholds(fields.warn_threshold, fields.near_limit_threshold);
    }
    const patch: Record<string, unknown> = { ...fields };
    if (fields.name !== undefined) patch["name"] = fields.name?.trim() || null;

    const { data: row, error } = await supabase
      .from("budgets")
      .update(patch as never)
      .eq("id", id)
      .eq("user_id", userId)
      .select(BUDGET_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

/** Pause, resume or archive a budget. Archived budgets stay readable. */
export const setBudgetState = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(BUDGET_STATES) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("budgets")
      .update({ status: data.status, is_active: data.status === "active" } as never)
      .eq("id", data.id)
      .eq("user_id", userId)
      .select(BUDGET_COLUMNS)
      .single();
    if (error) {
      if (error.code === "23505") {
        throw new Error("Another active budget already covers this category and period.");
      }
      throw new Error(error.message);
    }
    return row;
  });

export const deleteBudget = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
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