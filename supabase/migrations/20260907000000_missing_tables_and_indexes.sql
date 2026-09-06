-- Step 10: Missing Database Tables and Indexes for BillBuddy

-- 1. Spending Goals Table
create table if not exists public.spending_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_amount numeric(14,2) not null check (target_amount > 0),
  current_amount numeric(14,2) not null default 0,
  target_date date,
  category text,
  status text not null default 'active'
    check (status in ('active', 'completed', 'cancelled')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.spending_goals enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'spending_goals' and policyname = 'manage_own_goals'
  ) then
    create policy "manage_own_goals"
      on public.spending_goals for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- 2. Bill Reminders Table
create table if not exists public.bill_reminders (
  id uuid primary key default gen_random_uuid(),
  bill_occurrence_id uuid not null 
    references public.bill_occurrences(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_type text not null 
    check (reminder_type in ('email', 'push', 'in_app')),
  sent_at timestamptz,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'cancelled')),
  created_at timestamptz default now()
);

alter table public.bill_reminders enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'bill_reminders' and policyname = 'read_own_reminders'
  ) then
    create policy "read_own_reminders"
      on public.bill_reminders for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- 3. Onboarding columns on profiles table
alter table public.profiles 
  add column if not exists onboarding_completed boolean default false,
  add column if not exists onboarding_step integer default 0;

-- 4. Performance Indexes
create index if not exists idx_transactions_description_search
  on public.transactions
  using gin(to_tsvector('english', coalesce(description, '')));

create index if not exists idx_bills_user_active
  on public.bills(user_id, is_active, due_date);

create index if not exists idx_occurrences_user_date
  on public.bill_occurrences(user_id, scheduled_date, status);

create index if not exists idx_notifications_user_unread
  on public.notifications(user_id, is_read, created_at desc);

create index if not exists idx_transactions_user_date
  on public.transactions(user_id, date desc, status);
