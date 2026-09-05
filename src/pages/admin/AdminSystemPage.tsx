import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Play } from "lucide-react";
import { listJobRunsAdmin, retryJob } from "@/lib/admin.functions";
import { formatDateTime } from "@/lib/format";
import { toUserMessage } from "@/lib/errors";
import { Can, DataCard, Loading, StatusPill } from "./ui";

const STATUS_MAP: Record<string, string> = {
  success: "HEALTHY",
  partial: "DEGRADED",
  running: "UNKNOWN",
  failed: "FAILING",
};

/** Scheduled automation: run history and manual, idempotent re-runs. */
export function AdminSystemPage() {
  const fetchRuns = useServerFn(listJobRunsAdmin);
  const runJob = useServerFn(retryJob);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "jobs"],
    queryFn: () => fetchRuns(),
    refetchInterval: 30_000,
  });

  const trigger = useMutation({
    mutationFn: (job: "sweep" | "retention") => runJob({ data: { job } }),
    onSuccess: (result) => {
      toast.success(
        result.ran
          ? `Job finished — ${result.created} notifications created, ${result.failed} failed`
          : "Already running for this window — nothing duplicated",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "jobs"] });
    },
    onError: (e) => toast.error(toUserMessage(e)),
  });

  return (
    <div className="space-y-5">
      <Can permission="jobs.retry">
        <DataCard title="Run a job now">
          <p className="text-[13px] text-text-secondary">
            Both jobs are claim-locked and idempotent: running one manually can never duplicate
            reminders or delete extra data.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn btn-primary !min-h-10 !px-4 !text-xs"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate("sweep")}
            >
              <Play className="h-3.5 w-3.5" /> Notification sweep
            </button>
            <button
              type="button"
              className="btn btn-secondary !min-h-10 !px-4 !text-xs"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate("retention")}
            >
              <Play className="h-3.5 w-3.5" /> Retention
            </button>
          </div>
        </DataCard>
      </Can>

      <DataCard title="Recent runs">
        {isLoading ? (
          <Loading />
        ) : (data?.length ?? 0) === 0 ? (
          <p className="text-sm text-text-secondary">No job runs recorded yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data?.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{run.job}</p>
                  <p className="text-[12px] text-text-secondary">
                    {formatDateTime(run.started_at)} · {run.processed} processed · {run.created} created ·{" "}
                    {run.failed} failed
                    {run.retry_count > 0 ? ` · retry ${run.retry_count}` : ""}
                    {run.duration_ms ? ` · ${run.duration_ms} ms` : ""}
                  </p>
                  {run.error && <p className="text-[12px] text-error">{run.error}</p>}
                </div>
                <StatusPill status={STATUS_MAP[run.status] ?? "UNKNOWN"} />
              </li>
            ))}
          </ul>
        )}
      </DataCard>
    </div>
  );
}