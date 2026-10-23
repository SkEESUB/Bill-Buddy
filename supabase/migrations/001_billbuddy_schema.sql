-- ============================================================================
-- BillBuddy Consolidated Database Schema Migration
-- File: supabase/migrations/001_billbuddy_schema.sql
-- Target Project: xsytaixmyeypoiscfbim
-- Description: Complete schema for BillBuddy personal finance application.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. ENUMS & TYPES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM (
      'super_admin',
      'support_admin',
      'finance_admin',
      'readonly_admin',
      'user'
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS (Part 1: Functions without table dependencies)
-- ----------------------------------------------------------------------------

-- Function: update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. CORE APPLICATION TABLES
-- ----------------------------------------------------------------------------

-- PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  mobile text,
  default_upi_id text,
  account_status text NOT NULL DEFAULT 'ACTIVE',
  status_reason text,
  status_changed_at timestamptz,
  onboarding_completed boolean DEFAULT false,
  onboarding_step integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- USER SETTINGS
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'INR',
  monthly_income numeric NOT NULL DEFAULT 0,
  monthly_budget numeric NOT NULL DEFAULT 0,
  starting_balance numeric NOT NULL DEFAULT 0,
  theme text NOT NULL DEFAULT 'light',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  reduced_motion boolean NOT NULL DEFAULT false,
  default_budget_period text NOT NULL DEFAULT 'monthly',
  default_warn_threshold numeric NOT NULL DEFAULT 80,
  default_near_limit_threshold numeric NOT NULL DEFAULT 90,
  notify_bill_reminders boolean NOT NULL DEFAULT true,
  notify_due_tomorrow boolean NOT NULL DEFAULT true,
  notify_due_today boolean NOT NULL DEFAULT true,
  notify_overdue boolean NOT NULL DEFAULT true,
  notify_payment_recorded boolean NOT NULL DEFAULT true,
  notify_weekly_summary boolean NOT NULL DEFAULT false,
  notify_monthly_summary boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- NOTIFICATION PREFERENCES
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_reminders boolean NOT NULL DEFAULT true,
  overdue_alerts boolean NOT NULL DEFAULT true,
  payment_confirmations boolean NOT NULL DEFAULT true,
  budget_alerts boolean NOT NULL DEFAULT true,
  weekly_summary boolean NOT NULL DEFAULT false,
  security_alerts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- USER ROLES
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense' CHECK (type IN ('income','expense','both')),
  color text NOT NULL DEFAULT '#3157F6',
  icon text NOT NULL DEFAULT 'tag',
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- BILLS
CREATE TABLE IF NOT EXISTS public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'general',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  due_date date NOT NULL,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_type text,
  repeat_type text NOT NULL DEFAULT 'none' CHECK (repeat_type IN ('none','weekly','monthly','quarterly','yearly','custom')),
  repeat_interval integer NOT NULL DEFAULT 1,
  repeat_end_date date,
  reminder_days_before integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  amount_type text NOT NULL DEFAULT 'fixed' CHECK (amount_type IN ('fixed','variable')),
  currency text NOT NULL DEFAULT 'INR',
  autopay_enabled boolean NOT NULL DEFAULT false,
  upi_id text,
  notes text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- BILL OCCURRENCES
CREATE TABLE IF NOT EXISTS public.bill_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  expected_amount numeric(12,2) NOT NULL,
  actual_amount numeric(12,2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','due_today','overdue','payment_pending','paid','skipped','cancelled')),
  paid_at timestamptz,
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bill_id, scheduled_date)
);

