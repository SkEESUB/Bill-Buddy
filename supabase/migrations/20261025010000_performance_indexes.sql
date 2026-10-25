-- BillBuddy Phase 5 Performance Optimization Indexes
-- Optimize bill save and completion queries:
-- 1. Index on bill_reminders for fast occurrence and scheduled_for lookups
-- 2. Index on bill_occurrences for fast bill and status lookups

create index if not exists idx_bill_reminders_occ_status
  on public.bill_reminders(bill_occurrence_id, status);

create index if not exists idx_bill_reminders_user_status
  on public.bill_reminders(user_id, status, scheduled_for);

create index if not exists idx_bill_occurrences_bill_status
  on public.bill_occurrences(bill_id, status);
