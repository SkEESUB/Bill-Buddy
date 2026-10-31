/**
 * Notification Ingestion and Verification Pipeline.
 *
 * Implements HMAC-SHA256 signature verification, replay protection with safe retry recovery,
 * timestamp drift boundaries, spend deduplication, and minimal audit logging.
 */
import crypto from "node:crypto";
import { getAdminClient } from "@/integrations/supabase/client.server";
import { decryptSecret, encryptSecret, isSecretEncrypted } from "@/lib/notifications/crypto.server";
import { computeSpendDedupeHash } from "@/lib/spends.functions";
import type { LinkedDevice, NotificationIngestStatus } from "@/types/database";

export interface IngestHeaders {
  deviceId: string;
  timestamp: string;
  nonce: string;
  signature: string;
  clientIp?: string | null;
}

export interface NotificationPayload {
  packageName: string;
  amount: number;
  direction: "DEBIT" | "CREDIT" | string;
  payee?: string;
  timestamp?: string;
  reference?: string;
}

export interface IngestResult {
  status: NotificationIngestStatus | "rejected";
  message: string;
  spendId?: string | null;
}

const MAX_DRIFT_MS = 5 * 60 * 1000; // 5 minutes maximum timestamp drift

/**
 * Verify HMAC-SHA256 signature and replay prevention.
 */
export async function authenticateNotificationRequest(
  headers: IngestHeaders,
  rawBody: string,
): Promise<LinkedDevice> {
  const { deviceId, timestamp, nonce, signature } = headers;

  if (!deviceId || !timestamp || !nonce || !signature) {
    throw new Error(
      "MISSING_AUTH_HEADERS: deviceId, timestamp, nonce, and signature are required.",
    );
  }

  // 1. Timestamp freshness check (prevent expired or post-dated replays)
  const tsNum = Number(timestamp);
  if (Number.isNaN(tsNum)) {
    throw new Error("INVALID_TIMESTAMP: Header x-timestamp must be an epoch millisecond integer.");
  }

  const drift = Math.abs(Date.now() - tsNum);
  if (drift > MAX_DRIFT_MS) {
    throw new Error(
      `TIMESTAMP_EXPIRED: Request timestamp drift of ${Math.round(drift / 1000)}s exceeds 300s window.`,
    );
  }

  // 2. Fetch device record from database
  const admin = getAdminClient();
  const { data: device, error: deviceError } = await admin
    .from("linked_devices")
    .select("*")
    .eq("id", deviceId)
    .maybeSingle();

  if (deviceError || !device) {
    throw new Error("UNAUTHORIZED_DEVICE: The specified device was not found.");
  }

  if (device.status === "revoked") {
    throw new Error(
      "DEVICE_REVOKED: This device has been disconnected and its credentials revoked.",
    );
  }

  if (device.status === "paused") {
    throw new Error("DEVICE_PAUSED: Sync for this device is currently paused.");
  }

  // 3. Verify HMAC-SHA256 signature (decrypting secret if stored encrypted)
  const rawHmacKey = decryptSecret(device.hmac_key);
  const expectedSig = crypto
    .createHmac("sha256", rawHmacKey)
    .update(`${timestamp}.${nonce}.${rawBody}`)
    .digest("hex");

  const sigBuf = Buffer.from(signature.toLowerCase(), "hex");
  const expBuf = Buffer.from(expectedSig.toLowerCase(), "hex");

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error("INVALID_SIGNATURE: HMAC signature verification failed.");
  }

  // 4. Lazy in-place re-encryption of legacy plaintext keys
  if (!isSecretEncrypted(device.hmac_key)) {
    try {
      const encryptedKey = encryptSecret(device.hmac_key);
      await admin.from("linked_devices").update({ hmac_key: encryptedKey }).eq("id", device.id);
    } catch (err) {
      console.warn("[ingest:lazy_reencrypt] Failed lazy re-encryption:", err);
    }
  }

  // 5. Nonce check: reject cross-device hijack, permit idempotent retry recovery for the same device
  const { data: existingNonce } = await admin
    .from("notification_ingest_logs")
    .select("id, status, spend_id, device_id")
    .eq("nonce", nonce)
    .maybeSingle();

  if (existingNonce) {
    if (existingNonce.device_id !== device.id) {
      throw new Error("REPLAY_DETECTED: Nonce claimed by another device.");
    }
    // If it belongs to this device, let processNotificationPayload perform idempotent recovery
  }

  return device as LinkedDevice;
}

/**
 * Ingest validated notification payload.
 */
