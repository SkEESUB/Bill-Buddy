import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./client";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    // New Supabase API keys are opaque strings, not bearer JWTs.
    if (
      isNewSupabaseApiKey(supabaseKey) &&
      headers.get("Authorization") === `Bearer ${supabaseKey}`
    ) {
      headers.delete("Authorization");
    }

    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const supabaseUrl = SUPABASE_URL;
    const anonKey = SUPABASE_PUBLISHABLE_KEY;

    const request = getRequest();

    if (!request?.headers) {
      throw new Error("Unauthorized: No request headers available");
    }

    const authHeader = request.headers.get("authorization");

    if (!authHeader) {
      throw new Error("Unauthorized: No authorization header provided");
    }

    if (!authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: Only Bearer tokens are supported");
    }

    const token = authHeader.replace("Bearer ", "");
    if (!token) {
      throw new Error("Unauthorized: No token provided");
    }

    if (token.split(".").length !== 3) {
      throw new Error("Unauthorized: Invalid token");
    }

    const supabase = createClient<Database>(supabaseUrl, anonKey, {
      global: {
        fetch: createSupabaseFetch(anonKey),
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    let userId: string | undefined;
    let claims: Record<string, unknown> | undefined;

    try {
      const { data, error } = await supabase.auth.getClaims(token);
      if (!error && data?.claims?.sub) {
        userId = data.claims.sub;
        claims = data.claims as Record<string, unknown>;
      }
    } catch {
      // Fall through to getUser verification
    }

    if (!userId) {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData?.user?.id) {
        if (userError?.message?.toLowerCase().includes("invalid api key")) {
          throw new Error(
            "CONFIG_ERROR: Invalid API key — check SUPABASE_PUBLISHABLE_KEY in Vercel env vars"
          );
        }
        throw new Error(`AUTH_INVALID: ${userError?.message || "Invalid token"}`);
      }
      userId = userData.user.id;
      claims = {
        sub: userData.user.id,
        email: userData.user.email,
        ...userData.user.app_metadata,
        ...userData.user.user_metadata,
      };
    }

    return next({
      context: {
        supabase,
        userId,
        claims,
      },
    });
  },
);
