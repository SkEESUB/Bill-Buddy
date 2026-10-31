import { describe, it, expect, vi } from "vitest";
import crypto from "node:crypto";
import {
  processNotificationPayload,
  type IngestHeaders,
  type NotificationPayload,
} from "./ingest.server";

// Mock Supabase admin client
vi.mock("@/integrations/supabase/client.server", () => {
  return {
    getAdminClient: vi.fn(),
  };
});

describe("Notification Ingestion Concurrency & Replay Protection", () => {
  const mockDevice = {
    id: "dev-concurrent-123",
    user_id: "usr-concurrent-456",
    device_name: "Samsung S24",
    device_fingerprint: "fp_conc",
    hmac_key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    status: "active",
  };

  it("prevents double spend creation under simultaneous concurrent replay attacks", async () => {
    const { getAdminClient } = await import("@/integrations/supabase/client.server");

    let nonceClaimed = false;
    let spendsCreatedCount = 0;

    // Simulate database where only the first insert on unique constraint succeeds
    const mockInsertLog = vi.fn().mockImplementation((payload) => {
      const getResult = async () => {
        if (nonceClaimed) {
          // Parallel request hits unique constraint on nonce!
          return {
            data: null,
            error: { code: "23505", message: "duplicate key value violates unique constraint" },
          };
        }
        nonceClaimed = true;
        return {
          data: { id: "log-claimed-1" },
          error: null,
        };
      };

      return {
        select: vi.fn().mockReturnValue({
          single: getResult,
          maybeSingle: getResult,
        }),
        then: (resolve: any) => getResult().then(resolve),
      };
    });

    const mockInsertSpend = vi.fn().mockImplementation(() => {
      spendsCreatedCount++;
      return {
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: `spend-created-${spendsCreatedCount}` },
            error: null,
          }),
        }),
      };
    });

    const mockFrom = vi.fn((table: string) => {
      if (table === "notification_ingest_logs") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: mockInsertLog,
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === "spends") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: mockInsertSpend,
        };
      }
      if (table === "transactions") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      if (table === "linked_devices") {
        return {
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      return {};
    });

    vi.mocked(getAdminClient).mockReturnValue({
      from: mockFrom,
      rpc: vi.fn().mockRejectedValue(new Error("RPC not found")), // test atomic fallback
    } as any);

    const payload: NotificationPayload = {
      packageName: "com.phonepe.app",
      amount: 650,
      direction: "DEBIT",
      payee: "D-Mart",
      timestamp: "2026-10-30T12:00:00Z",
    };

    const headers: IngestHeaders = {
      deviceId: mockDevice.id,
      timestamp: Date.now().toString(),
      nonce: "nonce-exact-same-replay-attack",
      signature: "dummy-sig",
    };

    // Dispatch two parallel simultaneous ingestion calls
    const call1 = processNotificationPayload(mockDevice as any, payload, headers);
    const call2 = processNotificationPayload(mockDevice as any, payload, headers);

    const results = await Promise.allSettled([call1, call2]);

    const successes = results.filter((r) => r.status === "fulfilled");
    const rejections = results.filter((r) => r.status === "rejected");

    // Exactly one call succeeds
    expect(successes).toHaveLength(1);
    // The parallel replay is rejected with REPLAY_DETECTED
    expect(rejections).toHaveLength(1);

    const rejectionErr = (rejections[0] as PromiseRejectedResult).reason as Error;
    expect(rejectionErr.message).toMatch(/REPLAY_DETECTED/);

    // CRITICAL INVARIANT: Exactly 1 spend was inserted into the database!
    expect(spendsCreatedCount).toBe(1);
  });
});
