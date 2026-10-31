import { createFileRoute } from "@tanstack/react-router";

/**
 * Android Device Pairing Endpoint.
 *
 * Exchanged during the initial QR code handshake.
 * Authenticates the ephemeral pairingToken and provisions a hardware-stored 256-bit HMAC key.
 */
export const Route = createFileRoute("/api/public/devices/pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: {
          pairingToken?: string;
          deviceName?: string;
          deviceFingerprint?: string;
        } = {};

        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { pairingToken, deviceName, deviceFingerprint } = body;

        if (!pairingToken || !deviceFingerprint) {
          return new Response(
            JSON.stringify({ error: "pairingToken and deviceFingerprint are required." }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const clientIp =
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
          request.headers.get("x-real-ip") ??
          null;

        const { completeDevicePairing } = await import("@/lib/notifications/devices.server");

        try {
          const result = await completeDevicePairing({
            pairingToken,
            deviceName: deviceName ?? "Android Device",
            deviceFingerprint,
            clientIp,
          });

          return new Response(
            JSON.stringify({
              success: true,
              deviceId: result.deviceId,
              hmacKey: result.hmacKey,
              deviceName: result.deviceName,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        } catch (err: unknown) {
          const errorMsg = err instanceof Error ? err.message : "Pairing failed";
          const status = errorMsg.includes("EXPIRED") || errorMsg.includes("INVALID") ? 401 : 500;

          return new Response(JSON.stringify({ error: errorMsg }), {
            status,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
