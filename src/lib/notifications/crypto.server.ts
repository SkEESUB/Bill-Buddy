/**
 * Application-level cryptographic utilities for protecting sensitive credentials at rest.
 *
 * Implements AES-256-GCM authenticated encryption with a unique 96-bit IV and 128-bit authentication
 * tag per operation. Protects device HMAC keys stored in the database.
 */
import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const PREFIX = "enc:v1:";

/**
 * Determines whether the current execution context is strictly local development/testing.
 * Any cloud platform, preview environment, staging, or production deployment is NOT local.
 */
export function isLocalEnvironment(): boolean {
  // If explicitly flagged as deployed, staging, preview, or production -> not local
  if (
    process.env["NODE_ENV"] === "production" ||
    process.env["VERCEL_ENV"] ||
    process.env["CF_PAGES"] ||
    process.env["FLY_APP_NAME"] ||
    process.env["RENDER"] ||
    process.env["RAILWAY_ENVIRONMENT"] ||
    process.env["APP_ENV"] === "staging" ||
    process.env["APP_ENV"] === "preview" ||
    process.env["APP_ENV"] === "production" ||
    process.env["STAGING"] === "true"
  ) {
    return false;
  }

  // Must be strictly development or test AND running in a local context
  return process.env["NODE_ENV"] === "development" || process.env["NODE_ENV"] === "test";
}

/**
 * Validates and parses exactly 32 bytes of key material.
 * Supports 64-character hex strings or 44-character base64 strings.
 */
export function parseAndValidateKey(rawKey: string): Buffer {
  if (!rawKey || typeof rawKey !== "string") {
    throw new Error("INVALID_ENCRYPTION_KEY: SERVER_ENCRYPTION_KEY is missing or empty.");
  }

  const trimmed = rawKey.trim();

  // 64-hex-character string (32 bytes)
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, "hex");
    if (buf.length === 32) return buf;
  }

  // 44-character base64 string (32 bytes)
  if (trimmed.length === 44 && /^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    const buf = Buffer.from(trimmed, "base64");
    if (buf.length === 32) return buf;
  }

  throw new Error(
    "INVALID_ENCRYPTION_KEY: SERVER_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters or 44 base64 characters).",
  );
}

/**
 * Derives a 32-byte (256-bit) encryption key.
 * Fails closed in production, Vercel preview, staging, and deployed environments if unset or invalid.
 */
export function getEncryptionKey(): Buffer {
  const envKey = process.env["SERVER_ENCRYPTION_KEY"];

  if (envKey) {
    return parseAndValidateKey(envKey);
  }

  // In production, Vercel preview, staging, or any deployed environment, fail closed!
  if (!isLocalEnvironment()) {
    throw new Error(
      "SECURITY_ERROR: SERVER_ENCRYPTION_KEY must be configured in deployed, preview, staging, and production environments to protect credentials at rest.",
    );
  }

  // Permitted ONLY for strictly local development and test runners
  const devSeed = "billbuddy-dev-encryption-seed-2026-local";
  return crypto.createHash("sha256").update(devSeed).digest(); // exactly 32 bytes
}

/**
 * Encrypt a plaintext secret (such as a device HMAC key) using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) {
    throw new Error("INVALID_INPUT: Plaintext secret cannot be empty.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let ciphertext = cipher.update(plaintext, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString("hex")}:${authTag.toString("hex")}:${ciphertext}`;
}

/**
 * Decrypt a secret.
 * Supports a non-destructive migration path: if the stored value is not prefixed
 * with `enc:v1:`, it is treated as a legacy plaintext secret and returned safely.
 */
export function decryptSecret(storedValue: string): string {
  if (!storedValue) return "";

  // Safe migration strategy for legacy plaintext secrets
  if (!storedValue.startsWith(PREFIX)) {
    return storedValue;
  }

  const parts = storedValue.slice(PREFIX.length).split(":");
  if (parts.length !== 3) {
    throw new Error("MALFORMED_CIPHERTEXT: Expected enc:v1:<iv>:<authTag>:<ciphertext>");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (!ivHex || !authTagHex || !ciphertextHex) {
    throw new Error("MALFORMED_CIPHERTEXT: One or more encryption segments are missing.");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Returns whether a stored value is already encrypted.
 */
export function isSecretEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/**
 * Idempotent, safe migration procedure that encrypts all existing plaintext HMAC keys in the database.
 * Preserves device registrations and HMAC functionality without logging sensitive values.
 */
export async function migratePlaintextDeviceSecrets(
  adminClient: any,
): Promise<{ migratedCount: number; remainingPlaintextCount: number }> {
  if (!adminClient) {
    throw new Error("MIGRATION_ERROR: A Supabase admin client is required.");
  }

  // Find all devices where hmac_key does not start with enc:v1:
  const { data: devices, error } = await adminClient
    .from("linked_devices")
    .select("id, hmac_key")
    .not("hmac_key", "like", `${PREFIX}%`);

  if (error) {
    throw new Error(`MIGRATION_QUERY_ERROR: ${error.message}`);
  }

  if (!devices || devices.length === 0) {
    return { migratedCount: 0, remainingPlaintextCount: 0 };
  }

  let migratedCount = 0;
  for (const device of devices) {
    const rawKey = device.hmac_key;
    if (rawKey && !rawKey.startsWith(PREFIX)) {
      const encrypted = encryptSecret(rawKey);
      const { error: updateError } = await adminClient
        .from("linked_devices")
        .update({ hmac_key: encrypted })
        .eq("id", device.id);

      if (updateError) {
        throw new Error(`MIGRATION_UPDATE_ERROR for device ${device.id}: ${updateError.message}`);
      }
      migratedCount++;
    }
  }

  // Verify remaining
  const { count: remainingCount } = await adminClient
    .from("linked_devices")
    .select("id", { count: "exact", head: true })
    .not("hmac_key", "like", `${PREFIX}%`);

  return {
    migratedCount,
    remainingPlaintextCount: remainingCount ?? 0,
  };
}
