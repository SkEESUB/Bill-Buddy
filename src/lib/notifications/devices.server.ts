/**
 * Server-side management of linked devices and cryptographic pairing.
 *
 * Implements ephemeral single-use pairing tokens and device secret provisioning.
 */
import crypto from "node:crypto";
import { getAdminClient } from "@/integrations/supabase/client.server";
import { encryptSecret } from "@/lib/notifications/crypto.server";
import type { LinkedDevice, DevicePairingToken } from "@/types/database";

export interface PairingPayload {
  token: string;
  expiresAt: string;
  qrPayload: string;
}

export interface CompletePairingResult {
  deviceId: string;
  hmacKey: string;
  deviceName: string;
  userId: string;
}

/**
 * Generate a short-lived (5-minute), single-use pairing token for the QR code handshake.
 */
export async function createDevicePairingToken(
  userId: string,
  baseUrl: string,
): Promise<PairingPayload> {
  const token = `pair_${crypto.randomBytes(24).toString("hex")}`;
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  let admin;
  try {
    admin = getAdminClient();
    const { error } = await admin.from("device_pairing_tokens").insert({
      token,
      user_id: userId,
      expires_at: expiresAt,
    });
    if (error) {
      console.error("[devices:pair] Failed to persist pairing token:", error);
    }
  } catch (err) {
    console.warn("[devices:pair] Admin client unavailable for token storage:", err);
  }

  // QR Payload JSON string consumed by the Android companion app
  const qrData = {
    v: 1,
    endpoint: `${baseUrl.replace(/\/+$/, "")}/api/public/devices/pair`,
    ingestEndpoint: `${baseUrl.replace(/\/+$/, "")}/api/public/notifications/ingest`,
    token,
    expiresAt,
  };

  return {
    token,
    expiresAt,
    qrPayload: JSON.stringify(qrData),
  };
}

/**
 * Complete device pairing: validate the token, issue a 256-bit HMAC secret,
 * and register the device record.
 */
export async function completeDevicePairing(params: {
  pairingToken: string;
  deviceName: string;
  deviceFingerprint: string;
  clientIp?: string | null;
}): Promise<CompletePairingResult> {
  const { pairingToken, deviceName, deviceFingerprint, clientIp } = params;

  if (!pairingToken || !deviceFingerprint) {
    throw new Error("INVALID_INPUT: pairingToken and deviceFingerprint are required.");
  }

  const admin = getAdminClient();

  // 1. Atomically consume the pairing token in a single operation
  // Tries the atomic RPC first; if unavailable, uses row-level atomic UPDATE
  let userId: string | null = null;
  const nowIso = new Date().toISOString();

  try {
    const { data: rpcUserId, error: rpcError } = await (admin as any).rpc("consume_pairing_token", {
      p_token: pairingToken,
    });
    if (!rpcError && rpcUserId) {
      userId = String(rpcUserId);
    }
  } catch {
    // RPC not available in local test environment, proceed to atomic query fallback
  }

  if (!userId) {
    const { data: updatedToken, error: tokenError } = await admin
      .from("device_pairing_tokens")
      .update({ used_at: nowIso })
      .eq("token", pairingToken)
      .is("used_at", null)
      .gt("expires_at", nowIso)
      .select("user_id")
      .maybeSingle();

    if (tokenError || !updatedToken || !(updatedToken as any).user_id) {
      throw new Error(
        "INVALID_OR_EXPIRED_TOKEN: The pairing token is invalid, expired, or has already been used.",
      );
    }
    userId = String((updatedToken as any).user_id);
  }

  if (!userId) {
    throw new Error(
      "INVALID_OR_EXPIRED_TOKEN: The pairing token is invalid, expired, or has already been used.",
    );
  }

  // 2. Generate a cryptographically strong 256-bit HMAC key
  const rawHmacKey = crypto.randomBytes(32).toString("hex");

  // 3. Encrypt the HMAC key at rest using AES-256-GCM before database storage
  const encryptedHmacKey = encryptSecret(rawHmacKey);

  // 4. Upsert linked device for the user
  const sanitizedDeviceName = (deviceName || "Android Device").trim().slice(0, 100);

  const { data: device, error: deviceError } = await admin
    .from("linked_devices")
    .upsert(
      {
        user_id: userId,
        device_name: sanitizedDeviceName,
        device_fingerprint: deviceFingerprint.trim(),
        hmac_key: encryptedHmacKey,
        status: "active",
        last_sync_at: nowIso,
        last_ip: clientIp ?? null,
        revoked_at: null,
      },
      {
        onConflict: "user_id,device_fingerprint",
      },
    )
    .select("id, user_id, device_name")
    .single();

  if (deviceError || !device) {
    throw new Error(
      `DEVICE_REGISTRATION_FAILED: ${deviceError?.message ?? "Unknown database error"}`,
    );
  }

  return {
    deviceId: device.id,
    hmacKey: rawHmacKey, // Return unencrypted key once to Android companion for AndroidKeyStore
    deviceName: device.device_name,
    userId: device.user_id,
  };
}

/**
 * List active & paused devices for a user. Never exposes hmac_key.
 */
export async function listUserDevices(userId: string): Promise<Omit<LinkedDevice, "hmac_key">[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("linked_devices")
    .select(
      "id, user_id, device_name, device_fingerprint, status, last_sync_at, last_ip, created_at, revoked_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[devices:list] Failed to fetch devices:", error);
    return [];
  }

  return (data ?? []) as Omit<LinkedDevice, "hmac_key">[];
}

/**
 * Revoke device access immediately.
 */
export async function revokeDevice(userId: string, deviceId: string): Promise<boolean> {
  const admin = getAdminClient();
  const { error } = await admin
    .from("linked_devices")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
    })
    .eq("id", deviceId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`REVOKE_FAILED: ${error.message}`);
  }

  return true;
}

/**
 * Toggle device status between active and paused.
 */
export async function setDeviceStatus(
  userId: string,
  deviceId: string,
  status: "active" | "paused",
): Promise<boolean> {
  const admin = getAdminClient();
  const { error } = await admin
    .from("linked_devices")
    .update({ status })
    .eq("id", deviceId)
    .eq("user_id", userId)
    .neq("status", "revoked");

  if (error) {
    throw new Error(`STATUS_UPDATE_FAILED: ${error.message}`);
  }

  return true;
}
