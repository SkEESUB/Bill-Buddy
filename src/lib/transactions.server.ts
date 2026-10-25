/**
 * Server-only ledger queries. Kept out of `*.functions.ts` module scope so the
 * query builder never ships to the browser.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export type LedgerFilters = {
  search?: string | null | undefined;
  type?: string | null | undefined;
  status?: string | null | undefined;
  category?: string | null | undefined;
  payment_method?: string | null | undefined;
  from?: string | null | undefined;
  to?: string | null | undefined;
};

const SELECT_COLUMNS =
  "id, type, status, amount, currency, category, description, notes, date, payment_method, external_reference, bill_occurrence_id, reversal_of, reversed_by, source, created_at, updated_at";

/** Escape PostgREST `or()` special characters in a user-supplied search term. */
function safeTerm(term: string): string {
  return term
    .replace(/[,()\\]/g, " ")
    .replace(/%/g, "")
    .trim();
}

/**
 * Build the filtered ledger query for one user. Every filter is applied in the
 * database — the browser never receives rows it is not allowed to see and
 * never filters a full history locally.
 */
export function ledgerQuery(db: Db, userId: string, filters: LedgerFilters, count = false) {
  let query = db
    .from("transactions")
    .select(SELECT_COLUMNS, count ? { count: "exact" } : undefined)
    .eq("user_id", userId);

  if (filters.type && filters.type !== "all") query = query.eq("type", filters.type);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.category && filters.category !== "all")
    query = query.eq("category", filters.category);
  if (filters.payment_method && filters.payment_method !== "all") {
    query = query.eq("payment_method", filters.payment_method);
  }
  if (filters.from) query = query.gte("date", filters.from);
  if (filters.to) query = query.lte("date", filters.to);

  const term = safeTerm(filters.search ?? "");
  if (term) {
    query = query.or(
      [
        `description.ilike.*${term}*`,
        `category.ilike.*${term}*`,
        `notes.ilike.*${term}*`,
        `external_reference.ilike.*${term}*`,
      ].join(","),
    );
  }

  return query.order("date", { ascending: false }).order("created_at", { ascending: false });
}

/** Bill titles for a set of occurrence ids, used by detail views and exports. */
export async function billTitlesForOccurrences(
  db: Db,
  userId: string,
  occurrenceIds: string[],
): Promise<Map<string, string>> {
  const ids = [...new Set(occurrenceIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const { data, error } = await db
    .from("bill_occurrences")
    .select("id, bill:bills(title)")
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as unknown as { id: string; bill: { title: string } | null }[]) {
    if (row.bill?.title) map.set(row.id, row.bill.title);
  }
  return map;
}
