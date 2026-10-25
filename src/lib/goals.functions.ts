// src/lib/goals.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { classifyError } from "@/lib/errors";

export interface SpendingGoalRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  category: string | null;
  status: "active" | "completed" | "cancelled";
  created_at: string;
  updated_at: string;
}

export const listGoals = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    try {
      const db = context.supabase;
      const { data, error } = await db
        .from("spending_goals")
        .select("*")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as unknown as SpendingGoalRow[];
    } catch (error) {
      throw new Error(classifyError(error).message);
    }
  });

const createGoalSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  target_amount: z.number().positive(),
  target_date: z.string().optional(),
  category: z.string().optional(),
});

export const createGoal = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((d: unknown) => createGoalSchema.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const db = context.supabase;
      const { data: goal, error } = await db
        .from("spending_goals")
        .insert({ ...data, user_id: context.userId } as never)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return goal as unknown as SpendingGoalRow;
    } catch (error) {
      throw new Error(classifyError(error).message);
    }
  });

const contributeSchema = z.object({
  goal_id: z.string().uuid(),
  amount: z.number().positive(),
});

export const contributeToGoal = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((d: unknown) => contributeSchema.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const db = context.supabase;

      // Get current goal
      const { data: goal, error: fetchError } = await db
        .from("spending_goals")
        .select("*")
        .eq("id", data.goal_id)
        .eq("user_id", context.userId)
        .single();
      if (fetchError || !goal) throw new Error("Goal not found");

      const newAmount = Number((goal as any).current_amount) + data.amount;
      const newStatus = newAmount >= Number((goal as any).target_amount) ? "completed" : "active";

      const { error: updateError } = await db
        .from("spending_goals")
        .update({
          current_amount: newAmount,
          status: newStatus,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", data.goal_id)
        .eq("user_id", context.userId);
      if (updateError) throw new Error(updateError.message);

      return { success: true, new_amount: newAmount, status: newStatus };
    } catch (error) {
      throw new Error(classifyError(error).message);
    }
  });

const deleteGoalSchema = z.object({ id: z.string().uuid() });

export const deleteGoal = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((d: unknown) => deleteGoalSchema.parse(d))
  .handler(async ({ data, context }) => {
    try {
      const db = context.supabase;
      const { error } = await db
        .from("spending_goals")
        .delete()
        .eq("id", data.id)
        .eq("user_id", context.userId);
      if (error) throw new Error(error.message);
      return { success: true };
    } catch (error) {
      throw new Error(classifyError(error).message);
    }
  });
