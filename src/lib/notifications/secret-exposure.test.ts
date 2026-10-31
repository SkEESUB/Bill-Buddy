import { describe, it, expect, vi } from "vitest";
import { listUserDevices, completeDevicePairing } from "./devices.server";
import { isSecretEncrypted } from "./crypto.server";

// Mock Supabase admin client
vi.mock("@/integrations/supabase/client.server", () => {
  return {
    getAdminClient: vi.fn(),
  };
});

describe("Secret Exposure Defense (PostgREST & At-Rest Protection)", () => {
  it("never includes hmac_key in listUserDevices results", async () => {
    const { getAdminClient } = await import("@/integrations/supabase/client.server");

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockImplementation((columns: string) => {
        // Assert that hmac_key is NOT queried in user-facing function
        expect(columns).not.toContain("hmac_key");
        return {
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "dev-1",
                  user_id: "usr-1",
                  device_name: "Pixel 8",
                  device_fingerprint: "fp_1",
                  status: "active",
                  last_sync_at: null,
                  last_ip: null,
                  created_at: new Date().toISOString(),
                  revoked_at: null,
                },
              ],
              error: null,
            }),
          }),
        };
      }),
    });

    vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

    const devices = await listUserDevices("usr-1");
    expect(devices).toHaveLength(1);
    expect(devices[0]).not.toHaveProperty("hmac_key");
  });

  it("stores hmac_key in the database as encrypted ciphertext (enc:v1:...) and never plaintext", async () => {
    const { getAdminClient } = await import("@/integrations/supabase/client.server");

    let savedPayload: Record<string, any> = {};

    const mockUpsert = vi.fn().mockImplementation((payload) => {
      savedPayload = payload;
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: "dev-100", user_id: "usr-1", device_name: "Phone" },
            error: null,
          }),
        }),
      };
    });

    const mockFrom = vi.fn((table: string) => {
      if (table === "device_pairing_tokens") {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                gt: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { user_id: "usr-1" },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "linked_devices") {
        return { upsert: mockUpsert };
      }
      return {};
    });

    vi.mocked(getAdminClient).mockReturnValue({
      from: mockFrom,
      rpc: vi.fn().mockRejectedValue(new Error("RPC not found")),
    } as any);

    const result = await completeDevicePairing({
      pairingToken: "pair_test_123",
      deviceName: "Galaxy S24",
      deviceFingerprint: "fp_test_123",
    });

    // 1. Android companion gets the raw HMAC key to store in AndroidKeyStore
    expect(result.hmacKey).toMatch(/^[0-9a-f]{64}$/);

    // 2. Database upsert payload MUST receive encrypted ciphertext, NOT the raw secret!
    expect(savedPayload["hmac_key"]).toBeDefined();
    expect(isSecretEncrypted(savedPayload["hmac_key"])).toBe(true);
    expect(savedPayload["hmac_key"]).not.toBe(result.hmacKey);
  });
});
