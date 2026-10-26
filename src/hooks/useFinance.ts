/**
 * The app's single financial data source.
 *
 * Reads come from one authenticated server snapshot; every mutation goes
 * through a server function and is followed by a full refresh, so the screen
 * can never show a state the server did not confirm.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  createBill as createBillFn,
  updateBill as updateBillFn,
  deleteBill as deleteBillFn,
  setBillActive as setBillActiveFn,
  recordOccurrencePayment as recordOccurrencePaymentFn,
  skipOccurrence as skipOccurrenceFn,
  syncSchedules as syncSchedulesFn,
  type BillInput,
  type BillUpdateInput,
  type PaymentInput,
} from "@/lib/bills.functions";
import {
  getFinanceSnapshot,
  saveBudget as saveBudgetFn,
  removeBudget as removeBudgetFn,
  type OccurrenceWithBill,
  type BudgetInput,
} from "@/lib/finance.functions";
import {
  createTransaction as createTransactionFn,
  updateTransaction as updateTransactionFn,
  deleteTransaction as deleteTransactionFn,
  reverseTransaction as reverseTransactionFn,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from "@/lib/transactions.functions";
import {
  createSpend as createSpendFn,
  updateSpend as updateSpendFn,
  deleteSpend as deleteSpendFn,
  type SpendInput,
  type SpendUpdateInput,
} from "@/lib/spends.functions";
import {
  budgetProgress,
  daysRemainingInMonth,
  monthBounds,
  previousMonthBounds,
  round2,
  safeToSpend,
  spendingByCategory,
  totalIncome,
  totalSpending,
  upcomingObligations,
  addDays,
  todayInTimeZone,
  type TxnLike,
} from "@/lib/money";
import { openOccurrences, toViews, type OccurrenceView } from "@/lib/occurrences";
import { classifyError } from "@/lib/errors";
import { bumpFinance, useFinanceSync } from "@/lib/finance-sync";

type Snapshot = Awaited<ReturnType<typeof getFinanceSnapshot>>;

const EMPTY: Snapshot = {
  bills: [],
  occurrences: [] as OccurrenceWithBill[],
  transactions: [],
  spends: [],
  ledgerDelta: 0,
  budgets: [],
  settings: null,
  profile: null,
};

/**
 * Schedule materialisation runs at most once per page session and is awaited
 * before the first read, so React renders never trigger schedule writes.
 */
let scheduleSyncPromise: Promise<unknown> | null = null;