-- BILL REMINDERS
CREATE TABLE IF NOT EXISTS public.bill_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_occurrence_id uuid NOT NULL REFERENCES public.bill_occurrences(id) ON DELETE CASCADE,
  reminder_type text NOT NULL DEFAULT 'in_app' CHECK (reminder_type IN ('email','push','in_app')),
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PAYMENTS
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  payment_date date NOT NULL DEFAULT current_date,
  payment_method text NOT NULL DEFAULT 'upi',
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- TRANSACTIONS
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense','transfer','refund','adjustment','bill_payment')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  category text NOT NULL DEFAULT 'general',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  description text,
  date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'settled' CHECK (status IN ('settled','pending','cancelled','reversed')),
  payment_method text DEFAULT 'upi',
  notes text,
  bill_occurrence_id uuid REFERENCES public.bill_occurrences(id) ON DELETE SET NULL,
  currency text NOT NULL DEFAULT 'INR',
  source text NOT NULL DEFAULT 'manual',
  client_request_id text,
  external_reference text,
  reversal_of uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  reversed_by uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- BUDGETS
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  category text NOT NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  period text NOT NULL DEFAULT 'monthly' CHECK (period IN ('monthly','weekly')),
  start_date date NOT NULL DEFAULT current_date,
  end_date date,
  warn_threshold numeric NOT NULL DEFAULT 80 CHECK (warn_threshold > 0 AND warn_threshold <= 100),
  near_limit_threshold numeric NOT NULL DEFAULT 90 CHECK (near_limit_threshold > 0 AND near_limit_threshold <= 100),
  is_active boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category, period)
);

-- SPENDING GOALS
CREATE TABLE IF NOT EXISTS public.spending_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description text,
  category text,
  target_amount numeric(12,2) NOT NULL CHECK (target_amount > 0),
  current_amount numeric(12,2) NOT NULL DEFAULT 0,
  target_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  related_bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  related_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  related_budget_id uuid REFERENCES public.budgets(id) ON DELETE SET NULL,
  dedupe_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ATTACHMENTS
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size integer NOT NULL,
  mime_type text NOT NULL,
  storage_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AUDIT LOGS
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_type text NOT NULL DEFAULT 'user',
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_role text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  result text NOT NULL DEFAULT 'success',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  correlation_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SUPPORT TICKETS
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting_on_user','resolved','closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- SUPPORT TICKET MESSAGES
CREATE TABLE IF NOT EXISTS public.support_ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  author_type text NOT NULL DEFAULT 'user' CHECK (author_type IN ('user','admin','system')),
  body text NOT NULL,
  is_internal boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- PAYMENT ORDERS
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bill_occurrence_id uuid NOT NULL REFERENCES public.bill_occurrences(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','attempted','captured','failed','cancelled','refunded')),
  provider text NOT NULL DEFAULT 'razorpay',
  provider_order_id text,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  idempotency_key text NOT NULL UNIQUE,
  refunded_amount numeric(12,2) NOT NULL DEFAULT 0,
  expires_at timestamptz,
  captured_at timestamptz,
  failure_code text,
  failure_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- PAYMENT ATTEMPTS
CREATE TABLE IF NOT EXISTS public.payment_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id uuid NOT NULL REFERENCES public.payment_orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  provider text NOT NULL DEFAULT 'razorpay',
  provider_payment_id text,
  status text NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated','authorized','captured','failed')),
  method text,
  failure_code text,
  failure_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- PAYMENT EVENTS (Webhook Log)
CREATE TABLE IF NOT EXISTS public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'razorpay',
  provider_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  payment_order_id uuid REFERENCES public.payment_orders(id) ON DELETE SET NULL,
  provider_payment_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  process_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- CLOSED ACCOUNTS (Retention Log)
CREATE TABLE IF NOT EXISTS public.closed_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closed_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  retained_summary jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- JOB RUNS (Scheduler Automation Log)
CREATE TABLE IF NOT EXISTS public.job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job text NOT NULL,
  run_key text NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','success','partial','failed')),
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

-- ----------------------------------------------------------------------------
-- 4. APPLICATION & FINANCIAL RPC FUNCTIONS
-- ----------------------------------------------------------------------------

-- Function: check user role (Security Definer)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Function: calculate ledger delta for current user
CREATE OR REPLACE FUNCTION public.ledger_balance_delta()
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    SUM(
      CASE
        WHEN type = 'income' THEN amount
        WHEN type IN ('expense', 'bill_payment') THEN -amount
        ELSE 0
      END
    ),
    0
  )
  FROM public.transactions
  WHERE user_id = auth.uid()
    AND status = 'settled';
