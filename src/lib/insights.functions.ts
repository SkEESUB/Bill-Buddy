/**
 * Server-computed financial insights. The browser never downloads the full
 * ledger: aggregation runs here over RLS-scoped rows and only results travel.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { z } from "zod";
import {
  INSIGHT_RANGES,
  cashFlow,
  categoryInsights,
  comparePeriods,
  emptyStateHints,
  forecast,
  monthsWithActivity,
  obligationSummary,
  previousRange,
  recurringCommitments,
  resolveInsightRange,
  safeToSpendSummary,
  type BillLike,
  type InsightRangeKey,
} from "./insights";
import { evaluateBudgets, type BudgetRecord } from "./budgets";
import { fetchAllRows } from "@/lib/paged";
import {
  addDays,
  round2,
  todayInTimeZone,
  type ObligationLike,
  type OccurrenceStatus,
  type TxnLike,
} from "./money";

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a YYYY-MM-DD date");

const inputSchema = z.object({
  range: z.enum(INSIGHT_RANGES).default("this_month"),
  from: dayString.nullable().optional(),
  to: dayString.nullable().optional(),
});

export type InsightsInput = z.input<typeof inputSchema>;

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

export const getInsights = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .inputValidator((data: unknown) => inputSchema.parse(data ?? {}))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const today = todayInTimeZone();
    const range = resolveInsightRange(data.range as InsightRangeKey, today, {
      from: data.from ?? null,
      to: data.to ?? null,
    });
    const comparison = previousRange(range);
    // Widest window any calculation needs: the compared window, the selected
    // window, and 6 months of forecast lookback.
    const windowStart = [comparison.from, range.from, addDays(today, -200)].sort()[0] as string;
    const windowEnd = range.to > today ? range.to : today;

    const [detail, balanceRows, billRows, occurrenceRows, budgetRows, settings, txnCount] =
      await Promise.all([
      fetchAllRows<LedgerRow>((from, to) =>
        supabase
          .from("transactions")
          .select("type, status, amount, date, category")
          .eq("user_id", userId)
          .gte("date", windowStart)
          .lte("date", windowEnd)
          .order("date")
          .range(from, to),
      ),
      // All-time balance is aggregated in SQL; row reads cap at 1,000.
      supabase.rpc("ledger_balance_delta"),
      supabase
        .from("bills")
        .select("id, title, category, amount, repeat_type, repeat_interval, repeat_end_date, is_active")
        .eq("user_id", userId),
      fetchAllRows<{
        scheduled_date: string;
        expected_amount: number | string;
        actual_amount: number | string | null;
        status: string;
      }>((from, to) =>
        supabase
          .from("bill_occurrences")
          .select("scheduled_date, expected_amount, actual_amount, status")
          .eq("user_id", userId)
          .order("scheduled_date")
          .range(from, to),
      ),
      supabase
        .from("budgets")
        .select(
          "id, name, category, amount, period, start_date, end_date, is_active, status, warn_threshold, near_limit_threshold, created_at",
        )
        .eq("user_id", userId)
        .eq("status", "active"),
      supabase.from("user_settings").select("starting_balance, currency").eq("user_id", userId).maybeSingle(),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

    const firstError =
      balanceRows.error ??
      billRows.error ??
      budgetRows.error ??
      settings.error;
    if (firstError) throw new Error(firstError.message);

    const windowed = toTxns(detail);

    const occurrences: ObligationLike[] = occurrenceRows.map((row) => ({
      scheduled_date: row.scheduled_date,
      expected_amount: Number(row.expected_amount),
      actual_amount: row.actual_amount === null ? null : Number(row.actual_amount),
      status: row.status as OccurrenceStatus,
    }));

    const bills = (billRows.data ?? []) as unknown as BillLike[];
    const budgets = (budgetRows.data ?? []) as unknown as BudgetRecord[];

    const available = round2(
      Number(settings.data?.starting_balance ?? 0) + Number(balanceRows.data ?? 0),
    );
    const obligations = obligationSummary(occurrences, today);
    const commitments = recurringCommitments(bills, today);
    const safe = safeToSpendSummary({
      available,
      reserved: obligations.thisMonth,
      today,
    });

    return {
      today,
      currency: settings.data?.currency ?? "INR",
      range,
      comparisonRange: comparison,
      cashFlow: cashFlow(windowed, range.from, range.to),
      previousCashFlow: cashFlow(windowed, comparison.from, comparison.to),
      categories: categoryInsights(windowed, range, comparison),
      comparison: comparePeriods(windowed, range, comparison),
      obligations,
      commitments,
      safe,
      budgets: evaluateBudgets(budgets, windowed, today),
      forecast: forecast({
        transactions: windowed,
        available,
        today,
        obligations: obligations.all,
      }),
      dataAvailability: {
        transactionCount: txnCount.count ?? 0,
        monthsOfHistory: monthsWithActivity(windowed),
        recurringBills: commitments.items.length,
        budgetCount: budgets.length,
      },
      hints: emptyStateHints({
        transactionCount: txnCount.count ?? 0,
        monthsOfHistory: monthsWithActivity(windowed),
        recurringBills: commitments.items.length,
        budgetCount: budgets.length,
      }),
    };
  });

export type InsightsPayload = Awaited<ReturnType<typeof getInsights>>;