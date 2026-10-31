-- ============================================================================
-- BillBuddy Staging Consolidated Migration Suite
-- Target Project: eiwybyhvnhagugjjbkkl (STAGING ONLY)
-- Date: 2026-10-31
-- ============================================================================



-- ============================================================================
-- BEGIN FILE: supabase/migrations/001_billbuddy_schema.sql
-- ============================================================================

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
  reminder_time time NOT NULL DEFAULT '09:00:00',
  reminder_email text,
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



-- ============================================================================
-- BEGIN FILE: supabase/migrations/20261026000000_create_spends_table.sql
-- ============================================================================

-- Migration: Create public.spends table for daily spending feature
-- Author: BillBuddy Engineering Team
-- Date: 2026-10-26

CREATE TABLE IF NOT EXISTS public.spends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  spend_date date NOT NULL DEFAULT current_date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable Row Level Security (Strictly mandated)
ALTER TABLE public.spends ENABLE ROW LEVEL SECURITY;

-- Owner-only RLS Policy
DROP POLICY IF EXISTS "Users can only manage their own spends" ON public.spends;
CREATE POLICY "Users can only manage their own spends"
  ON public.spends
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance indexes for date queries
CREATE INDEX IF NOT EXISTS idx_spends_user_date ON public.spends (user_id, spend_date DESC);
CREATE INDEX IF NOT EXISTS idx_spends_created ON public.spends (user_id, created_at DESC);



-- ============================================================================
-- BEGIN FILE: supabase/migrations/20261030000000_add_spend_source_and_dedupe.sql
-- ============================================================================

-- Migration: Add transaction source and deduplication hash to public.spends
-- Author: BillBuddy Engineering Team
-- Date: 2026-10-30
-- Description: Phase 1 database enhancements for spend source tracking and duplicate prevention.

-- 1. Add source column with check constraint and default 'other'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'spends' 
      AND column_name = 'source'
  ) THEN
    ALTER TABLE public.spends 
      ADD COLUMN source text NOT NULL DEFAULT 'other';
  END IF;
END $$;

-- Add or update source check constraint
ALTER TABLE public.spends 
  DROP CONSTRAINT IF EXISTS spends_source_check;

ALTER TABLE public.spends 
  ADD CONSTRAINT spends_source_check 
  CHECK (source IN ('cash', 'bank', 'statement', 'email', 'notification', 'card', 'upi', 'other'));

-- 2. Add dedupe_hash column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'spends' 
      AND column_name = 'dedupe_hash'
  ) THEN
    ALTER TABLE public.spends 
      ADD COLUMN dedupe_hash text;
  END IF;
END $$;

-- 3. Add performance and deduplication indexes
CREATE INDEX IF NOT EXISTS idx_spends_user_source 
  ON public.spends (user_id, source);

CREATE INDEX IF NOT EXISTS idx_spends_user_dedupe 
  ON public.spends (user_id, dedupe_hash) 
  WHERE dedupe_hash IS NOT NULL;



-- ============================================================================
-- BEGIN FILE: supabase/migrations/20261030010000_add_linked_devices_and_notifications.sql
-- ============================================================================

-- Migration: Add Linked Devices, Pairing Tokens, and Notification Ingestion Audit Logs
-- Author: BillBuddy Engineering Team
-- Date: 2026-10-30
-- Description: Phase 3 non-destructive database additions for secure Android payment notification detection.

-- 1. Create linked_devices table
CREATE TABLE IF NOT EXISTS public.linked_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  device_fingerprint text NOT NULL,
  hmac_key text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
  last_sync_at timestamptz,
  last_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT linked_devices_user_fingerprint_uniq UNIQUE (user_id, device_fingerprint)
);

-- Indexes for linked_devices
CREATE INDEX IF NOT EXISTS idx_linked_devices_user 
  ON public.linked_devices (user_id);

CREATE INDEX IF NOT EXISTS idx_linked_devices_status 
  ON public.linked_devices (status);

-- 2. Create device_pairing_tokens table for ephemeral QR handshakes
CREATE TABLE IF NOT EXISTS public.device_pairing_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast token validation
CREATE INDEX IF NOT EXISTS idx_device_pairing_tokens_lookup 
  ON public.device_pairing_tokens (token, expires_at) 
  WHERE used_at IS NULL;

-- 3. Create notification_ingest_logs table (Minimal metadata only, zero raw text/accounts)
CREATE TABLE IF NOT EXISTS public.notification_ingest_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid NOT NULL REFERENCES public.linked_devices(id) ON DELETE CASCADE,
  nonce text NOT NULL UNIQUE,
  request_timestamp bigint NOT NULL,
  package_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('imported', 'duplicate', 'ignored_credit', 'needs_review', 'rejected')),
  spend_id uuid REFERENCES public.spends(id) ON DELETE SET NULL,
  error_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Replay defense index
