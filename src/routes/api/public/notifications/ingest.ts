import { createFileRoute } from "@tanstack/react-router";

/**
 * Android Notification Ingestion Endpoint.
 *
 * Receives cryptographically authenticated, HMAC-signed transaction notifications
 * dispatched by the BillBuddy Android Companion application.
 */
export const Route = createFileRoute("/api/public/notifications/ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();

        const deviceId = request.headers.get("x-device-id") ?? "";
        const timestamp = request.headers.get("x-timestamp") ?? "";
        const nonce = request.headers.get("x-nonce") ?? "";
        const signature = request.headers.get("x-signature") ?? "";

        const clientIp =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          null;

        const headers = {
          deviceId,
          timestamp,
          nonce,
          signature,
          clientIp,
        };

        const { authenticateNotificationRequest, processNotificationPayload } =
          await import("@/lib/notifications/ingest.server");

        // 1. Cryptographic authentication & replay defense
        let device;
        try {
          device = await authenticateNotificationRequest(headers, rawBody);
        } catch (authError: unknown) {
          const msg = authError instanceof Error ? authError.message : "Authentication failed";
          const isReplay = msg.includes("REPLAY");
          const isTimestamp = msg.includes("TIMESTAMP");
          const status = isReplay ? 409 : isTimestamp ? 400 : 401;

          return new Response(JSON.stringify({ error: msg }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 2. Parse payload
        let payload;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        // 3. Process ingestion pipeline
        try {
          const result = await processNotificationPayload(device, payload, headers);
          return new Response(JSON.stringify(result), {
            status: result.status === "rejected" ? 400 : 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Ingestion processing error";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
