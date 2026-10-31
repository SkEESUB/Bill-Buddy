import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  encryptSecret,
  decryptSecret,
  isSecretEncrypted,
  migratePlaintextDeviceSecrets,
} from "./crypto.server";

describe("Server-Side Secret Encryption & Decryption (AES-256-GCM)", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("encrypts and decrypts a device HMAC secret correctly", () => {
    const rawSecret = "9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b";
    const encrypted = encryptSecret(rawSecret);

    expect(isSecretEncrypted(encrypted)).toBe(true);
    expect(encrypted.startsWith("enc:v1:")).toBe(true);

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe(rawSecret);
  });

  it("produces unique IVs and ciphertexts for repeated encryptions of identical plaintext", () => {
    const rawSecret = "test-secret-12345";
    const enc1 = encryptSecret(rawSecret);
    const enc2 = encryptSecret(rawSecret);

    expect(enc1).not.toBe(enc2);
    expect(decryptSecret(enc1)).toBe(rawSecret);
    expect(decryptSecret(enc2)).toBe(rawSecret);
  });

  it("fails decryption when ciphertext is tampered with (GCM authentication tag check)", () => {
    const rawSecret = "tamper-proof-secret";
    const encrypted = encryptSecret(rawSecret);
    const parts = encrypted.split(":");
    // Corrupt the ciphertext payload
    const corruptedCiphertext = parts[3]!.slice(0, -2) + "ff";
    const corrupted = `${parts[0]}:${parts[1]}:${parts[2]}:${corruptedCiphertext}`;

    expect(() => decryptSecret(corrupted)).toThrow();
  });

  it("supports safe migration: treats legacy unencrypted secrets as plaintext", () => {
    const legacyPlaintextKey = "legacy-device-hmac-key-hex-format";
    expect(isSecretEncrypted(legacyPlaintextKey)).toBe(false);
    expect(decryptSecret(legacyPlaintextKey)).toBe(legacyPlaintextKey);
  });

  it("fails closed in production if SERVER_ENCRYPTION_KEY is missing", () => {
    delete process.env["SERVER_ENCRYPTION_KEY"];
    process.env["NODE_ENV"] = "production";

    expect(() => encryptSecret("secret")).toThrow(/SERVER_ENCRYPTION_KEY must be configured/);
  });

  it("fails closed in Vercel preview environments if SERVER_ENCRYPTION_KEY is missing", () => {
    delete process.env["SERVER_ENCRYPTION_KEY"];
    delete process.env["NODE_ENV"];
    process.env["VERCEL_ENV"] = "preview";

    expect(() => encryptSecret("secret")).toThrow(/SERVER_ENCRYPTION_KEY must be configured/);
  });

  it("fails closed in staging environments if SERVER_ENCRYPTION_KEY is missing", () => {
    delete process.env["SERVER_ENCRYPTION_KEY"];
    delete process.env["NODE_ENV"];
    process.env["APP_ENV"] = "staging";

    expect(() => encryptSecret("secret")).toThrow(/SERVER_ENCRYPTION_KEY must be configured/);
  });

  it("rejects invalid encryption keys that are not 32 bytes", () => {
    // 16 bytes hex (too short)
    process.env["SERVER_ENCRYPTION_KEY"] = "0123456789abcdef";
    expect(() => encryptSecret("secret")).toThrow(/INVALID_ENCRYPTION_KEY/);

    // Arbitrary invalid text
    process.env["SERVER_ENCRYPTION_KEY"] = "short-insecure-passphrase";
    expect(() => encryptSecret("secret")).toThrow(/INVALID_ENCRYPTION_KEY/);
  });

  it("accepts valid 64-hex-character 32-byte encryption keys", () => {
    process.env["SERVER_ENCRYPTION_KEY"] =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const encrypted = encryptSecret("test-secret");
    expect(decryptSecret(encrypted)).toBe("test-secret");
  });

  it("safely migrates existing plaintext keys to ciphertext without breaking decryption", async () => {
    const devicesInDb = [
      { id: "dev-1", hmac_key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef" },
      { id: "dev-2", hmac_key: "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210" },
    ];

    const mockUpdate = vi.fn().mockImplementation((payload) => {
      return {
        eq: vi.fn().mockImplementation((field, val) => {
          const target = devicesInDb.find((d) => d.id === val);
          if (target) target.hmac_key = payload.hmac_key;
          return Promise.resolve({ error: null });
        }),
      };
    });

    const mockAdmin = {
      from: vi.fn((table: string) => {
        if (table === "linked_devices") {
          return {
            select: vi.fn().mockImplementation((fields, opts) => {
              if (opts?.count === "exact") {
                const remaining = devicesInDb.filter((d) => !d.hmac_key.startsWith("enc:v1:"));
                return {
                  not: vi.fn().mockResolvedValue({ count: remaining.length, error: null }),
                };
              }
              return {
                not: vi.fn().mockResolvedValue({
                  data: devicesInDb.filter((d) => !d.hmac_key.startsWith("enc:v1:")),
                  error: null,
                }),
              };
            }),
            update: mockUpdate,
          };
        }
        return {};
      }),
    };

    const result = await migratePlaintextDeviceSecrets(mockAdmin);
    expect(result.migratedCount).toBe(2);
    expect(result.remainingPlaintextCount).toBe(0);

    // Verify all devices are now encrypted and decrypt cleanly
    expect(isSecretEncrypted(devicesInDb[0]!.hmac_key)).toBe(true);
    expect(isSecretEncrypted(devicesInDb[1]!.hmac_key)).toBe(true);
    expect(decryptSecret(devicesInDb[0]!.hmac_key)).toBe(
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    expect(decryptSecret(devicesInDb[1]!.hmac_key)).toBe(
      "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210",
    );
  });
});
