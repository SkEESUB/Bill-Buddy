/**
 * Backend (Supabase) client.
 *
 * The client is created from the project's environment variables
 * (VITE_SUPABASE_URL + the publishable/anon key) and is configured with:
 *   - auth.storage: localStorage  (session persistence)
 *   - auth.persistSession: true
 *   - auth.autoRefreshToken: true
 *
 * The generated module is the single source of truth for that config,
 * so this file just re-exports it as the app-facing import path.
 */
import { supabase } from "@/integrations/supabase/client";

// Debug logging for auth state changes (browser only).
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange((event, session) => {
    console.log("🔐 Auth Event:", event);
    if (session) {
      console.log("✅ User authenticated:", session.user.email);
    } else {
      console.log("❌ No active session");
    }
  });
}

export { supabase };
export type { Database } from "@/integrations/supabase/types";
