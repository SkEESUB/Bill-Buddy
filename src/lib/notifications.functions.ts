/**
 * Server functions for In-App Notifications and Automatic Spend Tracking device management.
 *
 * All operations require an authenticated, active user session.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireActiveAccount } from "@/lib/auth/active-account";
import { z } from "zod";
import type { LinkedDevice, NotificationIngestLog } from "@/types/database";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  related_bill_id: string | null;
  related_transaction_id: string | null;
  related_budget_id: string | null;
  read_at: string | null;
  created_at: string;
};

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select(
        "id, type, title, body, related_bill_id, related_transaction_id, related_budget_id, read_at, created_at",
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as unknown as NotificationRow[];
    return { rows, unread: rows.filter((r) => !r.read_at).length };
  });

export const setNotificationRead = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) =>
    z.object({ id: z.string().uuid(), read: z.boolean().default(true) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: data.read ? new Date().toISOString() : null } as never)
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markAllNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() } as never)
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteNotification = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearNotifications = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// -------------------------------------------------------------
// AUTOMATIC SPEND TRACKING (ANDROID COMPANION & DEVICE LINKING)
// -------------------------------------------------------------

export const createPairingTokenSchema = z.object({
  baseUrl: z.string().url().optional(),
});

/**
 * Validates and normalizes pairing host URL.
 * Allows localhost and private LAN IPs for local mobile pairing; enforces strict HTTPS in production.
 */
export function validatePairingBaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) {
    return typeof process !== "undefined" && process.env["VERCEL_URL"]
      ? `https://${process.env["VERCEL_URL"]}`
      : "https://billbuddy.app";
  }

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("INVALID_URL: The provided pairing host URL is invalid.");
  }

  // Reject credentials in URL
  if (parsed.username || parsed.password) {
    throw new Error("SECURITY_ERROR: URL credentials are not allowed.");
  }

  // Reject non-http/https protocols in all environments
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("SECURITY_ERROR: Only http and https protocols are supported.");
  }

  // In production, require HTTPS
  const isProd = typeof process !== "undefined" && process.env["NODE_ENV"] === "production";
  if (isProd && parsed.protocol !== "https:") {
    throw new Error(
      "SECURITY_ERROR: In production, HTTPS is strictly required for device pairing.",
    );
  }

  const hostname = parsed.hostname.toLowerCase();

  // Allow localhost & loopback in non-production
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return `${parsed.protocol}//${parsed.host}`;
  }

  // Allow private LAN IPv4 (192.168.x.x, 10.x.x.x, 172.16-31.x.x) for local real-device testing
  const isPrivateIp =
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

  if (isPrivateIp) {
    return `${parsed.protocol}//${parsed.host}`;
  }

  // For public domain names (e.g. your-billbuddy.vercel.app), require valid domain pattern
  if (
    /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(hostname)
  ) {
    return `${parsed.protocol}//${parsed.host}`;
  }

  throw new Error("SECURITY_ERROR: Invalid or untrusted host for device pairing.");
}

export const revokeDeviceSchema = z.object({
  deviceId: z.string().uuid("Invalid device ID"),
});

export const toggleDeviceStatusSchema = z.object({
  deviceId: z.string().uuid("Invalid device ID"),
  status: z.enum(["active", "paused"]),
});

/**
 * Generate a new QR pairing token for the authenticated user.
 */
export const createDevicePairingTokenFn = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((d: unknown) => createPairingTokenSchema.parse(d ?? {}))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { createDevicePairingToken } = await import("@/lib/notifications/devices.server");
    const validatedBaseUrl = validatePairingBaseUrl(data.baseUrl);

    return await createDevicePairingToken(userId, validatedBaseUrl);
  });

/**
 * List all linked devices for the authenticated user (never reveals secret keys).
 */
export const listUserDevicesFn = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { listUserDevices } = await import("@/lib/notifications/devices.server");
    return (await listUserDevices(userId)) as Omit<LinkedDevice, "hmac_key">[];
  });

/**
 * Revoke device access immediately.
 */
export const revokeDeviceFn = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((d: unknown) => revokeDeviceSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { revokeDevice } = await import("@/lib/notifications/devices.server");
    return await revokeDevice(userId, data.deviceId);
  });

/**
 * Toggle device status (active vs paused).
 */
export const toggleDeviceStatusFn = createServerFn({ method: "POST" })
  .middleware([requireActiveAccount])
  .validator((d: unknown) => toggleDeviceStatusSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { userId } = context;
    const { setDeviceStatus } = await import("@/lib/notifications/devices.server");
    return await setDeviceStatus(userId, data.deviceId, data.status);
  });

/**
 * Retrieve recent notification ingestion audit logs for the user.
 * Zero sensitive text or account numbers are included.
 */
export const getNotificationAuditLogsFn = createServerFn({ method: "GET" })
  .middleware([requireActiveAccount])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { getAdminClient } = await import("@/integrations/supabase/client.server");
    let admin;
    try {
      admin = getAdminClient();
    } catch {
      return [];
    }

    const { data, error } = await admin
      .from("notification_ingest_logs")
      .select(
        "id, user_id, device_id, nonce, request_timestamp, package_name, status, spend_id, error_reason, created_at",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) {
      console.error("[audit_logs] Failed to load notification audit logs:", error);
      return [];
    }

    return (data ?? []) as NotificationIngestLog[];
  });
