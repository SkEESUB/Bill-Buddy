ALTER TABLE public.budgets
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS warn_threshold numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS near_limit_threshold numeric NOT NULL DEFAULT 80;

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_status_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_status_check
  CHECK (status IN ('active','paused','archived'));

ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_thresholds_check;
ALTER TABLE public.budgets ADD CONSTRAINT budgets_thresholds_check
  CHECK (warn_threshold > 0 AND warn_threshold < near_limit_threshold AND near_limit_threshold <= 100);

-- Multiple budgets per category are allowed over time (history/archive);
-- only one may be active for a given category + period.
ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS budgets_user_id_category_period_key;
CREATE UNIQUE INDEX IF NOT EXISTS budgets_active_unique_idx
  ON public.budgets (user_id, category, period) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS budgets_user_status_idx ON public.budgets (user_id, status);
CREATE INDEX IF NOT EXISTS transactions_user_date_idx ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS transactions_user_category_date_idx ON public.transactions (user_id, category, date);
CREATE INDEX IF NOT EXISTS bill_occurrences_user_date_idx ON public.bill_occurrences (user_id, scheduled_date);