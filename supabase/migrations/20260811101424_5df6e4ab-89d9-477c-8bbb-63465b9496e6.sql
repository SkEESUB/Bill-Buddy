INSERT INTO public.profiles (id) SELECT id FROM auth.users ON CONFLICT (id) DO NOTHING;
INSERT INTO public.user_settings (user_id) SELECT id FROM auth.users ON CONFLICT (user_id) DO NOTHING;