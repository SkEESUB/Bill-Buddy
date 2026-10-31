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
