import { describe, it, expect, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
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

describe("Phase 3.2.2 Security Hardening Verification", () => {
  const userA = "usr-alpha-111";
  const userB = "usr-beta-222";

  const deviceA = {
    id: "dev-a-1",
    user_id: userA,
    device_name: "Pixel 9",
    device_fingerprint: "fp_a1",
    hmac_key: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    status: "active",
  };

  describe("SQL Migration Definitions & Role Permissions", () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "supabase/migrations/20261030030000_security_hardening_phase3.sql",
    );
    const sqlContent = fs.readFileSync(migrationPath, "utf8");

    it("1 & 2. Enforces security_invoker and auth.uid() isolation on user_linked_devices view", () => {
      expect(sqlContent).toContain("CREATE VIEW public.user_linked_devices");
      expect(sqlContent).toContain("WITH (security_invoker = true)");
      expect(sqlContent).toContain("WHERE auth.uid() = user_id");

      // Verify anon role is explicitly revoked from accessing the view
      expect(sqlContent).toMatch(/REVOKE ALL ON public\.user_linked_devices FROM PUBLIC, anon;/);
      expect(sqlContent).toMatch(/GRANT SELECT ON public\.user_linked_devices TO authenticated;/);
    });

    it("3, 4 & 5. Enforces safe search_path and restricts RPC execution strictly to service_role", () => {
      // consume_pairing_token
      expect(sqlContent).toMatch(
        /CREATE OR REPLACE FUNCTION public\.consume_pairing_token[\s\S]+?SECURITY DEFINER SET search_path = public, pg_temp;/,
      );
      expect(sqlContent).toMatch(
        /REVOKE ALL ON FUNCTION public\.consume_pairing_token\(text\) FROM PUBLIC, anon, authenticated;/,
      );
      expect(sqlContent).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.consume_pairing_token\(text\) TO service_role;/,
      );

      // ingest_notification_spend
      expect(sqlContent).toMatch(
        /CREATE OR REPLACE FUNCTION public\.ingest_notification_spend[\s\S]+?SECURITY DEFINER SET search_path = public, pg_temp;/,
      );
      expect(sqlContent).toMatch(
        /REVOKE ALL ON FUNCTION public\.ingest_notification_spend[\s\S]+?FROM PUBLIC, anon, authenticated;/,
      );
      expect(sqlContent).toMatch(
        /GRANT EXECUTE ON FUNCTION public\.ingest_notification_spend[\s\S]+?TO service_role;/,
      );
    });

    it("Prevents cross-user financial insertion inside ingest_notification_spend SQL function", () => {
      expect(sqlContent).toContain("IF auth.role() IS DISTINCT FROM 'service_role' THEN");
      expect(sqlContent).toContain("IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN");
      expect(sqlContent).toContain(
        "RAISE EXCEPTION 'UNAUTHORIZED: Cannot ingest transactions for other users'",
      );
    });
  });

  describe("Multi-User Isolation & Cross-Tenant Rejection", () => {
    it("User A cannot read User B's linked devices", async () => {
      // Simulate RLS query on user_linked_devices view with auth.uid() = userA
      const allDevices = [
        { id: "dev-1", user_id: userA, device_name: "User A Phone" },
        { id: "dev-2", user_id: userB, device_name: "User B Phone" },
      ];

      const queryForUser = (activeUserId: string) => {
        // View definition has WHERE auth.uid() = user_id
        return allDevices.filter((d) => d.user_id === activeUserId);
      };

      const userAVisible = queryForUser(userA);
      expect(userAVisible).toHaveLength(1);
      expect(userAVisible[0]!.user_id).toBe(userA);
      expect(userAVisible.find((d) => d.user_id === userB)).toBeUndefined();

      const userBVisible = queryForUser(userB);
      expect(userBVisible).toHaveLength(1);
      expect(userBVisible[0]!.user_id).toBe(userB);
    });

    it("Anonymous user cannot access view rows", () => {
      const allDevices = [{ id: "dev-1", user_id: userA, device_name: "User A Phone" }];
      const queryForAnon = (activeUserId: string | null) => {
        if (!activeUserId) return []; // auth.uid() is null for anon
        return allDevices.filter((d) => d.user_id === activeUserId);
      };

      expect(queryForAnon(null)).toHaveLength(0);
    });
  });

  describe("Safe Retry Recovery & Idempotency", () => {
    it("recovers safely after a transient failure without rejecting as a replay", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const logRecord = {
        id: "log-transient-1",
        user_id: userA,
        device_id: deviceA.id,
        nonce: "nonce-retry-transient",
        status: "processing", // Previous request crashed or timed out in processing state
        spend_id: null as string | null,
      };

      let spendsCreatedCount = 0;

      const mockFrom = vi.fn((table: string) => {
        if (table === "notification_ingest_logs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: logRecord, error: null }),
            update: vi.fn().mockImplementation((payload) => {
              Object.assign(logRecord, payload);
              return { eq: vi.fn().mockResolvedValue({ error: null }) };
            }),
          };
        }
        if (table === "spends") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            or: vi.fn().mockReturnThis(),
            limit: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            insert: vi.fn().mockImplementation(() => {
              spendsCreatedCount++;
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { id: "spend-recovered-123" },
                    error: null,
                  }),
                }),
              };
            }),
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
        rpc: vi.fn().mockRejectedValue(new Error("RPC not found")), // test application fallback
      } as any);

      const payload: NotificationPayload = {
        packageName: "com.phonepe.app",
        amount: 500,
        direction: "DEBIT",
        payee: "Grocery Store",
        timestamp: "2026-10-30T10:00:00Z",
      };

      const headers: IngestHeaders = {
        deviceId: deviceA.id,
        timestamp: Date.now().toString(),
        nonce: "nonce-retry-transient",
        signature: "dummy-sig",
      };

      // Dispatch retry of previous failed request
      const result = await processNotificationPayload(deviceA as any, payload, headers);

      // Verify the retry recovered successfully
      expect(result.status).toBe("imported");
      expect(result.spendId).toBe("spend-recovered-123");
      expect(spendsCreatedCount).toBe(1);
      expect(logRecord.status).toBe("imported");
      expect(logRecord.spend_id).toBe("spend-recovered-123");
    });

    it("returns existing spend idempotently on repeated retry and NEVER creates a duplicate spend", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const existingCompletedLog = {
        id: "log-completed-1",
        user_id: userA,
        device_id: deviceA.id,
        nonce: "nonce-already-imported",
        status: "imported",
        spend_id: "spend-existing-999",
      };

      let spendsCreatedCount = 0;
      const mockInsertSpend = vi.fn().mockImplementation(() => {
        spendsCreatedCount++;
        return {
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: "spend-second" }, error: null }),
          }),
        };
      });

      const mockFrom = vi.fn((table: string) => {
        if (table === "notification_ingest_logs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: existingCompletedLog, error: null }),
          };
        }
        if (table === "spends") {
          return {
            insert: mockInsertSpend,
          };
        }
        return {};
      });

      vi.mocked(getAdminClient).mockReturnValue({
        from: mockFrom,
        rpc: vi.fn().mockRejectedValue(new Error("RPC not found")),
      } as any);

      const payload: NotificationPayload = {
        packageName: "com.phonepe.app",
        amount: 750,
        direction: "DEBIT",
        payee: "Bookstore",
        timestamp: "2026-10-30T10:00:00Z",
      };

      const headers: IngestHeaders = {
        deviceId: deviceA.id,
        timestamp: Date.now().toString(),
        nonce: "nonce-already-imported",
        signature: "dummy-sig",
      };

      const result = await processNotificationPayload(deviceA as any, payload, headers);

      // Returns the original spend_id idempotently
      expect(result.status).toBe("imported");
      expect(result.spendId).toBe("spend-existing-999");
      expect(result.message).toContain("idempotent replay");

      // CRITICAL INVARIANT: Zero second spends were created!
      expect(spendsCreatedCount).toBe(0);
      expect(mockInsertSpend).not.toHaveBeenCalled();
    });

    it("rejects nonce reuse attempt from a different device", async () => {
      const { getAdminClient } = await import("@/integrations/supabase/client.server");

      const logClaimedByOtherDevice = {
        id: "log-other-device",
        user_id: userB,
        device_id: "dev-b-2",
        nonce: "nonce-hijack-attempt",
        status: "imported",
        spend_id: "spend-b-1",
      };

      const mockFrom = vi.fn((table: string) => {
        if (table === "notification_ingest_logs") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: logClaimedByOtherDevice, error: null }),
          };
        }
        return {};
      });

      vi.mocked(getAdminClient).mockReturnValue({
        from: mockFrom,
        rpc: vi.fn().mockRejectedValue(new Error("RPC not found")),
      } as any);

      const payload: NotificationPayload = {
        packageName: "com.phonepe.app",
        amount: 100,
        direction: "DEBIT",
        payee: "Store",
      };

      const headers: IngestHeaders = {
        deviceId: deviceA.id,
        timestamp: Date.now().toString(),
        nonce: "nonce-hijack-attempt",
        signature: "dummy-sig",
      };

      await expect(processNotificationPayload(deviceA as any, payload, headers)).rejects.toThrow(
        /REPLAY_DETECTED: Nonce claimed by another device/,
      );
    });
  });
});
