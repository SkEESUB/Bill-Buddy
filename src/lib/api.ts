/**
 * Read helpers plus thin wrappers over the server-authoritative mutations.
 *
 * Reads run as the signed-in user, so Row Level Security scopes them
 * automatically. Writes NEVER touch the database from the browser — they call
 * server functions that validate and audit the change.
 */
import { supabase } from "@/lib/supabase";
import { bumpFinance } from "@/lib/finance-sync";
import {
  saveBudget as saveBudgetFn,
  removeBudget as removeBudgetFn,
  saveProfile as saveProfileFn,
  saveSettings as saveSettingsFn,
  type BudgetInput,
  type ProfileInput,
  type SettingsInput,
} from "@/lib/finance.functions";
import {
  createTransaction as createTransactionFn,
  updateTransaction as updateTransactionFn,
  deleteTransaction as deleteTransactionFn,
  type CreateTransactionInput,
  type UpdateTransactionInput,
} from "@/lib/transactions.functions";
import type { Bill, Budget, Payment, Profile, Transaction, UserSettings } from "@/types/database";

export type PaymentWithBill = Payment & { bill: Bill | null };

/** Normalize any thrown/returned error into a readable Error. */
function toError(context: string, error: unknown): Error {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return new Error(`${context}: ${message}`);
}

/** Return the current user's id, or throw when there is no session. */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("You must be signed in to perform this action.");
  }
  return data.user.id;
}

/* ================================ READS ================================ */
/*
 * PostgREST caps a response at 1,000 rows and says nothing about it, so every
 * read here is explicitly bounded and no total is ever derived from a list
 * that could have been cut off. Lifetime totals come from the database.
 */

/** Bills belonging to the current user, sorted by due date ascending. */
export async function getBills(limit = 500): Promise<Bill[]> {
  try {
    await requireUserId();
    const { data, error } = await supabase
      .from("bills")
      .select("*")
      .order("due_date", { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as Bill[];
  } catch (error) {
    throw toError("Failed to load bills", error);
  }
}

/** Most recent payments for the current user, newest first, with the bill joined in. */
export async function getPayments(limit = 300): Promise<PaymentWithBill[]> {
  try {
    await requireUserId();
    const { data, error } = await supabase
      .from("payments")
      .select("*, bill:bills(*)")
      .order("payment_date", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as PaymentWithBill[];
  } catch (error) {
    throw toError("Failed to load payments", error);
  }
}

/**
 * A bounded page of transactions, newest first. Pass a date window when the
 * caller needs a specific period; never use the result for lifetime totals.
 */
export async function getTransactions(
  options: { limit?: number; from?: string; to?: string } = {},
): Promise<Transaction[]> {
  try {
    await requireUserId();
    let query = supabase
      .from("transactions")
      .select("*")
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(options.limit ?? 200);
    if (options.from) query = query.gte("date", options.from);
    if (options.to) query = query.lte("date", options.to);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as unknown as Transaction[];
  } catch (error) {
    throw toError("Failed to load transactions", error);
  }
}

/**
 * Lifetime settled inflow minus outflow, summed in the database so the number
 * stays correct for accounts with more rows than a single response can carry.
 */
export async function getLedgerDelta(): Promise<number> {
  try {
    await requireUserId();
    const { data, error } = await supabase.rpc("ledger_balance_delta");
    if (error) throw error;
    return Number(data ?? 0);
  } catch (error) {
    throw toError("Failed to load balance", error);
  }
}

/** All category budgets for the current user. */
export async function getBudgets(): Promise<Budget[]> {
  try {
    await requireUserId();
    const { data, error } = await supabase.from("budgets").select("*").order("category").limit(500);
    if (error) throw error;
    return (data ?? []) as unknown as Budget[];
  } catch (error) {
    throw toError("Failed to load budgets", error);
  }
}

/** The signed-in user's profile row (created on signup by the backend). */
export async function getProfile(): Promise<Profile> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? { id: userId }) as unknown as Profile;
  } catch (error) {
    throw toError("Failed to load profile", error);
  }
}

/** The signed-in user's settings row (created on signup by the backend). */
export async function getSettings(): Promise<UserSettings> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from("user_settings")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? { user_id: userId }) as unknown as UserSettings;
  } catch (error) {
    throw toError("Failed to load settings", error);
  }
}

/* =============================== WRITES =============================== */
/* All of these delegate to server functions — no direct client writes.   */

/** Record an income or expense entry. */
export async function addTransaction(input: CreateTransactionInput): Promise<Transaction> {
  try {
    const row = await createTransactionFn({
      data: { ...input, client_request_id: input.client_request_id ?? crypto.randomUUID() },
    });
    bumpFinance();
    return row as unknown as Transaction;
  } catch (error) {
    throw toError("Failed to add transaction", error);
  }
}

/** Edit an income or expense entry. Bill payments are not editable here. */
export async function updateTransaction(
  id: string,
  updates: Omit<UpdateTransactionInput, "id">,
): Promise<Transaction> {
  try {
    const row = await updateTransactionFn({ data: { id, ...updates } });
    bumpFinance();
    return row as unknown as Transaction;
  } catch (error) {
    throw toError("Failed to update transaction", error);
  }
}

/** Delete an income or expense entry. Bill payments are not deletable here. */
export async function deleteTransaction(id: string): Promise<void> {
  try {
    await deleteTransactionFn({ data: { id } });
    bumpFinance();
  } catch (error) {
    throw toError("Failed to delete transaction", error);
  }
}

/** Create or replace the budget for a category + period. */
export async function setBudget(budget: BudgetInput): Promise<Budget> {
  try {
    const row = await saveBudgetFn({ data: budget });
    bumpFinance();
    return row as unknown as Budget;
  } catch (error) {
    throw toError("Failed to save budget", error);
  }
}

/** Remove a budget by id. */
export async function deleteBudget(id: string): Promise<void> {
  try {
    await removeBudgetFn({ data: { id } });
    bumpFinance();
  } catch (error) {
    throw toError("Failed to delete budget", error);
  }
}

/** Persist profile edits (name, mobile, default UPI ID, avatar). */
export async function updateProfile(patch: ProfileInput): Promise<Profile> {
  try {
    const row = await saveProfileFn({ data: patch });
    return row as unknown as Profile;
  } catch (error) {
    throw toError("Failed to save profile", error);
  }
}

/** Persist one or more settings values. */
export async function updateSettings(patch: SettingsInput): Promise<UserSettings> {
  try {
    const row = await saveSettingsFn({ data: patch });
    bumpFinance();
    return row as unknown as UserSettings;
  } catch (error) {
    throw toError("Failed to save settings", error);
  }
}
