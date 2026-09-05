import { useCallback, useEffect, useState } from "react";
import { useNavigate, useRouter } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/**
 * Tracks auth state, exposes the current user and a signOut helper.
 *
 * Pass `redirectTo` to auto-redirect once the auth state is known:
 *   useAuth({ redirectTo: "/login", when: "signed-out" })
 *   useAuth({ redirectTo: "/", when: "signed-in" })
 */
export function useAuth(options?: { redirectTo?: string; when?: "signed-in" | "signed-out" }) {
  const navigate = useNavigate();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const { redirectTo, when = "signed-out" } = options ?? {};

  useEffect(() => {
    if (loading || !redirectTo) return;
    const shouldRedirect = when === "signed-out" ? !session : !!session;
    if (shouldRedirect) navigate({ to: redirectTo, replace: true });
  }, [loading, session, redirectTo, when, navigate]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    await router.invalidate();
    navigate({ to: "/login", replace: true });
  }, [navigate, router]);

  const user: User | null = session?.user ?? null;
  return { session, user, loading, isAuthenticated: !!session, signOut };
}

/** Converts a 10-digit Indian phone number into the synthetic auth email. */
export function phoneToEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@billmanager.app`;
}
