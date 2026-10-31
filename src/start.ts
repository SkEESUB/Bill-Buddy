import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

import { getRequest } from "@tanstack/react-start/server";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // Never intercept server function RPCs with HTML error pages; rethrow so TanStack Start
    // serializes the error payload to the client, preserving the actionable backend error.
    try {
      const request = getRequest();
      if (
        request?.url?.includes("/_serverFn/") ||
        request?.headers?.get("x-tss-server-fn") ||
        request?.headers?.get("accept")?.includes("application/json")
      ) {
        throw error;
      }
    } catch (reqErr) {
      if (reqErr === error) throw error;
      // getRequest might throw outside request context; proceed to rethrow original error if so
      throw error;
    }

    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
