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
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("account_status")
      .eq("id", userId)
      .maybeSingle();

    // Fail closed on a lookup error: we cannot prove the account is active.
    if (error) throw new Error("Unauthorized: account status could not be verified");
    const status = assertAccountActive(data?.account_status);

    return next({ context: { accountStatus: status } });
  });
