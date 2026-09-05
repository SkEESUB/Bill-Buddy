-- 1. Ledger columns
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS client_request_id text,
  ADD COLUMN IF NOT EXISTS reversal_of uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversed_by uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

-- 2. Duplicate protection + single reversal per record
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_request_key
  ON public.transactions(user_id, client_request_id)
  WHERE client_request_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_reversal_of_key
  ON public.transactions(reversal_of)
  WHERE reversal_of IS NOT NULL;

-- 3. Query indexes
CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON public.transactions(user_id, date DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS transactions_user_type_idx ON public.transactions(user_id, type);
CREATE INDEX IF NOT EXISTS transactions_user_status_idx ON public.transactions(user_id, status);
CREATE INDEX IF NOT EXISTS transactions_user_category_idx ON public.transactions(user_id, category);
CREATE INDEX IF NOT EXISTS attachments_user_idx ON public.attachments(user_id);
CREATE INDEX IF NOT EXISTS attachments_transaction_idx ON public.attachments(transaction_id);

-- 4. Domain constraints
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('income','expense','bill_payment','transfer','refund','adjustment'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending','completed','failed','cancelled','reversed'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_source_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_source_check
  CHECK (source IN ('manual','bill_engine','provider','system'));

-- 5. Least privilege
REVOKE ALL ON public.transactions FROM anon;
REVOKE ALL ON public.bill_occurrences FROM anon;
REVOKE ALL ON public.attachments FROM anon;
REVOKE ALL ON public.payment_orders FROM anon;
REVOKE ALL ON public.payment_attempts FROM anon;
REVOKE ALL ON public.bills FROM anon;
REVOKE ALL ON public.budgets FROM anon;

REVOKE INSERT, UPDATE, DELETE ON public.attachments FROM authenticated;
GRANT SELECT ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
GRANT SELECT ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;