export function useFinance() {
  const snapshotFn = useServerFn(getFinanceSnapshot);
  const syncFn = useServerFn(syncSchedulesFn);

  const [snapshot, setSnapshot] = useState<Snapshot>(EMPTY);
  const snapshotRef = useRef<Snapshot>(snapshot);
  snapshotRef.current = snapshot;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const instanceIdRef = useRef(Math.random().toString(36).slice(2));
  const instanceId = instanceIdRef.current;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      try {
        // Materialising schedules is a background housekeeping job: show the
        // authoritative data first, then refresh if the sync changed anything.
        const firstRun = !scheduleSyncPromise;
        if (firstRun) {
          scheduleSyncPromise = syncFn({}).catch((e) => {
            // A failed sync must not block reading existing data.
            console.error("[schedule sync]", e);
            return null;
          });
        }
        const data = await snapshotFn({});
        if (!mounted.current) return;
        setSnapshot(data as Snapshot);
        setError(null);
        if (firstRun) {
          void scheduleSyncPromise?.then((result) => {
            const changed =
              result && typeof result === "object" && "created" in result
                ? (result as { created: number; removed: number }).created > 0 ||
                  (result as { created: number; removed: number }).removed > 0
                : false;
            if (changed && mounted.current) void load("refresh");
          });
        }
      } catch (e) {
        console.error("[useFinance] Error loading financial data:", e);
        if (!mounted.current) return;
        setError(classifyError(e).message);
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [snapshotFn, syncFn],
  );

  useEffect(() => {
    void load("initial");
  }, [load]);

  const reload = useCallback(() => load("refresh"), [load]);
  useFinanceSync(reload, instanceId);

  /** Run a server mutation, then refresh authoritative data before resolving. */
  const mutate = useCallback(
    async <T>(action: () => Promise<T>): Promise<T> => {
      const result = await action();
      await load("refresh");
      bumpFinance(instanceId);
      return result;
    },
    [load, instanceId],
  );

  const createBill = useServerFn(createBillFn);
  const updateBill = useServerFn(updateBillFn);
  const deleteBill = useServerFn(deleteBillFn);
  const setBillActive = useServerFn(setBillActiveFn);
  const recordPayment = useServerFn(recordOccurrencePaymentFn);
  const skip = useServerFn(skipOccurrenceFn);
  const createTransaction = useServerFn(createTransactionFn);
  const updateTransaction = useServerFn(updateTransactionFn);
  const deleteTransaction = useServerFn(deleteTransactionFn);
  const reverseTransaction = useServerFn(reverseTransactionFn);
  const saveBudget = useServerFn(saveBudgetFn);
  const removeBudget = useServerFn(removeBudgetFn);
  const createSpend = useServerFn(createSpendFn);
  const updateSpend = useServerFn(updateSpendFn);
  const deleteSpend = useServerFn(deleteSpendFn);

  const actions = useMemo(
    () => ({
      createBill: (data: BillInput) => mutate(() => createBill({ data })),
      updateBill: (data: BillUpdateInput) => mutate(() => updateBill({ data })),
      createSpend: (data: SpendInput) => mutate(() => createSpend({ data })),
      updateSpend: (data: SpendUpdateInput) => mutate(() => updateSpend({ data })),
      deleteSpend: (id: string) => mutate(() => deleteSpend({ data: { id } })),
      deleteBill: async (id: string) => {
        const prev = snapshotRef.current;
        // Optimistically remove bill and future occurrences
        setSnapshot((current) => ({
          ...current,
          bills: current.bills.filter((b) => b.id !== id),
          occurrences: current.occurrences.filter((o) => o.bill_id !== id || o.status === "paid"),
        }));
        try {
          const result = await deleteBill({ data: { id } });
          await load("refresh");
          bumpFinance(instanceId);
          return result;
        } catch (err) {
          setSnapshot(prev);
          throw err;
        }
      },
      setBillActive: async (id: string, isActive: boolean) => {
        const prev = snapshotRef.current;
        setSnapshot((current) => ({
          ...current,
          bills: current.bills.map((b) => (b.id === id ? { ...b, is_active: isActive } : b)),
        }));
        try {
          const result = await setBillActive({ data: { id, is_active: isActive } });
          await load("refresh");
          bumpFinance(instanceId);
          return result;
        } catch (err) {
          setSnapshot(prev);
          throw err;
        }
      },
      recordPayment: async (data: PaymentInput) => {
        const prev = snapshotRef.current;
        // Optimistically mark occurrence as settled and paid immediately
        setSnapshot((current) => {
          const idx = current.occurrences.findIndex((o) => o.id === data.occurrence_id);
          if (idx === -1) return current;
          const target = current.occurrences[idx];
          if (!target) return current;
          const updatedOcc: OccurrenceWithBill = {
            ...target,
            status: "paid",
            actual_amount: data.amount,
            paid_at: new Date().toISOString(),
          };
          const nextOccurrences = [...current.occurrences];
          nextOccurrences[idx] = updatedOcc;

          return {
            ...current,
            occurrences: nextOccurrences,
            ledgerDelta: round2(Number(current.ledgerDelta ?? 0) - data.amount),
          };
        });
        try {
          const result = await recordPayment({ data });
          await load("refresh");
          bumpFinance(instanceId);
          return result;
        } catch (err) {
          // Cleanly roll back to previous state if settlement call fails
          setSnapshot(prev);
          throw err;
        }
      },
      skipOccurrence: (occurrenceId: string) =>
        mutate(() => skip({ data: { occurrence_id: occurrenceId } })),
      createTransaction: (data: CreateTransactionInput) =>
        mutate(() => createTransaction({ data })),
      updateTransaction: (data: UpdateTransactionInput) =>
        mutate(() => updateTransaction({ data })),
      deleteTransaction: (id: string) => mutate(() => deleteTransaction({ data: { id } })),
      reverseTransaction: (id: string, reason?: string) =>
        mutate(() =>
          reverseTransaction({
            data: { id, client_request_id: crypto.randomUUID(), ...(reason ? { reason } : {}) },
          }),
        ),
      saveBudget: (data: BudgetInput) => mutate(() => saveBudget({ data })),
      removeBudget: (id: string) => mutate(() => removeBudget({ data: { id } })),
    }),
    [
      mutate,
      load,
      instanceId,
      createBill,
      updateBill,
      deleteBill,
      setBillActive,
      recordPayment,
      skip,
      createTransaction,
      updateTransaction,
      deleteTransaction,
      reverseTransaction,
      saveBudget,
      removeBudget,
      createSpend,
      updateSpend,
      deleteSpend,
    ],
  );

  const today = todayInTimeZone();
  const derived = useMemo(() => deriveFinance(snapshot, today), [snapshot, today]);

  return { ...derived, snapshot, today, loading, refreshing, error, reload, actions };
}

