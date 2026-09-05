/** Job health, for administrators only. Ordinary users never see these rows. */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";

export type JobRunRow = {
  id: string;
  job: string;
  run_key: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  processed: number;
  created: number;
  failed: number;
  retry_count: number;
  error: string | null;
};

export const listJobRuns = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    // RLS already restricts this table to super admins; the explicit check
    // keeps the failure mode obvious instead of returning a silent empty list.
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await context.supabase
      .from("job_runs")
      .select(
        "id, job, run_key, status, started_at, finished_at, duration_ms, processed, created, failed, retry_count, error",
      )
      .order("started_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as JobRunRow[];
  });
