/**
 * PostgREST silently caps a single response at 1,000 rows. Any aggregate built
 * from an unbounded `select()` therefore goes quietly wrong once an account
 * grows past that. Every server-side read that feeds a total must page.
 */
export type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/** Read every matching row in 1,000-row pages, with a hard safety ceiling. */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  options: { pageSize?: number; max?: number } = {},
): Promise<T[]> {
  const pageSize = options.pageSize ?? 1000;
  const max = options.max ?? 100_000;
  const rows: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}