CREATE INDEX IF NOT EXISTS idx_notification_ingest_logs_nonce 
  ON public.notification_ingest_logs (nonce);

-- User audit history index
CREATE INDEX IF NOT EXISTS idx_notification_ingest_logs_user_recent 
  ON public.notification_ingest_logs (user_id, created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.linked_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_pairing_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_ingest_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies: Linked Devices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'linked_devices' 
      AND policyname = 'Users can view their own linked devices'
  ) THEN
    CREATE POLICY "Users can view their own linked devices"
      ON public.linked_devices FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'linked_devices' 
      AND policyname = 'Users can update their own linked devices'
  ) THEN
    CREATE POLICY "Users can update their own linked devices"
      ON public.linked_devices FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'linked_devices' 
      AND policyname = 'Users can delete their own linked devices'
  ) THEN
    CREATE POLICY "Users can delete their own linked devices"
      ON public.linked_devices FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 6. RLS Policies: Pairing Tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'device_pairing_tokens' 
      AND policyname = 'Users can manage their own pairing tokens'
  ) THEN
    CREATE POLICY "Users can manage their own pairing tokens"
      ON public.device_pairing_tokens FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 7. RLS Policies: Notification Logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
      AND tablename = 'notification_ingest_logs' 
      AND policyname = 'Users can view their own notification ingest logs'
  ) THEN
    CREATE POLICY "Users can view their own notification ingest logs"
      ON public.notification_ingest_logs FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;



-- ============================================================================
-- BEGIN FILE: supabase/migrations/20261030020000_security_remediation_phase3.sql
-- ============================================================================

-- Migration: Phase 3.2 Security Remediation
-- Author: BillBuddy Engineering Team
-- Date: 2026-10-30
-- Description: 
-- 1. Restrict authenticated PostgREST column access to linked_devices.hmac_key
-- 2. Atomic pairing token consumption function (consume_pairing_token)
-- 3. Atomic notification replay prevention and spend ingestion RPC (ingest_notification_spend)

-- 1. Column-Level Security on linked_devices
-- Revoke all table-level access from untrusted roles and grant only non-sensitive columns
REVOKE ALL ON public.linked_devices FROM PUBLIC, authenticated, anon;

GRANT SELECT (
  id, 
  user_id, 
  device_name, 
  device_fingerprint, 
  status, 
  last_sync_at, 
  last_ip, 
  created_at, 
  revoked_at
) ON public.linked_devices TO authenticated;

GRANT UPDATE (device_name, status) ON public.linked_devices TO authenticated;
GRANT DELETE ON public.linked_devices TO authenticated;
GRANT ALL ON public.linked_devices TO service_role;

-- Additional safe view for client queries with security_invoker and auth.uid() isolation
DROP VIEW IF EXISTS public.user_linked_devices CASCADE;

CREATE VIEW public.user_linked_devices 
WITH (security_invoker = true) AS
  SELECT 
    id, 
    user_id, 
    device_name, 
    device_fingerprint, 
    status, 
    last_sync_at, 
    last_ip, 
    created_at, 
    revoked_at
  FROM public.linked_devices
  WHERE auth.uid() = user_id;

REVOKE ALL ON public.user_linked_devices FROM PUBLIC, anon;
GRANT SELECT ON public.user_linked_devices TO authenticated;
GRANT ALL ON public.user_linked_devices TO service_role;

-- 2. Atomic pairing token consumption RPC
CREATE OR REPLACE FUNCTION public.consume_pairing_token(p_token text)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Strict caller verification: only service_role backend can consume tokens
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: consume_pairing_token requires service_role privilege';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Atomically update used_at only if currently unused and unexpired
  UPDATE public.device_pairing_tokens
  SET used_at = clock_timestamp()
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > clock_timestamp()
  RETURNING user_id INTO v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.consume_pairing_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_pairing_token(text) TO service_role;

