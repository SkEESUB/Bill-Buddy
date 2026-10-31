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
