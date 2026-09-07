export type RecurringType = "monthly" | "weekly" | "yearly";

/** Recurrence supported by the scheduling engine. */
export type RepeatType = "none" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

export type Bill = {
  id: string;
  user_id: string;
  title: string;
  amount: number;
  category: string;
  due_date: string;
  is_recurring: boolean;
  recurring_type?: RecurringType;
  repeat_type?: RepeatType;
  repeat_interval?: number;
  repeat_end_date?: string | null;
  reminder_days_before?: number;
  is_active?: boolean;
  amount_type?: "fixed" | "variable";
  currency?: string;
  upi_id?: string;
  notes?: string;
  created_at: string;
};

export type Payment = {
  id: string;
  bill_id: string;
  user_id: string;
  amount: number;
  payment_date: string;
  payment_method: string;
  status: string;
  created_at: string;
};

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "refund"
  | "adjustment"
  | "bill_payment";

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  status?: string;
  payment_method?: string | null;
  notes?: string | null;
  bill_occurrence_id?: string | null;
  created_at: string;
};

export type BudgetPeriod = "monthly" | "weekly";

export type Budget = {
  id: string;
  user_id: string;
  category: string;
  amount: number;
  period: BudgetPeriod;
  created_at: string;
};

/*
SQL SCHEMA
----------

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  amount numeric(12,2) not null,
  category text not null default 'general',
  due_date date not null,
  is_recurring boolean not null default false,
  recurring_type text check (recurring_type in ('monthly','weekly','yearly')),
  upi_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.bills to authenticated;
grant all on public.bills to service_role;
alter table public.bills enable row level security;

create policy "Users manage own bills" on public.bills
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  amount numeric(12,2) not null,
  payment_date date not null default current_date,
  payment_method text not null default 'upi',
  status text not null default 'completed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.payments to authenticated;
grant all on public.payments to service_role;
alter table public.payments enable row level security;

create policy "Users manage own payments" on public.payments
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
*/

/** Editable profile record backing the Profile screen. */
export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  mobile: string | null;
  default_upi_id: string | null;
  onboarding_completed?: boolean;
  onboarding_step?: number;
  created_at: string;
  updated_at: string;
};

/** Per-user app preferences backing the Settings screen. */
export type UserSettings = {
  user_id: string;
  currency: string;
  monthly_income: number;
  monthly_budget: number;
  starting_balance: number;
  theme: string;
  timezone: string;
  reduced_motion: boolean;
  default_budget_period: string;
  default_warn_threshold: number;
  default_near_limit_threshold: number;
  notify_bill_reminders: boolean;
  notify_due_today: boolean;
  notify_due_tomorrow: boolean;
  notify_overdue: boolean;
  notify_payment_recorded: boolean;
  notify_weekly_summary: boolean;
  notify_monthly_summary: boolean;
  created_at: string;
  updated_at: string;
};
