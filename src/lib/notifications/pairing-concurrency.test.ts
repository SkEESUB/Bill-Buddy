import { describe, it, expect, vi } from "vitest";
import { completeDevicePairing } from "./devices.server";

// Mock Supabase admin client
vi.mock("@/integrations/supabase/client.server", () => {
  return {
    getAdminClient: vi.fn(),
  };
});

describe("Pairing Token Concurrency & Single-Use Enforcement", () => {
  it("allows only ONE concurrent request to consume a pairing token", async () => {
    const { getAdminClient } = await import("@/integrations/supabase/client.server");

    let tokenConsumed = false;

    // Simulate atomic database UPDATE ... WHERE used_at IS NULL
    const mockUpdate = vi.fn().mockImplementation((payload) => {
      return {
        eq: vi.fn().mockReturnValue({
          is: vi.fn().mockReturnValue({
            gt: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockImplementation(async () => {
                  if (tokenConsumed) {
                    // Second concurrent request sees 0 rows updated
                    return { data: null, error: null };
                  }
                  tokenConsumed = true;
                  return {
                    data: { user_id: "usr-concurrent-test" },
                    error: null,
                  };
                }),
              }),
            }),
          }),
        }),
      };
    });

    const mockUpsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "dev-concurrent-1",
            user_id: "usr-concurrent-test",
            device_name: "Pixel 8",
          },
          error: null,
        }),
      }),
    });

    const mockFrom = vi.fn((table: string) => {
      if (table === "device_pairing_tokens") {
        return {
          update: mockUpdate,
        };
      }
      if (table === "linked_devices") {
        return {
          upsert: mockUpsert,
        };
      }
      return {};
    });

    vi.mocked(getAdminClient).mockReturnValue({
      from: mockFrom,
      rpc: vi.fn().mockRejectedValue(new Error("RPC not found")), // force atomic query fallback
    } as any);

    const token = "pair_concurrent_token_123456789";

    // Launch two parallel concurrent pairing requests simultaneously
    const req1 = completeDevicePairing({
      pairingToken: token,
      deviceName: "Pixel 8",
      deviceFingerprint: "fp_concurrent_1",
    });

    const req2 = completeDevicePairing({
      pairingToken: token,
      deviceName: "Pixel 8",
      deviceFingerprint: "fp_concurrent_2",
    });

    const results = await Promise.allSettled([req1, req2]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const rejections = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed
    expect(successes).toHaveLength(1);
    // Exactly one must be rejected with safe invalid/expired error
    expect(rejections).toHaveLength(1);

    const error = (rejections[0] as PromiseRejectedResult).reason as Error;
    expect(error.message).toMatch(/INVALID_OR_EXPIRED_TOKEN/);
  });
});