-- 3. Atomic Notification Ingestion and Replay Prevention RPC
CREATE OR REPLACE FUNCTION public.ingest_notification_spend(
  p_user_id uuid,
  p_device_id uuid,
  p_nonce text,
  p_request_timestamp bigint,
  p_package_name text,
  p_amount numeric,
  p_spend_date date,
  p_name text,
  p_dedupe_hash text,
  p_notes text DEFAULT NULL,
  p_client_ip text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_spend_id uuid;
  v_duplicate_id uuid;
  v_log_id uuid;
  v_existing_log record;
BEGIN
  -- Strict caller authorization: Must be service_role, OR authenticated user acting on their own user_id
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot ingest transactions for other users';
    END IF;
  END IF;

  -- Verify device ownership matches p_user_id
  IF NOT EXISTS (
    SELECT 1 FROM public.linked_devices 
    WHERE id = p_device_id AND user_id = p_user_id AND status <> 'revoked'
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Device does not exist, is revoked, or does not belong to user';
  END IF;

  -- Check for existing nonce to handle idempotent retries and transient failures
  SELECT id, status, spend_id, user_id, device_id INTO v_existing_log
  FROM public.notification_ingest_logs
  WHERE nonce = p_nonce
  LIMIT 1;

  IF v_existing_log.id IS NOT NULL THEN
    -- Prevent cross-user or cross-device nonce hijacking
    IF v_existing_log.user_id <> p_user_id OR v_existing_log.device_id <> p_device_id THEN
      RETURN jsonb_build_object(
        'status', 'replay_detected',
        'message', 'REPLAY_DETECTED: Nonce claimed by another device or user.'
      );
    END IF;

    -- If already successfully imported, return existing spend_id idempotently (NO second spend!)
    IF v_existing_log.status = 'imported' AND v_existing_log.spend_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'imported',
        'message', 'Expense already recorded (idempotent replay)',
        'spend_id', v_existing_log.spend_id
      );
    ELSIF v_existing_log.status = 'duplicate' THEN
      RETURN jsonb_build_object(
        'status', 'duplicate',
        'message', 'Transaction already recorded as an expense',
        'spend_id', v_existing_log.spend_id
      );
    ELSIF v_existing_log.status = 'ignored_credit' THEN
      RETURN jsonb_build_object(
        'status', 'ignored_credit',
        'message', 'Incoming credit ignored for Spends'
      );
    ELSIF v_existing_log.status IN ('processing', 'rejected') THEN
      -- Legitimate retry after transient failure: reuse existing log and re-attempt spend creation
      v_log_id := v_existing_log.id;
      UPDATE public.notification_ingest_logs
      SET status = 'processing', error_reason = NULL, request_timestamp = p_request_timestamp
      WHERE id = v_log_id;
    ELSE
      RETURN jsonb_build_object(
        'status', 'replay_detected',
        'message', 'REPLAY_DETECTED: Nonce has already been processed.'
      );
    END IF;
  ELSE
    -- Atomically claim nonce
    BEGIN
      INSERT INTO public.notification_ingest_logs (
        user_id,
        device_id,
        nonce,
        request_timestamp,
        package_name,
        status,
        created_at
      ) VALUES (
        p_user_id,
        p_device_id,
        p_nonce,
        p_request_timestamp,
        p_package_name,
        'processing',
        clock_timestamp()
      ) RETURNING id INTO v_log_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'status', 'replay_detected',
        'message', 'REPLAY_DETECTED: Concurrent nonce claim detected.'
      );
    END;
  END IF;

  -- 2. Deduplication check against existing spends
  SELECT id INTO v_duplicate_id
  FROM public.spends
  WHERE user_id = p_user_id
    AND (
      dedupe_hash = p_dedupe_hash
      OR (spend_date = p_spend_date AND amount = p_amount AND name = p_name)
    )
  LIMIT 1;

  IF v_duplicate_id IS NOT NULL THEN
    UPDATE public.notification_ingest_logs
    SET status = 'duplicate', spend_id = v_duplicate_id
    WHERE id = v_log_id;

    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message', 'Transaction already recorded as an expense',
      'spend_id', v_duplicate_id
    );
  END IF;

  -- 3. Deduplication check against ledger bill payments
  SELECT id INTO v_duplicate_id
  FROM public.transactions
  WHERE user_id = p_user_id
    AND date = p_spend_date
    AND amount = p_amount
    AND type = 'bill_payment'
  LIMIT 1;

  IF v_duplicate_id IS NOT NULL THEN
    UPDATE public.notification_ingest_logs
    SET status = 'duplicate', error_reason = 'Matches existing bill payment in ledger'
    WHERE id = v_log_id;

    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message', 'Matches an existing bill payment already recorded in ledger'
    );
  END IF;

  -- 4. Create new spend
  INSERT INTO public.spends (
    user_id,
    name,
    amount,
    spend_date,
    source,
    dedupe_hash,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_name,
    p_amount,
    p_spend_date,
    'notification',
    p_dedupe_hash,
    p_notes,
    clock_timestamp(),
    clock_timestamp()
  ) RETURNING id INTO v_spend_id;

  -- 5. Mark log as imported and update device sync timestamp
  UPDATE public.notification_ingest_logs
  SET status = 'imported', spend_id = v_spend_id
  WHERE id = v_log_id;

  UPDATE public.linked_devices
  SET last_sync_at = clock_timestamp(), last_ip = COALESCE(p_client_ip, last_ip)
  WHERE id = p_device_id;

  RETURN jsonb_build_object(
    'status', 'imported',
    'message', 'Expense successfully imported from notification',
    'spend_id', v_spend_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

REVOKE ALL ON FUNCTION public.ingest_notification_spend(
  uuid, uuid, text, bigint, text, numeric, date, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ingest_notification_spend(
  uuid, uuid, text, bigint, text, numeric, date, text, text, text, text
) TO service_role;



-- ============================================================================
-- BEGIN FILE: supabase/migrations/20261030030000_security_hardening_phase3.sql
-- ============================================================================

-- Migration: Phase 3.2.2 Security Hardening & Fixes
-- Author: BillBuddy Engineering Team
-- Date: 2026-10-30
-- Description:
-- 1. Secure view public.user_linked_devices with security_invoker = true and auth.uid() = user_id filter
-- 2. Restrict consume_pairing_token and ingest_notification_spend with safe search_path,
--    caller authorization checks, and execution restricted strictly to service_role.
-- 3. Idempotent retry recovery in ingest_notification_spend preventing data loss on network drops.

-- 1. Fix public.user_linked_devices view
DROP VIEW IF EXISTS public.user_linked_devices CASCADE;

CREATE VIEW public.user_linked_devices
WITH (security_invoker = true) AS
  SELECT 
    id, 
    user_id, 
    device_name, 
    device_fingerprint, 
    status, 
    last_sync_at, 
    last_ip, 
    created_at, 
    revoked_at
  FROM public.linked_devices
  WHERE auth.uid() = user_id;

-- Ensure anon has zero access to the view; only authenticated users may query their own rows
REVOKE ALL ON public.user_linked_devices FROM PUBLIC, anon;
GRANT SELECT ON public.user_linked_devices TO authenticated;
GRANT ALL ON public.user_linked_devices TO service_role;

-- 2. Fix consume_pairing_token RPC
CREATE OR REPLACE FUNCTION public.consume_pairing_token(p_token text)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Strict caller verification: only service_role backend can consume tokens
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'UNAUTHORIZED: consume_pairing_token requires service_role privilege';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) = 0 THEN
    RETURN NULL;
  END IF;

  -- Atomically update used_at only if currently unused and unexpired
  UPDATE public.device_pairing_tokens
  SET used_at = clock_timestamp()
  WHERE token = p_token
    AND used_at IS NULL
    AND expires_at > clock_timestamp()
  RETURNING user_id INTO v_user_id;

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke execute from public/anon/authenticated and grant strictly to service_role
REVOKE ALL ON FUNCTION public.consume_pairing_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_pairing_token(text) TO service_role;

-- 3. Fix ingest_notification_spend RPC
CREATE OR REPLACE FUNCTION public.ingest_notification_spend(
  p_user_id uuid,
  p_device_id uuid,
  p_nonce text,
  p_request_timestamp bigint,
  p_package_name text,
  p_amount numeric,
  p_spend_date date,
  p_name text,
  p_dedupe_hash text,
  p_notes text DEFAULT NULL,
  p_client_ip text DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_spend_id uuid;
  v_duplicate_id uuid;
  v_log_id uuid;
  v_existing_log record;
BEGIN
  -- Strict caller authorization: Must be service_role, OR authenticated user acting on their own user_id
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cannot ingest transactions for other users';
    END IF;
  END IF;

  -- Verify device ownership matches p_user_id
  IF NOT EXISTS (
    SELECT 1 FROM public.linked_devices 
    WHERE id = p_device_id AND user_id = p_user_id AND status <> 'revoked'
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Device does not exist, is revoked, or does not belong to user';
  END IF;

  -- Check for existing nonce to handle idempotent retries and transient failures
  SELECT id, status, spend_id, user_id, device_id INTO v_existing_log
  FROM public.notification_ingest_logs
  WHERE nonce = p_nonce
  LIMIT 1;

  IF v_existing_log.id IS NOT NULL THEN
    -- Prevent cross-user or cross-device nonce hijacking
    IF v_existing_log.user_id <> p_user_id OR v_existing_log.device_id <> p_device_id THEN
      RETURN jsonb_build_object(
        'status', 'replay_detected',
        'message', 'REPLAY_DETECTED: Nonce claimed by another device or user.'
      );
    END IF;

    -- If already successfully imported, return existing spend_id idempotently (NO second spend!)
    IF v_existing_log.status = 'imported' AND v_existing_log.spend_id IS NOT NULL THEN
      RETURN jsonb_build_object(
        'status', 'imported',
        'message', 'Expense already recorded (idempotent replay)',
        'spend_id', v_existing_log.spend_id
      );
    ELSIF v_existing_log.status = 'duplicate' THEN
      RETURN jsonb_build_object(
        'status', 'duplicate',
        'message', 'Transaction already recorded as an expense',
        'spend_id', v_existing_log.spend_id
      );
    ELSIF v_existing_log.status = 'ignored_credit' THEN
      RETURN jsonb_build_object(
        'status', 'ignored_credit',
        'message', 'Incoming credit ignored for Spends'
      );
    ELSIF v_existing_log.status IN ('processing', 'rejected') THEN
      -- Legitimate retry after transient failure: reuse existing log and re-attempt spend creation
      v_log_id := v_existing_log.id;
      UPDATE public.notification_ingest_logs
      SET status = 'processing', error_reason = NULL, request_timestamp = p_request_timestamp
      WHERE id = v_log_id;
    ELSE
      RETURN jsonb_build_object(
        'status', 'replay_detected',
        'message', 'REPLAY_DETECTED: Nonce has already been processed.'
      );
    END IF;
  ELSE
    -- Atomically claim nonce
    BEGIN
      INSERT INTO public.notification_ingest_logs (
        user_id,
        device_id,
        nonce,
        request_timestamp,
        package_name,
        status,
        created_at
      ) VALUES (
        p_user_id,
        p_device_id,
        p_nonce,
        p_request_timestamp,
        p_package_name,
        'processing',
        clock_timestamp()
      ) RETURNING id INTO v_log_id;
    EXCEPTION WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'status', 'replay_detected',
        'message', 'REPLAY_DETECTED: Concurrent nonce claim detected.'
      );
    END;
  END IF;

  -- Deduplication check against existing spends
  SELECT id INTO v_duplicate_id
  FROM public.spends
  WHERE user_id = p_user_id
    AND (
      dedupe_hash = p_dedupe_hash
      OR (spend_date = p_spend_date AND amount = p_amount AND name = p_name)
    )
  LIMIT 1;

  IF v_duplicate_id IS NOT NULL THEN
    UPDATE public.notification_ingest_logs
    SET status = 'duplicate', spend_id = v_duplicate_id
    WHERE id = v_log_id;

    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message', 'Transaction already recorded as an expense',
      'spend_id', v_duplicate_id
    );
  END IF;

  -- Deduplication check against ledger bill payments
  SELECT id INTO v_duplicate_id
  FROM public.transactions
  WHERE user_id = p_user_id
    AND date = p_spend_date
    AND amount = p_amount
    AND type = 'bill_payment'
  LIMIT 1;

  IF v_duplicate_id IS NOT NULL THEN
    UPDATE public.notification_ingest_logs
    SET status = 'duplicate', error_reason = 'Matches existing bill payment in ledger'
    WHERE id = v_log_id;

    RETURN jsonb_build_object(
      'status', 'duplicate',
      'message', 'Matches an existing bill payment already recorded in ledger'
    );
  END IF;

  -- Create new spend
  INSERT INTO public.spends (
    user_id,
    name,
    amount,
    spend_date,
    source,
    dedupe_hash,
    notes,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_name,
    p_amount,
    p_spend_date,
    'notification',
    p_dedupe_hash,
    p_notes,
    clock_timestamp(),
    clock_timestamp()
  ) RETURNING id INTO v_spend_id;

  -- Mark log as imported and update device sync timestamp
  UPDATE public.notification_ingest_logs
  SET status = 'imported', spend_id = v_spend_id
  WHERE id = v_log_id;

  UPDATE public.linked_devices
  SET last_sync_at = clock_timestamp(), last_ip = COALESCE(p_client_ip, last_ip)
  WHERE id = p_device_id;

  RETURN jsonb_build_object(
    'status', 'imported',
    'message', 'Expense successfully imported from notification',
    'spend_id', v_spend_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Revoke execute from public/anon/authenticated and grant strictly to service_role
REVOKE ALL ON FUNCTION public.ingest_notification_spend(
  uuid, uuid, text, bigint, text, numeric, date, text, text, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ingest_notification_spend(
  uuid, uuid, text, bigint, text, numeric, date, text, text, text, text
) TO service_role;

