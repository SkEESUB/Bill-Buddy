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
CREATE POLICY "Users can only manage their own spends"
  ON public.spends
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Performance indexes for date queries
CREATE INDEX IF NOT EXISTS idx_spends_user_date ON public.spends (user_id, spend_date DESC);
CREATE INDEX IF NOT EXISTS idx_spends_created ON public.spends (user_id, created_at DESC);
