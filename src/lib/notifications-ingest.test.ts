import { describe, it, expect, vi, beforeEach } from "vitest";
import crypto from "node:crypto";
import {
  authenticateNotificationRequest,
  processNotificationPayload,
  type IngestHeaders,
  type NotificationPayload,
} from "./notifications/ingest.server";

// Mock Supabase admin client
vi.mock("@/integrations/supabase/client.server", () => {
  return {
    getAdminClient: vi.fn(),
  };
});

describe("Notification Ingestion Security & Ingestion Pipeline", () => {
  const mockHmacKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
  const mockDeviceId = "dev-1111-2222-3333-4444";
  const mockUserId = "usr-aaaa-bbbb-cccc-dddd";

  const activeDevice = {
    id: mockDeviceId,
    user_id: mockUserId,
    device_name: "Pixel 8",
    device_fingerprint: "fp_test123",
    hmac_key: mockHmacKey,
    status: "active",
    last_sync_at: null,
    last_ip: null,
    created_at: new Date().toISOString(),
  };

  function createValidSignature(
    timestamp: number,
    nonce: string,
    rawBody: string,
    key = mockHmacKey,
  ): string {
    return crypto
      .createHmac("sha256", key)
      .update(`${timestamp}.${nonce}.${rawBody}`)
      .digest("hex");
  }

  describe("HMAC Authentication & Replay Protection", () => {
    it("successfully authenticates a valid signature within timestamp window", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const mockFrom = vi.fn((table: string) => {
        if (table === "linked_devices") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: activeDevice, error: null }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        if (table === "notification_ingest_logs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // nonce not seen
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

      const timestamp = Date.now();
      const nonce = "nonce-unique-1";
      const rawBody = JSON.stringify({ amount: 450 });
      const signature = createValidSignature(timestamp, nonce, rawBody);

      const headers: IngestHeaders = {
        deviceId: mockDeviceId,
        timestamp: timestamp.toString(),
        nonce,
        signature,
      };

      const authenticatedDevice = await authenticateNotificationRequest(headers, rawBody);
      expect(authenticatedDevice.id).toBe(mockDeviceId);
      expect(authenticatedDevice.user_id).toBe(mockUserId);
    });

    it("rejects request if timestamp has drifted > 5 minutes", async () => {
      const timestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      const nonce = "nonce-expired";
      const rawBody = JSON.stringify({ amount: 450 });
      const signature = createValidSignature(timestamp, nonce, rawBody);

      const headers: IngestHeaders = {
        deviceId: mockDeviceId,
        timestamp: timestamp.toString(),
        nonce,
        signature,
      };

      await expect(authenticateNotificationRequest(headers, rawBody)).rejects.toThrow(
        /TIMESTAMP_EXPIRED/,
      );
    });

    it("rejects request if nonce has already been processed (replay attack)", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const mockFrom = vi.fn((table: string) => {
        if (table === "linked_devices") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: activeDevice, error: null }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        if (table === "notification_ingest_logs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: { id: "log-1" }, error: null }), // already seen!
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

      const timestamp = Date.now();
      const nonce = "nonce-already-used";
      const rawBody = JSON.stringify({ amount: 450 });
      const signature = createValidSignature(timestamp, nonce, rawBody);

      const headers: IngestHeaders = {
        deviceId: mockDeviceId,
        timestamp: timestamp.toString(),
        nonce,
        signature,
      };

      await expect(authenticateNotificationRequest(headers, rawBody)).rejects.toThrow(
        /REPLAY_DETECTED/,
      );
    });

    it("rejects request if device is revoked", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const mockFrom = vi.fn((table: string) => {
        if (table === "linked_devices") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { ...activeDevice, status: "revoked" },
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

      const timestamp = Date.now();
      const nonce = "nonce-revoked";
      const rawBody = JSON.stringify({ amount: 450 });
      const signature = createValidSignature(timestamp, nonce, rawBody);

      const headers: IngestHeaders = {
        deviceId: mockDeviceId,
        timestamp: timestamp.toString(),
        nonce,
        signature,
      };

      await expect(authenticateNotificationRequest(headers, rawBody)).rejects.toThrow(
        /DEVICE_REVOKED/,
      );
    });

    it("rejects request if signature is invalid or forged", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const mockFrom = vi.fn((table: string) => {
        if (table === "linked_devices") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: activeDevice, error: null }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          };
        }
        if (table === "notification_ingest_logs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

      const timestamp = Date.now();
      const nonce = "nonce-bad-sig";
      const rawBody = JSON.stringify({ amount: 450 });
      const forgedSignature = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

      const headers: IngestHeaders = {
        deviceId: mockDeviceId,
        timestamp: timestamp.toString(),
        nonce,
        signature: forgedSignature,
      };

      await expect(authenticateNotificationRequest(headers, rawBody)).rejects.toThrow(
        /INVALID_SIGNATURE/,
      );
    });
  });

  describe("Transaction Ingestion & Deduplication", () => {
    it("imports outgoing DEBIT as expense with source = notification", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const insertSpendMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: { id: "spend-999" }, error: null }),
        }),
      });

      const mockFrom = vi.fn((table: string) => {
        if (table === "spends") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }), // no duplicate
            insert: insertSpendMock,
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
            update: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null }),
          };
        }
        if (table === "notification_ingest_logs") {
          const getRes = async () => ({ data: { id: "log-1" }, error: null });
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation(() => ({
              select: vi.fn().mockReturnValue({ single: getRes, maybeSingle: getRes }),
              then: (resolve: any) => getRes().then(resolve),
            })),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis() };
      });

      vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

      const payload: NotificationPayload = {
        packageName: "com.phonepe.app",
        amount: 320,
        direction: "DEBIT",
        payee: "Cafe Coffee Day",
        timestamp: "2026-10-30T10:00:00Z",
        reference: "T12345678",
      };

      const headers: IngestHeaders = {
        deviceId: mockDeviceId,
        timestamp: Date.now().toString(),
        nonce: "nonce-debit-1",
        signature: "sig",
      };

      const result = await processNotificationPayload(activeDevice as any, payload, headers);
      expect(result.status).toBe("imported");
      expect(result.spendId).toBe("spend-999");

      // Verify spend inserted with source = notification
      expect(insertSpendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          source: "notification",
          amount: 320,
          name: "Cafe Coffee Day",
        }),
      );
    });

    it("ignores incoming CREDIT without creating a spend", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const insertSpendMock = vi.fn();
      const mockFrom = vi.fn((table: string) => {
        if (table === "spends") {
          return { insert: insertSpendMock };
        }
        if (table === "notification_ingest_logs") {
          const getRes = async () => ({ data: { id: "log-1" }, error: null });
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation(() => ({
              select: vi.fn().mockReturnValue({ single: getRes, maybeSingle: getRes }),
              then: (resolve: any) => getRes().then(resolve),
            })),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

      const payload: NotificationPayload = {
        packageName: "com.phonepe.app",
        amount: 1000,
        direction: "CREDIT",
        payee: "Rahul Sharma",
        timestamp: "2026-10-30T10:00:00Z",
      };

      const headers: IngestHeaders = {
        deviceId: mockDeviceId,
        timestamp: Date.now().toString(),
        nonce: "nonce-credit-1",
        signature: "sig",
      };

      const result = await processNotificationPayload(activeDevice as any, payload, headers);
      expect(result.status).toBe("ignored_credit");
      expect(insertSpendMock).not.toHaveBeenCalled();
    });

    it("detects duplicate when spend already exists for same date and amount", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const insertSpendMock = vi.fn();
      const mockFrom = vi.fn((table: string) => {
        if (table === "spends") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "existing-spend-123" },
              error: null,
            }), // duplicate exists!
            insert: insertSpendMock,
          };
        }
        if (table === "notification_ingest_logs") {
          const getRes = async () => ({ data: { id: "log-1" }, error: null });
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation(() => ({
              select: vi.fn().mockReturnValue({ single: getRes, maybeSingle: getRes }),
              then: (resolve: any) => getRes().then(resolve),
            })),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          };
        }
        return {};
      });

      vi.mocked(getAdminClient).mockReturnValue({ from: mockFrom } as any);

      const payload: NotificationPayload = {
        packageName: "com.phonepe.app",
        amount: 450,
        direction: "DEBIT",
        payee: "Swiggy",
        timestamp: "2026-10-30T10:00:00Z",
      };

      const headers: IngestHeaders = {
        deviceId: mockDeviceId,
        timestamp: Date.now().toString(),
        nonce: "nonce-dupe-1",
        signature: "sig",
      };

      const result = await processNotificationPayload(activeDevice as any, payload, headers);
      expect(result.status).toBe("duplicate");
      expect(result.spendId).toBe("existing-spend-123");
      expect(insertSpendMock).not.toHaveBeenCalled();
    });
  });
});
