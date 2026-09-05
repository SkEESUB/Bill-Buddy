ALTER TABLE public.user_settings
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  ADD COLUMN IF NOT EXISTS reduced_motion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_budget_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS default_warn_threshold numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS default_near_limit_threshold numeric NOT NULL DEFAULT 80;

DO $$ BEGIN
  ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_default_budget_period_check
    CHECK (default_budget_period IN ('weekly','monthly','quarterly','yearly','custom'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_thresholds_check
    CHECK (default_warn_threshold > 0 AND default_warn_threshold < default_near_limit_threshold
           AND default_near_limit_threshold < 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_settings
    ADD CONSTRAINT user_settings_theme_check CHECK (theme IN ('light','dark','system'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.closed_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  closed_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  retained_summary jsonb NOT NULL DEFAULT '{}'::jsonb
);
GRANT ALL ON public.closed_accounts TO service_role;
ALTER TABLE public.closed_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Avatars are readable by owner" ON storage.objects;
CREATE POLICY "Avatars are readable by owner" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars are writable by owner" ON storage.objects;
CREATE POLICY "Avatars are writable by owner" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars are updatable by owner" ON storage.objects;
CREATE POLICY "Avatars are updatable by owner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Avatars are removable by owner" ON storage.objects;
CREATE POLICY "Avatars are removable by owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