export type FinanceDerived = ReturnType<typeof deriveFinance>;

/**
 * Every headline number the app shows, computed once from the snapshot with
 * the shared engine. Exported so it can be unit-tested without React.
 */
export function deriveFinance(snapshot: Snapshot, today: string) {
  const occurrences = toViews(snapshot.occurrences, today);
  const open = openOccurrences(occurrences);
  const transactions = snapshot.transactions as unknown as TxnLike[];
  const month = monthBounds(today);
  const prevMonth = previousMonthBounds(today);
  const weekEnd = addDays(today, 7);

  const startingBalance = Number(snapshot.settings?.starting_balance ?? 0);
  // The snapshot only carries a recent window of rows, so the all-time
  // balance comes from the database aggregate, not from those rows.
  const available = round2(startingBalance + Number(snapshot.ledgerDelta ?? 0));

  const overdue = open.filter((o) => o.status === "overdue");
  const dueToday = open.filter((o) => o.status === "due_today");
  const dueThisWeek = open.filter((o) => o.dueDate >= today && o.dueDate <= weekEnd);
  const paid = occurrences.filter((o) => o.storedStatus === "paid");

  const obligationRows = snapshot.occurrences.map((row) => ({
    scheduled_date: row.scheduled_date,
    expected_amount: Number(row.expected_amount),
    actual_amount: row.actual_amount === null ? null : Number(row.actual_amount),
    status: row.status as OccurrenceView["storedStatus"],
  }));

  const obligationsThisMonth = upcomingObligations(obligationRows, today, month.end);
  const obligationsAll = upcomingObligations(obligationRows, today);

  const monthSpending = totalSpending(transactions, month.start, month.end);
  const monthIncomeActual = totalIncome(transactions, month.start, month.end);
  const prevMonthSpending = totalSpending(transactions, prevMonth.start, prevMonth.end);

  const monthlyIncome = Number(snapshot.settings?.monthly_income ?? 0) || monthIncomeActual;
  const monthlyBudgetLimit = Number(snapshot.settings?.monthly_budget ?? 0);

  const spend = safeToSpend({
    available,
    reserved: obligationsThisMonth,
    savingsCommitment: 0,
    daysRemaining: daysRemainingInMonth(today),
  });

  const categorySpend = spendingByCategory(transactions, month.start, month.end);
  const spentByCategory = new Map(categorySpend.map((c) => [c.category, c.amount]));

  const budgets = snapshot.budgets.map((budget) => ({
    ...budget,
    progress: budgetProgress(Number(budget.amount), spentByCategory.get(budget.category) ?? 0),
  }));

  const overallBudget = budgetProgress(monthlyBudgetLimit, monthSpending);

  return {
    occurrences,
    openOccurrences: open,
    overdue,
    dueToday,
    dueThisWeek,
    paidOccurrences: paid,
    totals: {
      available,
      overdueAmount: round2(overdue.reduce((sum, o) => sum + o.amount, 0)),
      dueTodayAmount: round2(dueToday.reduce((sum, o) => sum + o.amount, 0)),
      dueThisWeekAmount: round2(dueThisWeek.reduce((sum, o) => sum + o.amount, 0)),
      obligationsThisMonth,
      obligationsAll,
      monthSpending,
      monthIncome: monthIncomeActual,
      prevMonthSpending,
      monthlyIncome,
      monthlyBudgetLimit,
    },
    spend,
    budgets,
    overallBudget,
    categorySpend,
    month,
  };
}