$$;

-- ----------------------------------------------------------------------------
-- 5. AUTOMATED USER PROVISIONING TRIGGER
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _name text;
BEGIN
  _name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.profiles (id, full_name, account_status)
  VALUES (NEW.id, _name, 'ACTIVE')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Safe Backfill for any pre-existing auth users
INSERT INTO public.profiles (id, full_name, account_status)
SELECT
  id,
  COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
  'ACTIVE'
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.user_settings (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. UPDATED_AT TRIGGERS
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'profiles', 'user_settings', 'notification_preferences', 'categories',
    'bills', 'bill_occurrences', 'payments', 'transactions', 'budgets',
    'spending_goals', 'support_tickets', 'payment_orders', 'payment_attempts', 'job_runs'
  ]) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tr_%I_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER tr_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();', t, t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 7. DEFAULT SYSTEM CATEGORIES SEEDING
-- ----------------------------------------------------------------------------

INSERT INTO public.categories (name, type, color, icon, is_system, is_active, user_id)
VALUES
  ('Housing', 'expense', '#4F46E5', 'home', true, true, null),
  ('Utilities', 'expense', '#06B6D4', 'zap', true, true, null),
  ('Food & Dining', 'expense', '#F59E0B', 'coffee', true, true, null),
  ('Transportation', 'expense', '#10B981', 'car', true, true, null),
  ('Health', 'expense', '#EF4444', 'heart', true, true, null),
  ('Entertainment', 'expense', '#8B5CF6', 'film', true, true, null),
  ('Shopping', 'expense', '#EC4899', 'shopping-bag', true, true, null),
  ('Personal', 'expense', '#6366F1', 'user', true, true, null),
  ('Education', 'expense', '#14B8A6', 'book', true, true, null),
  ('Debt', 'expense', '#F97316', 'credit-card', true, true, null),
  ('Savings', 'expense', '#22C55E', 'piggy-bank', true, true, null),
  ('Salary', 'income', '#10B981', 'briefcase', true, true, null),
  ('Investment', 'income', '#3B82F6', 'trending-up', true, true, null),
  ('Other', 'both', '#6B7280', 'tag', true, true, null)
ON CONFLICT DO NOTHING;

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKETS (avatars & receipts)
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES
  ('avatars', 'avatars', false),
  ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "Users access own avatars" ON storage.objects;
  CREATE POLICY "Users access own avatars" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

  DROP POLICY IF EXISTS "Users access own receipts" ON storage.objects;
  CREATE POLICY "Users access own receipts" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text)
    WITH CHECK (bucket_id = 'receipts' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION
  WHEN undefined_table THEN
    NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) & POLICIES
