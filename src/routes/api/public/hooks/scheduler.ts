import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled automation entry point, called hourly by the database scheduler.
 *
 * The work itself is idempotent and claim-locked, so an extra or retried call
 * is harmless — but the endpoint is still gated on the project API key so it
 * cannot be used as an anonymous way to make the system do work.
 */
export const Route = createFileRoute("/api/public/hooks/scheduler")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const presented =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";

        if (!expected) {
          console.error("[jobs:scheduler] no project key configured on the server");
          return json({ error: "Scheduler not configured" }, 503);
        }
        if (!safeEqual(presented, expected)) {
          return json({ error: "Unauthorized" }, 401);
        }

        let body: { job?: string } = {};
        try {
          const text = await request.text();
          if (text) body = JSON.parse(text) as { job?: string };
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        const { runNotificationSweep, runNotificationRetention } = await import(
          "@/lib/jobs.server"
        );
        const job = body.job === "retention" ? "retention" : "sweep";

        try {
          const result =
            job === "retention" ? await runNotificationRetention() : await runNotificationSweep();
          return json({ job, ...result });
        } catch (error) {
          const { classifyFailure } = await import("@/lib/scheduler");
          const category = classifyFailure(error);
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[jobs:scheduler] ${job} ${category}:`, message);
          // Retryable failures answer 503 so the caller may safely try again;
          // permanent ones answer 500 and are recorded, not retried.
          return json({ job, error: message, category }, category === "retryable" ? 503 : 500);
        }
      },
    },
  },
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Length-safe constant-time-ish comparison; avoids leaking the key by timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
