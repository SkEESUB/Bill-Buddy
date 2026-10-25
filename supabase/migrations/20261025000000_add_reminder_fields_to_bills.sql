-- ============================================================================
-- Migration: 20261025000000_add_reminder_fields_to_bills.sql
-- Description: Add reminder_time and reminder_email to public.bills table
-- ============================================================================

-- Add reminder_time (defaults to 09:00:00)
ALTER TABLE public.bills 
  ADD COLUMN IF NOT EXISTS reminder_time time NOT NULL DEFAULT '09:00:00';

-- Add reminder_email (target email for bill reminder dispatches)
ALTER TABLE public.bills 
  ADD COLUMN IF NOT EXISTS reminder_email text;

-- Index for scheduler lookups
CREATE INDEX IF NOT EXISTS idx_bills_reminder 
  ON public.bills (is_active, due_date, reminder_time);