-- ----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spending_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closed_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User Settings Policies
DROP POLICY IF EXISTS "Users view own settings" ON public.user_settings;
CREATE POLICY "Users view own settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own settings" ON public.user_settings;
CREATE POLICY "Users update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own settings" ON public.user_settings;
CREATE POLICY "Users insert own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Notification Preferences Policies
DROP POLICY IF EXISTS "Users view own notif prefs" ON public.notification_preferences;
CREATE POLICY "Users view own notif prefs" ON public.notification_preferences FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notif prefs" ON public.notification_preferences;
CREATE POLICY "Users update own notif prefs" ON public.notification_preferences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own notif prefs" ON public.notification_preferences;
CREATE POLICY "Users insert own notif prefs" ON public.notification_preferences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- User Roles Policies
DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Categories Policies
DROP POLICY IF EXISTS "Users view system and own categories" ON public.categories;
CREATE POLICY "Users view system and own categories" ON public.categories FOR SELECT TO authenticated USING (is_system = true OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own categories" ON public.categories;
CREATE POLICY "Users insert own categories" ON public.categories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own categories" ON public.categories;
CREATE POLICY "Users update own categories" ON public.categories FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own categories" ON public.categories;
CREATE POLICY "Users delete own categories" ON public.categories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Bills Policies
DROP POLICY IF EXISTS "Users manage own bills" ON public.bills;
CREATE POLICY "Users manage own bills" ON public.bills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bill Occurrences Policies
DROP POLICY IF EXISTS "Users manage own bill occurrences" ON public.bill_occurrences;
CREATE POLICY "Users manage own bill occurrences" ON public.bill_occurrences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Bill Reminders Policies
DROP POLICY IF EXISTS "Users manage own bill reminders" ON public.bill_reminders;
CREATE POLICY "Users manage own bill reminders" ON public.bill_reminders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Payments Policies
DROP POLICY IF EXISTS "Users manage own payments" ON public.payments;
CREATE POLICY "Users manage own payments" ON public.payments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions Policies
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
CREATE POLICY "Users manage own transactions" ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Budgets Policies
DROP POLICY IF EXISTS "Users manage own budgets" ON public.budgets;
CREATE POLICY "Users manage own budgets" ON public.budgets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Spending Goals Policies
DROP POLICY IF EXISTS "Users manage own goals" ON public.spending_goals;
CREATE POLICY "Users manage own goals" ON public.spending_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Notifications Policies
DROP POLICY IF EXISTS "Users manage own notifications" ON public.notifications;
CREATE POLICY "Users manage own notifications" ON public.notifications FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Attachments Policies
DROP POLICY IF EXISTS "Users manage own attachments" ON public.attachments;
CREATE POLICY "Users manage own attachments" ON public.attachments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Audit Logs Policies
DROP POLICY IF EXISTS "Users view own audit logs" ON public.audit_logs;
CREATE POLICY "Users view own audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own audit logs" ON public.audit_logs;
CREATE POLICY "Users insert own audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Support Tickets Policies
DROP POLICY IF EXISTS "Users view own support tickets" ON public.support_tickets;
CREATE POLICY "Users view own support tickets" ON public.support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own support tickets" ON public.support_tickets;
CREATE POLICY "Users insert own support tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own support tickets" ON public.support_tickets;
CREATE POLICY "Users update own support tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Support Ticket Messages Policies
DROP POLICY IF EXISTS "Users view messages of own tickets" ON public.support_ticket_messages;
CREATE POLICY "Users view messages of own tickets" ON public.support_ticket_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid()));

DROP POLICY IF EXISTS "Users send messages to own tickets" ON public.support_ticket_messages;
CREATE POLICY "Users send messages to own tickets" ON public.support_ticket_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_user_id AND EXISTS (SELECT 1 FROM public.support_tickets WHERE id = ticket_id AND user_id = auth.uid()));

-- Payment Orders Policies
DROP POLICY IF EXISTS "Users manage own payment orders" ON public.payment_orders;
CREATE POLICY "Users manage own payment orders" ON public.payment_orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Payment Attempts Policies
DROP POLICY IF EXISTS "Users manage own payment attempts" ON public.payment_attempts;
CREATE POLICY "Users manage own payment attempts" ON public.payment_attempts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 10. GRANTS
-- ----------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO authenticated, anon, service_role;

GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 11. INDEXES FOR PERFORMANCE
-- ----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_bills_user_due ON public.bills(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_bill_occurrences_bill ON public.bill_occurrences(bill_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_bill_occurrences_user_status ON public.bill_occurrences(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bill_reminders_user_scheduled ON public.bill_reminders(user_id, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.budgets(user_id, period);
CREATE INDEX IF NOT EXISTS idx_spending_goals_user ON public.spending_goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_user ON public.payment_orders(user_id, created_at DESC);
