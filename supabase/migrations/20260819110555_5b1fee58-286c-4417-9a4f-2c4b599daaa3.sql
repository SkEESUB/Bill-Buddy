CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'bill_due','bill_overdue','payment_success','payment_failed',
  'budget_warning','budget_exceeded','weekly_summary','security','system','insight'
]));

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_budget_id uuid REFERENCES public.budgets(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_retention_idx
  ON public.notifications (created_at)
  WHERE read_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  run_key text NOT NULL,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','success','partial','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  processed integer NOT NULL DEFAULT 0,
  created integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  retry_count integer NOT NULL DEFAULT 0,
  error text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS job_runs_run_key_idx ON public.job_runs (job, run_key);
CREATE INDEX IF NOT EXISTS job_runs_recent_idx ON public.job_runs (job, started_at DESC);

GRANT SELECT ON public.job_runs TO authenticated;
GRANT ALL ON public.job_runs TO service_role;

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read job runs"
  ON public.job_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_job_runs_updated_at
  BEFORE UPDATE ON public.job_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();