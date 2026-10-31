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
