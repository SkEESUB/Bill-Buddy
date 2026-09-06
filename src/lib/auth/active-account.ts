/**
 * Server-side account-status gate.
 *
 * `requireSupabaseAuth` only proves the bearer token is valid. A suspended or
 * closed account keeps a live JWT until it expires, so without this middleware
 * a suspended user could keep mutating financial data through server functions
 * even though the UI redirects them out. This is the server-side boundary;
 * route guards are convenience only.
 */
import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAdminClient } from "@/integrations/supabase/client.server";

export class AccountInactiveError extends Error {
  constructor(status: string) {
    super(`ACCOUNT_${status}: this account cannot perform this operation.`);
    this.name = "AccountInactiveError";
  }
}

/**
 * The single definition of "may act". Only ACTIVE accounts may mutate or read
 * through server functions; SUSPENDED, CLOSED or any unknown status fails closed.
 */
export function assertAccountActive(status: string | null | undefined): string {
  const value = (status ?? "ACTIVE").toUpperCase();
  if (value !== "ACTIVE") throw new AccountInactiveError(value);
  return value;
}

export const requireActiveAccount = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { supabase, userId, claims } = context;
    const email = (claims?.["email"] as string) || `user_${userId.slice(0, 8)}`;

    let adminClient;
    try {
      adminClient = getAdminClient();
    } catch {
      // No service role key configured — trust JWT, skip DB check
      console.warn("[BillBuddy] No SUPABASE_SERVICE_ROLE_KEY. Skipping profile check.");
      return next({
        context: {
          accountStatus: "ACTIVE",
          isNewAccount: false,
        },
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      // Preserve actual error — never hide as "session expired"
      throw new Error(
        `DB_ERROR: Profile lookup failed — ${profileError.message} (${profileError.code})`
      );
    }

    if (!profile && !profileError) {
      // First login — create profile and settings automatically
      try {
        await adminClient
          .from("profiles")
          .upsert(
            {
              id: userId,
              account_status: "ACTIVE",
              full_name: email.split("@")[0],
            } as never,
            { onConflict: "id", ignoreDuplicates: true }
          );

        await adminClient
          .from("user_settings")
          .upsert(
            { user_id: userId } as never,
            { onConflict: "user_id", ignoreDuplicates: true }
          );

        await adminClient
          .from("notification_preferences")
          .upsert(
            { user_id: userId } as never,
            { onConflict: "user_id", ignoreDuplicates: true }
          );
      } catch (provisionErr) {
        console.warn("[BillBuddy] Auto-provisioning notice:", provisionErr);
      }

      return next({
        context: {
          accountStatus: "ACTIVE",
          isNewAccount: true,
        },
      });
    }

    const status = assertAccountActive(profile?.account_status);

    return next({ context: { accountStatus: status, isNewAccount: false } });
  });