export async function processNotificationPayload(
  device: LinkedDevice,
  payload: NotificationPayload,
  headers: IngestHeaders,
): Promise<IngestResult> {
  const admin = getAdminClient();
  const { packageName, amount, direction, payee, timestamp, reference } = payload;
  const { nonce, timestamp: requestTimestamp, clientIp } = headers;

  // 1. Validate payload basics
  const cleanPackage = (packageName || "unknown").trim().slice(0, 150);
  const cleanAmount = Number(amount);
  const cleanPayee = (payee || "Payment").trim().slice(0, 120);

  if (!cleanAmount || Number.isNaN(cleanAmount) || cleanAmount <= 0) {
    await logIngestEvent(admin, {
      userId: device.user_id,
      deviceId: device.id,
      nonce,
      requestTimestamp: Number(requestTimestamp),
      packageName: cleanPackage,
      status: "rejected",
      errorReason: "Invalid or non-positive amount",
    });
    return { status: "rejected", message: "Amount must be a positive number" };
  }

  // Extract YYYY-MM-DD
  let spendDate = new Date().toISOString().slice(0, 10);
  if (timestamp) {
    const parsedDate = new Date(timestamp);
    if (!Number.isNaN(parsedDate.getTime())) {
      spendDate = parsedDate.toISOString().slice(0, 10);
    }
  }

  // 2. Outgoing debit filter: only DEBIT notifications are imported into Spends
  if (direction !== "DEBIT") {
    const status: NotificationIngestStatus =
      direction === "CREDIT" ? "ignored_credit" : "needs_review";

    await logIngestEvent(admin, {
      userId: device.user_id,
      deviceId: device.id,
      nonce,
      requestTimestamp: Number(requestTimestamp),
      packageName: cleanPackage,
      status,
      errorReason:
        direction === "CREDIT" ? "Ignored incoming credit" : "Uncertain transaction direction",
    });

    return {
      status,
      message:
        direction === "CREDIT"
          ? "Incoming credit ignored for Spends"
          : "Transaction flagged for review",
    };
  }

  // 3. Outgoing debit processing
  const dedupeHash = computeSpendDedupeHash(device.user_id, spendDate, cleanAmount, cleanPayee);
  const notes = reference ? `Ref: ${reference.slice(0, 100)}` : null;

  // Attempt atomic database transaction via RPC first
  try {
    const { data: rpcResult, error: rpcError } = await (admin as any).rpc(
      "ingest_notification_spend",
      {
        p_user_id: device.user_id,
        p_device_id: device.id,
        p_nonce: nonce,
        p_request_timestamp: Number(requestTimestamp),
        p_package_name: cleanPackage,
        p_amount: cleanAmount,
        p_spend_date: spendDate,
        p_name: cleanPayee,
        p_dedupe_hash: dedupeHash,
        p_notes: notes,
        p_client_ip: clientIp ?? null,
      },
    );

    if (!rpcError && rpcResult) {
      const res = rpcResult as unknown as {
        status: string;
        message: string;
        spend_id?: string;
      };

      if (res.status === "replay_detected") {
        throw new Error(res.message || "REPLAY_DETECTED: Nonce has already been processed.");
      }

      return {
        status: res.status as NotificationIngestStatus,
        message: res.message,
        spendId: res.spend_id ?? null,
      };
    }
  } catch (rpcErr: unknown) {
    if (rpcErr instanceof Error && rpcErr.message.includes("REPLAY_DETECTED")) {
      throw rpcErr;
    }
    // Proceed to atomic database fallback
  }

  // Fallback: Atomic claim-before-mutation flow with safe retry recovery
  const { data: existingLog } = await admin
    .from("notification_ingest_logs")
    .select("id, status, spend_id, user_id, device_id")
    .eq("nonce", nonce)
    .maybeSingle();

  if (existingLog) {
    if (existingLog.user_id !== device.user_id || existingLog.device_id !== device.id) {
      throw new Error("REPLAY_DETECTED: Nonce claimed by another device or user.");
    }

    if (existingLog.status === "imported" && existingLog.spend_id) {
      return {
        status: "imported",
        message: "Expense already recorded (idempotent replay)",
        spendId: existingLog.spend_id,
      };
    }
    if (existingLog.status === "duplicate") {
      return {
        status: "duplicate",
        message: "Transaction already recorded as an expense",
        spendId: existingLog.spend_id ?? null,
      };
    }
    if (existingLog.status === "ignored_credit") {
      return {
        status: "ignored_credit",
        message: "Incoming credit ignored for Spends",
      };
    }
    if (
      existingLog.status === "processing" ||
      existingLog.status === "needs_review" ||
      existingLog.status === "rejected"
    ) {
      // Safe retry recovery: update timestamp and retry
      await admin
        .from("notification_ingest_logs")
        .update({
          status: "needs_review",
          error_reason: null,
          request_timestamp: Number(requestTimestamp),
        })
        .eq("id", existingLog.id);
    } else {
      throw new Error("REPLAY_DETECTED: Nonce has already been processed.");
    }
  } else {
    // 1. Claim the nonce first. If duplicate/parallel, the unique constraint immediately fails.
    const claimInsert = admin.from("notification_ingest_logs").insert({
      user_id: device.user_id,
      device_id: device.id,
      nonce,
      request_timestamp: Number(requestTimestamp),
      package_name: cleanPackage,
      status: "needs_review",
    });

    const claimRes =
      typeof (claimInsert as any)?.select === "function"
        ? await (claimInsert as any).select("id").maybeSingle()
        : await claimInsert;

    if (claimRes?.error) {
      if (claimRes.error.code === "23505" || claimRes.error.message?.includes("unique")) {
        throw new Error("REPLAY_DETECTED: Nonce has already been processed.");
      }
      throw new Error(`INGEST_CLAIM_ERROR: ${claimRes.error.message}`);
    }
  }

  // 2. Deduplication check against existing spends
  const { data: existingSpend } = await admin
    .from("spends")
    .select("id")
    .eq("user_id", device.user_id)
    .or(`dedupe_hash.eq.${dedupeHash},and(spend_date.eq.${spendDate},amount.eq.${cleanAmount})`)
    .limit(1)
    .maybeSingle();

  if (existingSpend) {
    await admin
      .from("notification_ingest_logs")
      .update({ status: "duplicate", spend_id: existingSpend.id })
      .eq("nonce", nonce);

    return {
      status: "duplicate",
      message: "Transaction already recorded as an expense",
      spendId: existingSpend.id,
    };
  }

  // 3. Deduplication check against ledger bill payments
  const { data: existingBillTxn } = await admin
    .from("transactions")
    .select("id")
    .eq("user_id", device.user_id)
    .eq("date", spendDate)
    .eq("amount", cleanAmount)
    .eq("type", "bill_payment")
    .limit(1)
    .maybeSingle();

  if (existingBillTxn) {
    await admin
      .from("notification_ingest_logs")
      .update({
        status: "duplicate",
        error_reason: "Matches existing bill payment in ledger",
      })
      .eq("nonce", nonce);

    return {
      status: "duplicate",
      message: "Matches an existing bill payment already recorded in ledger",
    };
  }

  // 4. Create new spend
  const { data: newSpend, error: spendError } = await admin
    .from("spends")
    .insert({
      user_id: device.user_id,
      name: cleanPayee,
      amount: cleanAmount,
      spend_date: spendDate,
      source: "notification",
      dedupe_hash: dedupeHash,
      notes,
    })
    .select("id")
    .single();

  if (spendError || !newSpend) {
    console.error("[ingest:error] Failed to insert spend:", spendError);
    await admin
      .from("notification_ingest_logs")
      .update({
        status: "rejected",
        error_reason: spendError?.message ?? "Database insert failed",
      })
      .eq("nonce", nonce);

    return { status: "rejected", message: "Failed to persist expense" };
  }

  // 5. Update device sync health & finalize log
  await admin
    .from("linked_devices")
    .update({
      last_sync_at: new Date().toISOString(),
      last_ip: clientIp ?? null,
    })
    .eq("id", device.id);

  await admin
    .from("notification_ingest_logs")
    .update({
      status: "imported",
      spend_id: newSpend.id,
    })
    .eq("nonce", nonce);

  return {
    status: "imported",
    message: "Expense successfully imported from notification",
    spendId: newSpend.id,
  };
}

async function logIngestEvent(
  admin: ReturnType<typeof getAdminClient>,
  data: {
    userId: string;
    deviceId: string;
    nonce: string;
    requestTimestamp: number;
    packageName: string;
    status: NotificationIngestStatus;
    spendId?: string | null;
    errorReason?: string | null;
  },
) {
  try {
    await admin.from("notification_ingest_logs").insert({
      user_id: data.userId,
      device_id: data.deviceId,
      nonce: data.nonce,
      request_timestamp: data.requestTimestamp,
      package_name: data.packageName,
      status: data.status,
      spend_id: data.spendId ?? null,
      error_reason: data.errorReason ?? null,
    });
  } catch (err) {
    console.error("[ingest:audit_log_error] Could not write audit log:", err);
  }
}
