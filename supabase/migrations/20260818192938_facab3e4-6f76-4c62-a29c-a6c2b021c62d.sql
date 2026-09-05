-- ============ payment_orders ============
CREATE TABLE public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_occurrence_id uuid NOT NULL REFERENCES public.bill_occurrences(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_order_id text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN (
    'CREATED','ORDER_CREATED','CHECKOUT_OPENED','USER_PROCESSING','AUTHORIZED',
    'CAPTURED','FAILED','CANCELLED','EXPIRED','REFUNDED','UNKNOWN'
  )),
  idempotency_key text NOT NULL,
  refunded_amount numeric NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0),
  failure_code text,
  failure_message text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  expires_at timestamptz,
  captured_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_orders_idempotency_key_uidx
  ON public.payment_orders (user_id, idempotency_key);
CREATE UNIQUE INDEX payment_orders_provider_order_uidx
  ON public.payment_orders (provider, provider_order_id)
  WHERE provider_order_id IS NOT NULL;
-- At most one live payment per instalment.
CREATE UNIQUE INDEX payment_orders_active_per_occurrence_uidx
  ON public.payment_orders (bill_occurrence_id)
  WHERE status IN ('CREATED','ORDER_CREATED','CHECKOUT_OPENED','USER_PROCESSING','AUTHORIZED','UNKNOWN');
CREATE INDEX payment_orders_user_idx ON public.payment_orders (user_id, created_at DESC);

GRANT SELECT ON public.payment_orders TO authenticated;
GRANT ALL ON public.payment_orders TO service_role;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payment orders" ON public.payment_orders
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_payment_orders_updated_at BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ payment_attempts ============
CREATE TABLE public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id uuid NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_payment_id text,
  status text NOT NULL DEFAULT 'CREATED' CHECK (status IN (
    'CREATED','ORDER_CREATED','CHECKOUT_OPENED','USER_PROCESSING','AUTHORIZED',
    'CAPTURED','FAILED','CANCELLED','EXPIRED','REFUNDED','UNKNOWN'
  )),
  method text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'INR',
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_attempts_provider_payment_uidx
  ON public.payment_attempts (provider, provider_payment_id)
  WHERE provider_payment_id IS NOT NULL;
CREATE INDEX payment_attempts_order_idx ON public.payment_attempts (payment_order_id);

GRANT SELECT ON public.payment_attempts TO authenticated;
GRANT ALL ON public.payment_attempts TO service_role;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own payment attempts" ON public.payment_attempts
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER update_payment_attempts_updated_at BEFORE UPDATE ON public.payment_attempts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ payment_events ============
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  payment_order_id uuid REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  provider_payment_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  process_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX payment_events_provider_event_uidx
  ON public.payment_events (provider, provider_event_id);
CREATE INDEX payment_events_order_idx ON public.payment_events (payment_order_id);

GRANT ALL ON public.payment_events TO service_role;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
-- No policies: raw provider events are server-only.

-- ============ settlement integrity ============
-- One bill-payment transaction per instalment, ever.
CREATE UNIQUE INDEX transactions_one_bill_payment_per_occurrence_uidx
  ON public.transactions (bill_occurrence_id)
  WHERE bill_occurrence_id IS NOT NULL AND type = 'bill_payment';

-- Settlement state can no longer be written from the browser.
REVOKE INSERT, UPDATE, DELETE ON public.bill_occurrences FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.transactions FROM authenticated;
GRANT ALL ON public.bill_occurrences TO service_role;
GRANT ALL ON public.transactions TO service_role;