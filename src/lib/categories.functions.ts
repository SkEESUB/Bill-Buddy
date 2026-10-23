/**
 * Category management. System categories are read-only; custom ones belong to
 * the caller and can only be deleted when nothing references them.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { z } from "zod";

export type CategoryRow = {
  id: string;
  user_id: string | null;
  name: string;
  type: string;
  icon: string;
  color: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
};

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("categories")
      .select("*")
      .order("is_system", { ascending: false })
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as CategoryRow[];
  });

const categoryInput = z.object({
  name: z.string().trim().min(1).max(40),
  type: z.enum(["expense", "income", "both"]).default("expense"),
  icon: z.string().trim().min(1).max(8).default("🏷️"),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour")
    .default("#8e6fa8"),
});

export type CategoryInput = z.input<typeof categoryInput>;

export const createCategory = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => categoryInput.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: clash } = await supabase
      .from("categories")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", data.name)
      .maybeSingle();
    if (clash) throw new Error("You already have a category with that name.");

    const { data: row, error } = await supabase
      .from("categories")
      .insert({ ...data, user_id: userId, is_system: false } as never)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as CategoryRow;
  });

export const updateCategory = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    categoryInput
      .partial()
      .extend({ id: z.string().uuid(), is_active: z.boolean().optional() })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("categories")
      .update(patch as never)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select("*")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("System categories cannot be edited.");
    return row as unknown as CategoryRow;
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: category, error: lookupError } = await supabase
      .from("categories")
      .select("id, name, is_system")
      .eq("id", data.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (lookupError) throw new Error(lookupError.message);
    if (!category) throw new Error("System categories cannot be deleted.");

    const name = (category as { name: string }).name;
    const [bills, transactions, budgets] = await Promise.all([
      supabase
        .from("bills")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("category", name),
      supabase
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("category", name),
      supabase
        .from("budgets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("category", name),
    ]);
    const used = (bills.count ?? 0) + (transactions.count ?? 0) + (budgets.count ?? 0);
    if (used > 0) {
      throw new Error(
        `${name} is used by ${used} record${used === 1 ? "" : "s"}. Hide it instead of deleting.`,
      );
    }

    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });