-- ============ CATEGORIES ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  icon text NOT NULL DEFAULT 'circle',
  color text NOT NULL DEFAULT '#4B1D3F',
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_type_check CHECK (type IN ('bill','income','expense','transfer')),
  CONSTRAINT categories_owner_check CHECK ((is_system AND user_id IS NULL) OR (NOT is_system AND user_id IS NOT NULL))
);
CREATE INDEX categories_user_idx ON public.categories(user_id, type) WHERE is_active;
CREATE UNIQUE INDEX categories_system_name_idx ON public.categories(name, type) WHERE is_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read system categories" ON public.categories FOR SELECT TO authenticated USING (is_system);
CREATE POLICY "Read own categories" ON public.categories FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Insert own categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND NOT is_system);
CREATE POLICY "Update own categories" ON public.categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id AND NOT is_system);
CREATE POLICY "Delete own categories" ON public.categories FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.categories (name, type, icon, color, is_system) VALUES
  ('Rent','bill','home','#4B1D3F',true),
  ('Electricity','bill','zap','#B4739C',true),
  ('Water','bill','droplet','#6E4A63',true),
  ('Internet','bill','wifi','#8A5C7A',true),
  ('Mobile','bill','smartphone','#A06E90',true),
  ('Insurance','bill','shield','#5C3350',true),
  ('Loan','bill','landmark','#733D63',true),
  ('Subscription','bill','repeat','#9B6A8B',true),
  ('General','bill','receipt','#7A5470',true),
  ('Salary','income','wallet','#2F7D62',true),
  ('Freelance','income','briefcase','#3E8F73',true),
  ('Interest','income','trending-up','#4E9D83',true),
  ('Gift','income','gift','#5FA893',true),
  ('Other income','income','plus-circle','#6DB3A0',true),
  ('Food','expense','utensils','#B4739C',true),
  ('Transport','expense','car','#8A5C7A',true),
  ('Shopping','expense','shopping-bag','#A06E90',true),
  ('Health','expense','heart-pulse','#C08AA8',true),
  ('Entertainment','expense','clapperboard','#6E4A63',true),
  ('Education','expense','graduation-cap','#5C3350',true),
  ('Other expense','expense','circle','#7A5470',true),
  ('Transfer','transfer','arrow-left-right','#4B1D3F',true);

-- ============ BILLS: new columns ============
ALTER TABLE public.bills
  ADD COLUMN description text,
  ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN amount_type text NOT NULL DEFAULT 'fixed',
  ADD COLUMN currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN repeat_type text NOT NULL DEFAULT 'none',
  ADD COLUMN repeat_interval integer NOT NULL DEFAULT 1,
  ADD COLUMN repeat_end_date date,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true,
  ADD COLUMN autopay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN reminder_days_before integer NOT NULL DEFAULT 1;
ALTER TABLE public.bills
  ADD CONSTRAINT bills_amount_type_check CHECK (amount_type IN ('fixed','variable')),
  ADD CONSTRAINT bills_repeat_type_check CHECK (repeat_type IN ('none','weekly','monthly','quarterly','yearly','custom')),
  ADD CONSTRAINT bills_repeat_interval_check CHECK (repeat_interval >= 1 AND repeat_interval <= 366),
  ADD CONSTRAINT bills_amount_check CHECK (amount >= 0 AND amount <= 1000000000),
  ADD CONSTRAINT bills_reminder_check CHECK (reminder_days_before >= 0 AND reminder_days_before <= 30);

UPDATE public.bills SET repeat_type = CASE
    WHEN is_recurring AND recurring_type = 'weekly' THEN 'weekly'
    WHEN is_recurring AND recurring_type = 'yearly' THEN 'yearly'
    WHEN is_recurring THEN 'monthly'
    ELSE 'none' END;

CREATE INDEX bills_user_due_idx ON public.bills(user_id, due_date);
CREATE INDEX bills_user_active_idx ON public.bills(user_id, is_active);

-- ============ BILL OCCURRENCES ============
CREATE TABLE public.bill_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  expected_amount numeric(14,2) NOT NULL,
  actual_amount numeric(14,2),
  status text NOT NULL DEFAULT 'upcoming',
  paid_at timestamptz,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bill_occurrences_status_check CHECK (status IN ('upcoming','due_soon','due_today','overdue','payment_pending','paid','payment_failed','cancelled','skipped')),
  CONSTRAINT bill_occurrences_amount_check CHECK (expected_amount >= 0 AND expected_amount <= 1000000000),
  CONSTRAINT bill_occurrences_unique UNIQUE (bill_id, scheduled_date)
);
CREATE INDEX bill_occurrences_user_date_idx ON public.bill_occurrences(user_id, scheduled_date);
CREATE INDEX bill_occurrences_user_status_idx ON public.bill_occurrences(user_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bill_occurrences TO authenticated;
GRANT ALL ON public.bill_occurrences TO service_role;
ALTER TABLE public.bill_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own occurrences" ON public.bill_occurrences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_bill_occurrences_updated_at BEFORE UPDATE ON public.bill_occurrences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ TRANSACTIONS: new columns ============
ALTER TABLE public.transactions
  ADD COLUMN currency text NOT NULL DEFAULT 'INR',
  ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN status text NOT NULL DEFAULT 'completed',
  ADD COLUMN payment_method text,
  ADD COLUMN bill_occurrence_id uuid REFERENCES public.bill_occurrences(id) ON DELETE SET NULL,
  ADD COLUMN notes text,
  ADD COLUMN external_reference text;
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_type_check,
  DROP CONSTRAINT IF EXISTS transactions_amount_check;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check CHECK (type IN ('income','expense','bill_payment','transfer','refund','adjustment')),
  ADD CONSTRAINT transactions_status_check CHECK (status IN ('pending','completed','failed','cancelled','reversed')),
  ADD CONSTRAINT transactions_amount_check CHECK (amount > 0 AND amount <= 1000000000);
CREATE INDEX transactions_user_date_idx ON public.transactions(user_id, date DESC);
CREATE INDEX transactions_user_type_idx ON public.transactions(user_id, type);
CREATE INDEX transactions_user_category_idx ON public.transactions(user_id, category_id);

ALTER TABLE public.bill_occurrences
  ADD CONSTRAINT bill_occurrences_transaction_fk FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

-- ============ BUDGETS: new columns ============
ALTER TABLE public.budgets
  ADD COLUMN name text,
  ADD COLUMN category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN start_date date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN end_date date,
  ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.budgets
  DROP CONSTRAINT IF EXISTS budgets_period_check,
  DROP CONSTRAINT IF EXISTS budgets_amount_check;
ALTER TABLE public.budgets
  ADD CONSTRAINT budgets_period_check CHECK (period IN ('weekly','monthly','quarterly','yearly','custom')),
  ADD CONSTRAINT budgets_amount_check CHECK (amount > 0 AND amount <= 1000000000);
CREATE INDEX budgets_user_active_idx ON public.budgets(user_id, is_active);

-- ============ NOTIFICATION PREFERENCES ============
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_reminders boolean NOT NULL DEFAULT true,
  overdue_alerts boolean NOT NULL DEFAULT true,
  payment_confirmations boolean NOT NULL DEFAULT true,
  budget_alerts boolean NOT NULL DEFAULT true,
  weekly_summary boolean NOT NULL DEFAULT true,
  security_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own notification prefs" ON public.notification_preferences FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_notification_preferences_updated_at BEFORE UPDATE ON public.notification_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$function$;

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  related_bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE,
  related_transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_type_check CHECK (type IN ('bill_due','bill_overdue','payment_success','payment_failed','budget_warning','budget_exceeded','security','system','insight'))
);
CREATE INDEX notifications_user_created_idx ON public.notifications(user_id, created_at DESC);
CREATE UNIQUE INDEX notifications_dedupe_idx ON public.notifications(user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ ATTACHMENTS ============
CREATE TABLE public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  file_size bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attachments_size_check CHECK (file_size > 0 AND file_size <= 10485760)
);
CREATE INDEX attachments_user_idx ON public.attachments(user_id);
GRANT SELECT, INSERT, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own attachments" ON public.attachments FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ AUDIT LOGS ============
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'user',
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_created_idx ON public.audit_logs(user_id, created_at DESC);
GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ============ SUPPORT TICKETS ============
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'normal',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_tickets_status_check CHECK (status IN ('open','in_progress','resolved','closed')),
  CONSTRAINT support_tickets_priority_check CHECK (priority IN ('low','normal','high','urgent'))
);
CREATE INDEX support_tickets_user_idx ON public.support_tickets(user_id, created_at DESC);
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_support_tickets_updated_at BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ROLES ============
CREATE TYPE public.app_role AS ENUM ('super_admin','support_admin','finance_admin','readonly_admin','user');
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ BACKFILL OCCURRENCES ============
INSERT INTO public.bill_occurrences (bill_id, user_id, scheduled_date, expected_amount, actual_amount, status, paid_at)
SELECT b.id, b.user_id, b.due_date, b.amount,
       p.amount,
       CASE WHEN p.id IS NOT NULL THEN 'paid'
            WHEN b.due_date < CURRENT_DATE THEN 'overdue'
            WHEN b.due_date = CURRENT_DATE THEN 'due_today'
            ELSE 'upcoming' END,
       CASE WHEN p.id IS NOT NULL THEN p.created_at ELSE NULL END
FROM public.bills b
LEFT JOIN LATERAL (
  SELECT id, amount, created_at FROM public.payments
  WHERE bill_id = b.id AND status = 'completed' ORDER BY created_at DESC LIMIT 1
) p ON true
ON CONFLICT (bill_id, scheduled_date) DO NOTHING;